// Ekonomi: gelir/gider, üretim, araştırma, büyüme, insan gücü
import { UNIT_TYPES, OTHER_PRODUCTION, TECH_BY_ID, TECHS, CONSCRIPTION_LAWS } from '../data/rules.js';
import { clamp } from './util.js';

const PROD_ITEMS = { ...Object.fromEntries(Object.entries(UNIT_TYPES).map(([k, v]) => [k, { ...v, kind: 'unit' }])), ...OTHER_PRODUCTION };
export { PROD_ITEMS };

// ---------------------------------------------------------------------------
// Toplamlar (her gün yeniden hesaplanır)
// ---------------------------------------------------------------------------
export function refreshAggregates(g) {
  const s = g.s, P = s.prov, W = g.world;
  const agg = {};
  for (const tag of Object.keys(s.countries)) agg[tag] = { gdp: 0, fac: 0, pop: 0, corePop: 0, provinces: 0, ctrl: 0, value: 0, occupiedLoss: 0 };
  for (let i = 0; i < W.n; i++) {
    const o = P.owner[i], c = P.ctrl[i];
    const out = P.gdp[i] * (1 - P.dev[i]);
    const ao = agg[o];
    if (ao) {
      ao.provinces++;
      ao.pop += P.pop[i];
      if (c === o) {
        const core = P.core[i] === o;
        ao.gdp += out * (core ? 1 : 0.6);
        ao.fac += core ? P.fac[i] : Math.floor(P.fac[i] * 0.5);
        ao.corePop += core ? P.pop[i] : P.pop[i] * 0.2;
      } else {
        ao.occupiedLoss += out;
      }
    }
    if (c !== o && agg[c]) { agg[c].gdp += out * 0.15; agg[c].ctrl++; }
  }
  g.agg = agg;
  g.aggDay = s.day;
  return agg;
}
function aggOf(g, tag) {
  if (!g.agg || g.aggDay !== g.s.day || g.ownerDirty) { refreshAggregates(g); g.ownerDirty = false; }
  return g.agg[tag] || { gdp: 0, fac: 0, pop: 0, corePop: 0, provinces: 0 };
}
export function countryGdp(g, tag) { return aggOf(g, tag).gdp; }
export function countryFactories(g, tag) {
  const c = g.s.countries[tag];
  return aggOf(g, tag).fac + (c ? c.facBonus : 0);
}
export function countryAgg(g, tag) { return aggOf(g, tag); }

// ---------------------------------------------------------------------------
// İnsan gücü (bin kişi)
// ---------------------------------------------------------------------------
export function manpowerInfo(g, tag) {
  const c = g.s.countries[tag];
  const a = aggOf(g, tag);
  const law = g.law(c);
  const max = (a.corePop * law.mp) / 1000;
  let fielded = 0;
  for (const u of g.unitsOf(tag)) fielded += UNIT_TYPES[u.t].mp * u.s;
  let queued = 0;
  for (const q of c.queue) if (PROD_ITEMS[q.item].kind === 'unit') queued += PROD_ITEMS[q.item].mp;
  const available = max - fielded - queued - c.casualties;
  return { max, fielded, queued, casualties: c.casualties, available };
}

// ---------------------------------------------------------------------------
// Bütçe
// ---------------------------------------------------------------------------
export function budgetInfo(g, tag) {
  const c = g.s.countries[tag];
  const gdp = countryGdp(g, tag);
  const d = g.diff(tag);
  const stabMul = 0.8 + 0.4 * c.stability / 100;
  const income = (gdp * c.defPct / 100 / 365) * d.playerIncome * stabMul;
  const research = income * c.resShare;
  let army = 0;
  for (const u of g.unitsOf(tag)) army += UNIT_TYPES[u.t].upkeep * (0.6 + 0.4 * u.s);
  const cf = c.costFactor;
  const armyCost = army * cf / 365;
  const airCost = c.air * 0.3 * cf / 365;
  const navyCost = c.navy * 0.07 * cf / 365;
  const stratCost = (c.nukes > 0 ? Math.min(c.nukes, 400) * 0.02 * cf : 0) / 365 + c.drones * 0.001 * cf / 365;
  const upkeep = armyCost + airCost + navyCost + stratCost;
  const interest = c.treasury < 0 ? -c.treasury * 0.06 / 365 : 0;
  return { gdp, income, research, armyCost, airCost, navyCost, stratCost, upkeep, interest, net: income - research - upkeep - interest };
}

export function productionPoints(g, tag) {
  const c = g.s.countries[tag];
  const fac = countryFactories(g, tag);
  const mul = 1 + g.techSum(c, 'pp') + g.modSum(c, 'pp');
  const stab = 0.75 + 0.25 * c.stability / 100;
  const war = g.isAtWar(tag) ? 1.15 : 1;
  const law = c.defPct >= 6 ? 1.15 : c.defPct >= 4 ? 1.07 : 1;
  return fac * mul * stab * war * law;
}
export function researchPoints(g, tag) {
  const c = g.s.countries[tag];
  const gdp = countryGdp(g, tag);
  return (1.2 + Math.sqrt(Math.max(0, gdp)) * 0.15) * (0.3 + c.resShare * 4.6) * (1 + g.techSum(c, 'research') + g.modSum(c, 'research'));
}
export function researchSlots(c) { return c.techTier >= 4 ? 3 : 2; }

// ---------------------------------------------------------------------------
// Günlük
// ---------------------------------------------------------------------------
export function dailyEconomy(g) {
  const s = g.s;
  refreshAggregates(g);
  g.ownerDirty = false;
  for (const tag of Object.keys(s.countries)) {
    const c = s.countries[tag];
    if (!c.alive) continue;
    const b = budgetInfo(g, tag);
    c.treasury += b.net;
    c.lastIncome = b.income;
    c.lastExpense = b.research + b.upkeep + b.interest;
    if (c.treasury < 0) {
      c.stability = clamp(c.stability - 0.02, 0, 100);
      if (c.treasury < -Math.max(1, b.income * 365 * 0.6)) {
        // Maaşlar ödenemiyor: birlik organizasyonu düşer
        for (const u of g.unitsOf(tag)) u.g = Math.max(0.1, u.g - 0.01);
      }
    }
    // Üretim
    runProduction(g, c);
    // Araştırma
    runResearch(g, c);
    // İlişki geliştirme
    for (const [other, until] of Object.entries(c.improving)) {
      if (until < s.day || !s.countries[other]?.alive || g.atWar(tag, other)) { delete c.improving[other]; continue; }
      g.addRel(tag, other, 0.35);
      c.treasury -= b.gdp * 0.000004;
    }
    // Savaş gerekçesi
    if (c.justify && c.justify.until <= s.day) {
      const target = c.justify.target;
      c.claims[target] = s.day + 365;
      c.justify = null;
      if (g.isPlayer(tag)) g.news(`${s.countries[target].name} için savaş gerekçesi hazır. Artık daha düşük bedelle savaş ilan edebilirsiniz.`, { type: 'diplo', tags: [tag, target], important: true });
    }
  }
  // Teslimatlar (silah ithalatı)
  if (s.deliveries.length) {
    const left = [];
    for (const d of s.deliveries) {
      if (d.day > s.day) { left.push(d); continue; }
      const c = s.countries[d.tag];
      if (!c?.alive) continue;
      const pid = deployProvince(g, c);
      if (pid < 0) continue;
      for (let i = 0; i < d.count; i++) g.addUnit(d.tag, d.item, pid, { x: 0.05 });
      if (g.isPlayer(d.tag)) g.news(`İthal edilen ${d.count} adet ${UNIT_TYPES[d.item].name} ${g.world.provinces[pid].name} bölgesine ulaştı.`, { type: 'prod', tags: [d.tag], pid });
    }
    s.deliveries = left;
  }
}

function runProduction(g, c) {
  if (!c.queue.length) return;
  let pp = productionPoints(g, c.tag);
  const done = [];
  for (const q of c.queue) {
    if (pp <= 0) break;
    const item = PROD_ITEMS[q.item];
    const maxRate = Math.max(item.pp / 14, 8);
    const add = Math.min(pp, maxRate, item.pp - q.prog);
    q.prog += add;
    pp -= add;
    if (q.prog >= item.pp - 1e-6) done.push(q);
  }
  for (const q of done) {
    c.queue.splice(c.queue.indexOf(q), 1);
    completeItem(g, c, q.item);
  }
}

export function deployProvince(g, c) {
  const P = g.s.prov;
  const ok = (pid) => pid != null && pid >= 0 && P.owner[pid] === c.tag && P.ctrl[pid] === c.tag && !g.battleByProv.has(pid);
  if (ok(c.deploy)) return c.deploy;
  if (ok(c.capital)) return c.capital;
  let best = -1, bestG = -1;
  for (const pid of g.ownedProvs.get(c.tag) || []) {
    if (!ok(pid)) continue;
    if (P.gdp[pid] > bestG) { bestG = P.gdp[pid]; best = pid; }
  }
  return best;
}

function completeItem(g, c, itemId) {
  const item = PROD_ITEMS[itemId];
  if (item.kind === 'unit') {
    const pid = deployProvince(g, c);
    if (pid < 0) { c.treasury += item.cost * c.costFactor * 0.5; return; }
    g.addUnit(c.tag, itemId, pid);
    if (g.isPlayer(c.tag)) g.news(`Yeni ${item.name} ${g.world.provinces[pid].name} bölgesinde göreve hazır.`, { type: 'prod', tags: [c.tag], pid });
  } else if (item.kind === 'air') c.air += item.amount;
  else if (item.kind === 'navy') c.navy += item.amount;
  else if (item.kind === 'nuke') {
    const first = c.nukes === 0;
    c.nukes += item.amount;
    if (first) {
      g.news(`☢️ ${c.name} ilk nükleer savaş başlığını üretti! Dünya alarmda.`, { type: 'nuke', tags: [c.tag], important: true });
      g.s.worldTension = clamp(g.s.worldTension + 10, 0, 100);
      for (const o of Object.values(g.s.countries)) if (o.alive && o.tag !== c.tag && o.bloc === 'W') g.addRel(o.tag, c.tag, -25);
    }
  } else if (item.kind === 'missile') c.missiles += item.amount;
  else if (item.kind === 'drone') c.drones += item.amount;
  if (item.kind !== 'unit' && g.isPlayer(c.tag)) g.news(`Üretim tamamlandı: ${item.name}.`, { type: 'prod', tags: [c.tag] });
}

export function canProduce(g, tag, itemId) {
  const c = g.s.countries[tag];
  const item = PROD_ITEMS[itemId];
  if (!item) return { ok: false, why: 'Bilinmeyen kalem' };
  if (item.req && !c.techs.includes(item.req)) return { ok: false, why: `Gerekli teknoloji: ${TECH_BY_ID[item.req].name}` };
  if (item.kind === 'navy' && !hasCoast(g, tag)) return { ok: false, why: 'Kıyı şeridi yok' };
  const cost = item.cost * c.costFactor;
  if (c.treasury < cost) return { ok: false, why: 'Yetersiz hazine' };
  if (item.kind === 'unit') {
    const mp = manpowerInfo(g, tag);
    if (mp.available < item.mp) return { ok: false, why: 'Yetersiz insan gücü' };
  }
  if (countryFactories(g, tag) <= 0) return { ok: false, why: 'Askeri fabrika yok' };
  if (c.queue.length >= 40) return { ok: false, why: 'Üretim kuyruğu dolu' };
  return { ok: true, cost };
}
function hasCoast(g, tag) {
  return (g.ownedProvs.get(tag) || []).some((pid) => g.world.provinces[pid].coastal && g.s.prov.ctrl[pid] === tag);
}

export function enqueue(g, tag, itemId) {
  const chk = canProduce(g, tag, itemId);
  if (!chk.ok) return chk;
  const c = g.s.countries[tag];
  c.treasury -= chk.cost;
  c.queue.push({ item: itemId, prog: 0, paid: chk.cost });
  return { ok: true };
}
export function cancelQueue(g, tag, index) {
  const c = g.s.countries[tag];
  const q = c.queue[index];
  if (!q) return;
  const item = PROD_ITEMS[q.item];
  c.treasury += q.paid * (1 - 0.5 * q.prog / item.pp);
  c.queue.splice(index, 1);
}
export function moveQueue(g, tag, index, dir) {
  const c = g.s.countries[tag];
  const j = index + dir;
  if (j < 0 || j >= c.queue.length) return;
  [c.queue[index], c.queue[j]] = [c.queue[j], c.queue[index]];
}

// ---------------------------------------------------------------------------
// Araştırma
// ---------------------------------------------------------------------------
export function availableTechs(c) {
  return TECHS.filter((t) => !c.techs.includes(t.id) && (t.level === 1 || c.techs.includes(`${t.branch.slice(0, 3)}${t.level - 1}`)));
}
export function techCost(c, t) {
  // Geri kalmış ülkeler bilinen teknolojileri daha ucuza öğrenir (yayılma)
  return Math.round(t.cost * (1 + 0.05 * Math.max(0, c.techs.length - 20)));
}
export function startResearch(g, tag, techId) {
  const c = g.s.countries[tag];
  const t = TECH_BY_ID[techId];
  if (!t || c.techs.includes(techId)) return { ok: false, why: 'Geçersiz' };
  if (!availableTechs(c).includes(t)) return { ok: false, why: 'Önkoşul eksik' };
  if (c.research.some((r) => r.id === techId)) return { ok: false, why: 'Zaten araştırılıyor' };
  if (c.research.length >= researchSlots(c)) return { ok: false, why: 'Araştırma yuvası dolu' };
  c.research.push({ id: techId, prog: 0 });
  return { ok: true };
}
export function cancelResearch(g, tag, techId) {
  const c = g.s.countries[tag];
  c.research = c.research.filter((r) => r.id !== techId);
}
// Dünyada bu teknolojiye sahip ülke oranı (yayılma bonusu)
function diffusion(g, techId) {
  if (!g._diffusion || g._diffusionDay + 30 < g.s.day) {
    g._diffusion = {};
    g._diffusionDay = g.s.day;
    const alive = Object.values(g.s.countries).filter((c) => c.alive);
    for (const t of TECHS) g._diffusion[t.id] = alive.filter((c) => c.techs.includes(t.id)).length / Math.max(1, alive.length);
  }
  return g._diffusion[techId] || 0;
}
function runResearch(g, c) {
  if (!c.research.length) return;
  const rp = researchPoints(g, c.tag);
  const done = [];
  for (const r of c.research) {
    const t = TECH_BY_ID[r.id];
    r.prog += rp * (1 + 0.6 * diffusion(g, r.id));
    if (r.prog >= techCost(c, t)) done.push(r);
  }
  for (const r of done) {
    c.research.splice(c.research.indexOf(r), 1);
    c.techs.push(r.id);
    const t = TECH_BY_ID[r.id];
    onTechResearched(g, c, t);
  }
}
function onTechResearched(g, c, t) {
  if (g.isPlayer(c.tag)) g.news(`🔬 Araştırma tamamlandı: ${t.name}`, { type: 'tech', tags: [c.tag], important: true });
  if (t.id === 'str3' && c.nukes === 0) {
    g.news(`${c.name} nükleer silah programını tamamladı. Uluslararası toplum endişeli.`, { type: 'nuke', tags: [c.tag], important: true });
    for (const o of Object.values(g.s.countries)) if (o.alive && o.tag !== c.tag && (o.bloc === 'W' || g.rel(o.tag, c.tag) < 0)) g.addRel(o.tag, c.tag, -20);
    g.s.worldTension = clamp(g.s.worldTension + 6, 0, 100);
  }
  if (t.id === 'art3' && c.missiles < 10) c.missiles += 10;
  if (t.id === 'air3' && c.drones < 24) c.drones += 24;
}

// ---------------------------------------------------------------------------
// Politika ayarları
// ---------------------------------------------------------------------------
export function setDefense(g, tag, pct) {
  const c = g.s.countries[tag];
  c.defPct = clamp(Math.round(pct * 10) / 10, 0.5, 35);
}
export function setResearchShare(g, tag, share) {
  const c = g.s.countries[tag];
  c.resShare = clamp(Math.round(share * 100) / 100, 0, 0.5);
}
export function canSetLaw(g, tag, lawId) {
  const c = g.s.countries[tag];
  const law = CONSCRIPTION_LAWS.find((l) => l.id === lawId);
  if (!law) return { ok: false, why: 'Geçersiz' };
  if (law.reqWar && !g.isAtWar(tag)) return { ok: false, why: 'Savaş hâlinde olmalısınız' };
  if (law.reqWarSupport && c.warSupport < law.reqWarSupport && !(law.id === 'mobilization' && g.isAtWar(tag))) return { ok: false, why: `Savaş desteği en az %${law.reqWarSupport} olmalı` };
  return { ok: true };
}
export function setLaw(g, tag, lawId) {
  const chk = canSetLaw(g, tag, lawId);
  if (!chk.ok) return chk;
  const c = g.s.countries[tag];
  if (c.law === lawId) return { ok: true };
  const oldIdx = CONSCRIPTION_LAWS.findIndex((l) => l.id === c.law);
  const newIdx = CONSCRIPTION_LAWS.findIndex((l) => l.id === lawId);
  c.law = lawId;
  if (newIdx > oldIdx) c.stability = clamp(c.stability - 3 * (newIdx - oldIdx), 0, 100);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Aylık
// ---------------------------------------------------------------------------
export function growthRate(g, tag) {
  const c = g.s.countries[tag];
  let gr = c.growth + g.techSum(c, 'growth') + g.modSum(c, 'growth') + g.law(c).growth;
  if (c.stability < 40) gr -= (40 - c.stability) * 0.08;
  else if (c.stability > 70) gr += (c.stability - 70) * 0.02;
  if (g.isAtWar(tag)) {
    const a = aggOf(g, tag);
    gr -= 0.5 + 4 * (a.occupiedLoss / Math.max(0.001, a.gdp + a.occupiedLoss));
  }
  gr -= Math.max(0, c.defPct - 3) * 0.22;
  gr -= c.sanctions.length ? Math.min(1.2, sanctionImpact(g, tag)) : 0;
  gr -= c.exhaustion * 0.03;
  if (c.treasury < 0) gr -= 0.5;
  return gr;
}
function sanctionImpact(g, tag) {
  const c = g.s.countries[tag];
  let v = 0;
  for (const by of c.sanctions) {
    const o = g.s.countries[by];
    if (!o?.alive) continue;
    v += Math.min(0.35, Math.sqrt(countryGdp(g, by)) / 300);
  }
  return v;
}
export function stabilityTarget(g, tag) {
  const c = g.s.countries[tag];
  const base = { dem: 62, hyb: 56, aut: 60, com: 66, mon: 68, the: 55, jun: 45 }[c.gov] ?? 55;
  let t = base + g.law(c).stability + g.modSum(c, 'stability');
  if (c.treasury < 0) t -= 10;
  // Barış zamanında yüksek savunma harcaması halkı rahatsız eder
  t -= Math.max(0, c.defPct - 3) * (g.isAtWar(tag) ? 0.4 : 1.5);
  t -= c.exhaustion * 0.3;
  const gr = growthRate(g, tag);
  t += clamp(gr - 2, -6, 6) * 1.5;
  return clamp(t, 5, 95);
}
export function monthlyEconomy(g) {
  const s = g.s, P = s.prov;
  const growth = {};
  const popGrowth = {};
  for (const tag of Object.keys(s.countries)) {
    const c = s.countries[tag];
    if (!c.alive) continue;
    growth[tag] = growthRate(g, tag);
    const pc = countryGdp(g, tag) * 1e9 / Math.max(1, g.population(tag));
    popGrowth[tag] = pc < 3000 ? 2.2 : pc < 12000 ? 1.0 : 0.3;
  }
  for (let i = 0; i < g.world.n; i++) {
    const o = P.owner[i];
    if (growth[o] === undefined) continue;
    const occ = P.ctrl[i] !== o;
    P.gdp[i] *= 1 + (occ ? -0.01 : growth[o] / 1200);
    P.pop[i] *= 1 + popGrowth[o] / 1200;
    if (P.dev[i] > 0) P.dev[i] = P.dev[i] < 0.01 ? 0 : P.dev[i] * 0.93;
  }
  for (const tag of Object.keys(s.countries)) {
    const c = s.countries[tag];
    if (!c.alive) continue;
    c.casualties *= 0.97;
    const atWar = g.isAtWar(tag);
    if (!atWar) c.exhaustion *= 0.8;
    else c.exhaustion = clamp(c.exhaustion + 0.6, 0, 100);
    // istikrar ve savaş desteği kayması
    const st = stabilityTarget(g, tag);
    c.stability = clamp(c.stability + clamp(st - c.stability, -1.5, 1.5), 0, 100);
    let wsTarget = 35 + g.modSum(c, 'warSupport');
    if (atWar) {
      const defending = g.warsOf(tag).some((w) => w.def.includes(tag));
      wsTarget = (defending ? 68 : 48) - c.exhaustion * 0.4;
    }
    c.warSupport = clamp(c.warSupport + clamp(wsTarget - c.warSupport, -2, 2), 0, 100);
    // süresi dolan değiştiricileri temizle
    c.mods = c.mods.filter((m) => m.until === undefined || m.until > s.day);
    // borç faizi kayda alınır (budgetInfo içinde günlük uygulanır)
  }
  s.worldTension = clamp(s.worldTension - 0.6, 0, 100);
}

export function countryValue(g, tag) {
  // savaş skoru için il değerleri: nüfus ve GSYH payı
  let v = 0;
  for (const pid of g.ownedProvs.get(tag) || []) v += provinceValue(g, pid);
  return v;
}
export function provinceValue(g, pid) {
  const P = g.s.prov;
  return 0.2 + P.gdp[pid] * 0.6 + P.pop[pid] / 1e6 * 0.4 + P.fac[pid] * 2;
}
