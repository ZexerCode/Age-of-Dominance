// Yapay zekâ: askeri harekât, üretim, araştırma, diplomasi
import { UNIT_TYPES, TERRAINS, GOVERNMENTS, CONSCRIPTION_LAWS, TECH_BY_ID } from '../data/rules.js';
import { clamp } from './util.js';
import * as eco from './economy.js';
import * as mil from './military.js';
import * as dip from './diplomacy.js';
import { takeDecision, decisionStatus } from './events.js';

const hashTag = (t) => [...t].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) >>> 0;

export function dailyAI(g) {
  const s = g.s;
  processRetaliation(g);
  for (const tag of Object.keys(s.countries)) {
    const c = s.countries[tag];
    if (!c.alive || g.isPlayer(tag)) continue;
    if (c.ai.hash === undefined) initAI(g, c);
    const h = c.ai.hash;
    const atWar = g.isAtWar(tag);
    if (atWar ? (s.day + h) % 2 === 0 : (s.day + h) % 15 === 0) {
      try { militaryThink(g, c); } catch (e) { console.error('AI askeri hata', tag, e); }
    }
    if ((s.day + h) % 10 === 0) {
      try { strategicThink(g, c); } catch (e) { console.error('AI stratejik hata', tag, e); }
    }
  }
  if (s.day % 30 === 15) monthlyAid(g);
}

function initAI(g, c) {
  c.ai.hash = hashTag(c.tag) % 30;
  c.ai.baseDef = c.defPct;
  c.ai.baseUnits = Math.max(1, g.unitsOf(c.tag).length);
  c.ai.baseAir = c.air;
  c.ai.baseNavy = c.navy;
  c.ai.lastExpedition = -999;
  c.ai.baseLaw = c.law;
}

// ---------------------------------------------------------------------------
// Askeri düşünme
// ---------------------------------------------------------------------------
function unitAtk(g, u, pid) {
  const ut = UNIT_TYPES[u.t];
  const t = TERRAINS[g.world.provinces[pid].terrain];
  return ut.atk * u.s * (0.25 + 0.75 * Math.min(1, u.g / (ut.org / 100))) * t.atk * (ut.cls === 'arm' ? t.armor : 1) * (u.sup ? 1 : 0.6);
}
function provDefense(g, pid, attackerTag) {
  const t = TERRAINS[g.world.provinces[pid].terrain];
  const fort = 1 + 0.1 * (g.s.prov.fort[pid] || 0);
  const gp = g.atWar(attackerTag, g.s.prov.ctrl[pid]) ? mil.garrisonPower(g, pid) : 0;
  let d = 0, units = 0;
  for (const v of g.unitsAt(pid)) {
    if (!g.atWar(v.o, attackerTag)) continue;
    const ut = UNIT_TYPES[v.t];
    d += ut.def * v.s * (0.25 + 0.75 * Math.min(1, v.g / (ut.org / 100))) * t.def * fort * (1 + Math.min(10, v.ent) * 0.03);
    units++;
  }
  return d + (units ? gp * 0.5 : gp);
}
function enemyPowerAt(g, pid, tag) {
  let d = 0;
  for (const v of g.unitsAt(pid)) if (g.atWar(v.o, tag)) { const ut = UNIT_TYPES[v.t]; d += (ut.atk + ut.def) / 2 * v.s; }
  return d;
}
const isIdle = (u) => !u.path.length && !u.b;
const combatWidthOf = (g, pid) => mil.combatWidth(g, pid);
const ready = (u) => { const ut = UNIT_TYPES[u.t]; return u.s > 0.5 && u.g > (ut.org / 100) * 0.8; };

function militaryThink(g, c) {
  const tag = c.tag;
  const units = g.unitsOf(tag).filter((u) => !u.dead);
  if (!units.length) return;
  const enemies = g.enemiesOf(tag);
  if (!enemies.size) { peacePosture(g, c, units); return; }
  const P = g.s.prov, W = g.world;
  const myProvs = g.ctrlProvs.get(tag) || [];
  // Cepheler
  const fronts = new Map();
  for (const pid of myProvs) {
    for (const e of W.adj[pid]) {
      if (!enemies.has(P.ctrl[e.to])) continue;
      if (e.sea && e.km > 160) continue;
      let f = fronts.get(pid);
      if (!f) { f = { pid, adj: [], threat: 0, value: eco.provinceValue(g, pid) }; fronts.set(pid, f); }
      f.adj.push(e.to);
    }
  }
  strategicStrikes(g, c, fronts);
  if (!fronts.size) { expedition(g, c, units, enemies); return; }
  // Başkent yedeği: düşman yakınsa başkentte kuvvet bulundur
  if (!fronts.has(c.capital) && P.ctrl[c.capital] === tag) {
    let near = Infinity;
    for (const f of fronts.values()) near = Math.min(near, W.distKm(f.pid, c.capital));
    if (near < 1200) fronts.set(c.capital, { pid: c.capital, adj: [], threat: 12 * (1 - near / 1500) + 4, value: eco.provinceValue(g, c.capital), reserve: true });
  }
  for (const f of fronts.values()) {
    for (const e of f.adj) f.threat += enemyPowerAt(g, e, tag);
    if (P.owner[f.pid] === tag) f.value *= 1.5;
    if (f.pid === c.capital) f.value *= 3;
  }
  // Mevcut dağılım
  const at = new Map();
  const incoming = new Map();
  for (const u of units) {
    if (u.path.length) { const tgt = u.path[u.path.length - 1]; incoming.set(tgt, (incoming.get(tgt) || 0) + 1); }
    else at.set(u.p, (at.get(u.p) || 0) + 1);
  }
  const frontList = [...fronts.values()];
  const totalThreat = frontList.reduce((a, f) => a + f.threat, 0);
  const avgPow = 15;
  const commit = Math.max(frontList.length, Math.round(units.length * 0.88));
  const wSum = frontList.reduce((a, f) => a + 1 + f.threat / avgPow + Math.log10(1 + f.value), 0);
  for (const f of frontList) {
    f.want = Math.max(1, Math.round(commit * (1 + f.threat / avgPow + Math.log10(1 + f.value)) / wSum));
    f.have = (at.get(f.pid) || 0) + (incoming.get(f.pid) || 0);
  }
  // Ana taarruz ekseni: belirli bir hedefe kuvvet yığ
  if (!c.ai.focus || c.ai.focus.until < g.s.day || !fronts.has(c.ai.focus.f) || !g.atWar(tag, P.ctrl[c.ai.focus.e])) {
    let best = null;
    for (const f of frontList) for (const e of f.adj) {
      const val = eco.provinceValue(g, e) * (P.owner[e] === tag ? 2 : 1);
      const score = val / (1 + provDefense(g, e, tag));
      if (!best || score > best.score) best = { f: f.pid, e, score };
    }
    c.ai.focus = best ? { f: best.f, e: best.e, until: g.s.day + 60 } : null;
  }
  if (c.ai.focus && fronts.has(c.ai.focus.f) && GOVERNMENTS[c.gov].aggression * g.s.aiAggression >= 0.7) {
    const ff = fronts.get(c.ai.focus.f);
    ff.want = Math.max(ff.want, Math.min(combatWidthOf(g, c.ai.focus.e) + 2, ff.want + 6));
  }
  // 1) Saldırılar
  const used = new Set();
  const aggressive = GOVERNMENTS[c.gov].aggression * g.s.aiAggression;
  const needRatio = clamp(1.7 - 0.25 * aggressive, 1.25, 1.9);
  const targets = new Map(); // düşman ili → saldırabilecek cepheler
  for (const f of frontList) for (const e of f.adj) { if (!targets.has(e)) targets.set(e, []); targets.get(e).push(f); }
  const targetList = [...targets.entries()].map(([e, fl]) => {
    const own = W.adj[e].filter((x) => !x.sea && (P.ctrl[x.to] === tag || g.coBelligerents(tag).has(P.ctrl[x.to]))).length;
    const total = W.adj[e].filter((x) => !x.sea).length || 1;
    const val = eco.provinceValue(g, e) * (P.owner[e] === tag ? 2.5 : 1) * (g.C(P.owner[e])?.capital === e ? 3 : 1);
    return { e, fl, def: provDefense(g, e, tag), val, encircle: own / total };
  });
  targetList.sort((a, b) => (b.val * (1 + b.encircle)) / (1 + b.def) - (a.val * (1 + a.encircle)) / (1 + a.def));
  let orders = 0;
  for (const tgt of targetList) {
    if (orders > 60) break;
    const sea = (f) => mil.isSeaMove(g, f.pid, tgt.e);
    const cands = [];
    for (const f of tgt.fl) {
      const here = g.unitsAt(f.pid).filter((u) => u.o === tag && isIdle(u) && ready(u) && !used.has(u.id));
      // cephede savunma için yeterli birlik bırak
      let otherThreat = 0;
      for (const x of f.adj) if (x !== tgt.e) otherThreat += enemyPowerAt(g, x, tag);
      const onlyTarget = f.adj.every((x) => x === tgt.e);
      const keep = onlyTarget && enemyPowerAt(g, tgt.e, tag) === 0 ? 0 : Math.max(1, Math.ceil(otherThreat / 22));
      here.sort((a, b) => unitAtk(g, b, tgt.e) - unitAtk(g, a, tgt.e));
      for (const u of here.slice(0, Math.max(0, here.length - keep))) {
        if (sea(f) && !UNIT_TYPES[u.t].amphibious && tgt.def > 0) continue;
        cands.push(u);
      }
    }
    if (!cands.length) continue;
    // Gerçek muharebe hesabıyla kazanma tahmini; en az birlikle yetin
    cands.sort((a, b) => unitAtk(g, b, tgt.e) - unitAtk(g, a, tgt.e));
    let chosen = null;
    for (let n = Math.min(cands.length, 2); n <= cands.length; n++) {
      const set = cands.slice(0, n);
      const est = mil.estimateBattle(g, set, tgt.e);
      if (est.score >= needRatio && est.days < 40) { chosen = cands.slice(0, Math.min(cands.length, n + 1)); break; }
      if (n === cands.length && est.score >= needRatio * 0.85 && aggressive > 1) chosen = set;
    }
    if (cands.length === 1) {
      const est = mil.estimateBattle(g, cands, tgt.e);
      if (est.score >= needRatio && est.days < 40) chosen = cands;
    }
    if (chosen) {
      for (const u of chosen) { u.path = [tgt.e]; u.prog = 0; used.add(u.id); orders++; }
    }
  }
  // 2) Takviye: arka bölgelerden cepheye
  const deficits = frontList.filter((f) => f.have < f.want).sort((a, b) => (b.want - b.have) * (1 + b.threat) - (a.want - a.have) * (1 + a.threat));
  if (!deficits.length) return;
  const pool = [];
  const surplusLeft = new Map();
  for (const f of frontList) surplusLeft.set(f.pid, Math.max(0, (at.get(f.pid) || 0) - f.want - 1));
  for (const u of units) {
    if (!isIdle(u) || used.has(u.id)) continue;
    if (!fronts.has(u.p)) { pool.push(u); continue; }
    const left = surplusLeft.get(u.p);
    if (left > 0) { pool.push(u); surplusLeft.set(u.p, left - 1); }
  }
  const pathCache = new Map();
  let moves = 0;
  for (const f of deficits) {
    let need = f.want - f.have;
    while (need > 0 && pool.length && moves < 40) {
      let bi = -1, bd = Infinity;
      for (let i = 0; i < pool.length; i++) {
        const d = W.distKm(pool[i].p, f.pid);
        if (d < bd) { bd = d; bi = i; }
      }
      const u = pool.splice(bi, 1)[0];
      if (fronts.has(u.p)) at.set(u.p, (at.get(u.p) || 1) - 1);
      const key = `${u.p}>${f.pid}`;
      let path = pathCache.get(key);
      if (path === undefined) { path = mil.findPath(g, tag, u.p, f.pid); pathCache.set(key, path); }
      if (path && path.length) { u.path = [...path]; u.prog = 0; need--; moves++; }
    }
  }
}

function strategicStrikes(g, c, fronts) {
  const tag = c.tag;
  const cands = [];
  for (const f of fronts.values()) for (const e of f.adj) cands.push(e);
  // Düşman toprağındaki derin hedefler (füze)
  if (c.missiles >= 10 && g.rng.chance(0.25)) {
    let best = null, bv = 0;
    const list = cands.length ? cands : [];
    for (const e of g.enemiesOf(tag)) { const cap = g.C(e).capital; if (cap >= 0) list.push(cap); }
    for (const pid of list) {
      if (!mil.canStrike(g, tag, pid, 'missile').ok) continue;
      const v = enemyPowerAt(g, pid, tag) + g.s.prov.fac[pid] * 4;
      if (v > bv) { bv = v; best = pid; }
    }
    if (best !== null && bv > 5) mil.missileStrike(g, tag, best);
  }
  if (c.drones >= 6 && cands.length && g.rng.chance(0.3)) {
    let best = null, bv = 0;
    for (const pid of cands) {
      const v = enemyPowerAt(g, pid, tag);
      if (v > bv && mil.canStrike(g, tag, pid, 'drone').ok) { bv = v; best = pid; }
    }
    if (best !== null) mil.droneStrike(g, tag, best);
  }
  // Varoluşsal tehdit altında nükleer kullanım
  if (c.nukes > 0) {
    const lost = dip.occupiedFraction(g, tag);
    if (lost > 0.3) {
      const enemyNukes = [...g.enemiesOf(tag)].some((e) => g.C(e).nukes > 0);
      const p = (lost - 0.25) * (enemyNukes ? 0.08 : 0.25);
      if (g.rng.chance(p)) {
        // en büyük düşman yığınının bulunduğu işgal edilmiş il
        let best = null, bv = 0;
        for (const pid of g.ownedProvs.get(tag) || []) {
          if (!g.atWar(tag, g.s.prov.ctrl[pid])) continue;
          const v = enemyPowerAt(g, pid, tag);
          if (v > bv) { bv = v; best = pid; }
        }
        if (best !== null) mil.nuclearStrike(g, tag, best);
      }
    }
  }
}

function expedition(g, c, units, enemies) {
  const tag = c.tag;
  if (g.s.day - (c.ai.lastExpedition || -999) < 25) return;
  if (!mil.hasSeaCapability(g, tag)) return;
  const P = g.s.prov, W = g.world;
  const idle = units.filter((u) => isIdle(u) && ready(u));
  if (idle.length < 2) return;
  // Kendi topraklarını savunmak için birlik bırak
  const send = idle.slice(0, Math.min(idle.length - 1, Math.max(2, Math.round(units.length * 0.35)), 16));
  if (!send.length) return;
  // Müttefik cephesi
  let target = null;
  for (const ally of g.coBelligerents(tag)) {
    for (const pid of g.ctrlProvs.get(ally) || []) {
      if (!W.adj[pid].some((e) => !e.sea && enemies.has(P.ctrl[e.to]))) continue;
      const d = W.distKm(pid, c.capital);
      if (!target || d < target.d) target = { pid, d };
    }
  }
  if (!target) {
    // Doğrudan çıkarma: zayıf savunulan düşman kıyı ili
    let best = null;
    for (const pid of W.coastalList) {
      if (!enemies.has(P.ctrl[pid])) continue;
      const def = provDefense(g, pid, tag);
      const d = W.distKm(pid, c.capital);
      const score = (1 + def) * (1 + d / 3000) / (1 + eco.provinceValue(g, pid) * 0.2);
      if (!best || score < best.score) best = { pid, score };
    }
    if (best) target = best;
  }
  if (!target) return;
  c.ai.lastExpedition = g.s.day;
  const byOrigin = new Map();
  for (const u of send) { if (!byOrigin.has(u.p)) byOrigin.set(u.p, []); byOrigin.get(u.p).push(u); }
  let sent = 0;
  for (const [from, list] of byOrigin) {
    const path = mil.findPath(g, tag, from, target.pid);
    if (!path || !path.length) continue;
    for (const u of list) { u.path = [...path]; u.prog = 0; sent++; }
  }
  if (sent && g.involvesPlayer([...g.enemiesOf(tag), ...g.coBelligerents(tag)])) {
    g.news(`🚢 ${c.name} ${sent} tümenlik bir sefer kuvvetini ${W.provinces[target.pid].name} yönüne gönderdi.`, { type: 'mil', tags: [tag], pid: target.pid });
  }
}

function peacePosture(g, c, units) {
  const tag = c.tag;
  const s = g.s, P = s.prov, W = g.world;
  if ((s.day + c.ai.hash) % 45 !== 0) {
    // Yabancı topraktaki birlikleri eve getir
    for (const u of units) {
      if (isIdle(u) && P.owner[u.p] !== tag && P.ctrl[u.p] !== tag) {
        const path = mil.findPath(g, tag, u.p, c.capital);
        if (path) u.path = path;
      }
    }
    return;
  }
  // Düşmanca komşulara karşı sınır savunması
  const border = [];
  for (const pid of g.ctrlProvs.get(tag) || []) {
    let threat = 0;
    for (const e of W.adj[pid]) {
      if (e.sea) continue;
      const o = P.ctrl[e.to];
      if (o === tag) continue;
      const r = g.rel(tag, o);
      if (r < -30 || c.claims[o] > s.day || g.C(o).justify?.target === tag) threat += g.militaryPower(o) > 0 ? 1 + (-r / 50) : 0;
    }
    if (threat > 0) border.push({ pid, threat });
  }
  if (!border.length) return;
  border.sort((a, b) => b.threat - a.threat);
  const top = border.slice(0, Math.max(1, Math.min(border.length, Math.ceil(units.length / 2))));
  const want = new Map();
  const totalT = top.reduce((a, b) => a + b.threat, 0);
  const n = Math.round(units.length * 0.6);
  for (const b of top) want.set(b.pid, Math.max(1, Math.round(n * b.threat / totalT)));
  const have = new Map();
  for (const u of units) have.set(u.path.length ? u.path[u.path.length - 1] : u.p, (have.get(u.path.length ? u.path[u.path.length - 1] : u.p) || 0) + 1);
  const pool = units.filter((u) => isIdle(u) && !want.has(u.p));
  let moves = 0;
  for (const [pid, w] of want) {
    let need = w - (have.get(pid) || 0);
    while (need-- > 0 && pool.length && moves < 15) {
      let bi = 0, bd = Infinity;
      for (let i = 0; i < pool.length; i++) { const d = W.distKm(pool[i].p, pid); if (d < bd) { bd = d; bi = i; } }
      const u = pool.splice(bi, 1)[0];
      const path = mil.findPath(g, tag, u.p, pid);
      if (path && path.length) { u.path = path; moves++; }
    }
  }
}

// ---------------------------------------------------------------------------
// Stratejik düşünme: bütçe, üretim, araştırma, diplomasi
// ---------------------------------------------------------------------------
function strategicThink(g, c) {
  const tag = c.tag;
  const atWar = g.isAtWar(tag);
  budget(g, c, atWar);
  laws(g, c, atWar);
  production(g, c, atWar);
  research(g, c);
  decisions(g, c, atWar);
  diplomacy(g, c, atWar);
  peace(g, c);
  considerWar(g, c, atWar);
}

function budget(g, c, atWar) {
  const base = c.ai.baseDef;
  const lost = atWar ? dip.occupiedFraction(g, c.tag) : 0;
  let target = atWar ? Math.min(Math.max(base, base * 1.5 + 1 + lost * 10), Math.max(base, 14)) : base;
  if (c.treasury < 0 && !atWar) target = base + 0.5;
  c.defPct = clamp(c.defPct + clamp(target - c.defPct, -0.3, 0.5), 0.5, 35);
  // Araştırma payı
  const wantRes = atWar ? 0.08 : c.techTier >= 3 ? 0.18 : 0.12;
  c.resShare = clamp(c.resShare + clamp(wantRes - c.resShare, -0.02, 0.02), 0, 0.5);
}

function laws(g, c, atWar) {
  const idx = CONSCRIPTION_LAWS.findIndex((l) => l.id === c.law);
  const mp = eco.manpowerInfo(g, c.tag);
  if (atWar && mp.available < mp.max * 0.15 && idx < CONSCRIPTION_LAWS.length - 1) {
    const next = CONSCRIPTION_LAWS[idx + 1];
    if (next.id !== 'total' || dip.occupiedFraction(g, c.tag) > 0.2) eco.setLaw(g, c.tag, next.id);
  } else if (!atWar && idx > CONSCRIPTION_LAWS.findIndex((l) => l.id === c.ai.baseLaw)) {
    eco.setLaw(g, c.tag, CONSCRIPTION_LAWS[idx - 1].id);
  }
}

function production(g, c, atWar) {
  const tag = c.tag;
  const b = eco.budgetInfo(g, tag);
  const fac = eco.countryFactories(g, tag);
  if (fac <= 0) return;
  const reserve = Math.max(0.05, b.income * (atWar ? 20 : 60));
  const maxQueue = Math.max(2, Math.ceil(fac / 10));
  const units = g.unitsOf(tag).length;
  const threat = clamp(g.s.worldTension / 60, 0, 1.5) + (atWar ? 1 : 0);
  const targetUnits = Math.round(c.ai.baseUnits * (1 + 0.12 * threat) + (atWar ? 6 + c.ai.baseUnits * 0.4 : 0));
  let guard = 6;
  while (c.queue.length < maxQueue && guard-- > 0) {
    if (c.treasury < reserve) break;
    const queuedUnits = c.queue.filter((q) => eco.PROD_ITEMS[q.item].kind === 'unit').length;
    let item = null;
    // hava ve deniz
    if (c.air < c.ai.baseAir * (atWar ? 1.1 : 1) - 1 && !c.queue.some((q) => q.item === 'airwing')) item = 'airwing';
    else if (c.navy < c.ai.baseNavy - 1 && !c.queue.some((q) => eco.PROD_ITEMS[q.item].kind === 'navy')) item = c.navy > 30 ? 'destroyer' : 'frigate';
    else if (c.techs.includes('art3') && c.missiles < (atWar ? 60 : 30) && !c.queue.some((q) => q.item === 'missiles')) item = 'missiles';
    else if (c.techs.includes('air3') && c.drones < (atWar ? 96 : 48) && !c.queue.some((q) => q.item === 'drones')) item = 'drones';
    else if (units + queuedUnits < targetUnits) item = pickLandUnit(g, c, atWar);
    if (!item) break;
    // bakım maliyeti kontrolü
    const pi = eco.PROD_ITEMS[item];
    const addUpkeep = (pi.upkeep || 0) * c.costFactor / 365;
    if (!atWar && b.net - addUpkeep * (queuedUnits + 1) < 0) break;
    if (atWar && c.treasury < -b.income * 20) break;
    const res = eco.enqueue(g, tag, item);
    if (!res.ok) {
      if (pi.kind === 'unit' && res.why === 'Yetersiz insan gücü') break;
      if (res.why === 'Yetersiz hazine') break;
      break;
    }
  }
}
function pickLandUnit(g, c, atWar) {
  const tier = c.techTier;
  const w = [
    ['infantry', 4],
    ['mechanized', tier >= 2 ? 2 : 0],
    ['armor', tier >= 2 && (c.tk ?? 1) > 0 ? 1.4 + (tier >= 4 ? 0.6 : 0) : 0],
    ['artillery', 1],
    ['militia', tier <= 1 || (atWar && c.treasury < 0) ? 3 : 0],
    ['special', tier >= 3 ? 0.3 : 0],
  ];
  const pick = g.rng.weighted(w, (x) => x[1]);
  return pick ? pick[0] : 'infantry';
}

const BRANCH_PREF = { land: 3, armor: 2, artillery: 2, air: 2.2, naval: 1.2, industry: 3, cyber: 1, doctrine: 2, strategic: 0.6 };
function research(g, c) {
  const slots = eco.researchSlots(c);
  let guard = 3;
  while (c.research.length < slots && guard-- > 0) {
    const avail = eco.availableTechs(c).filter((t) => !c.research.some((r) => r.id === t.id) && (t.id !== 'str3' || ['IRN', 'PRK', 'SAU'].includes(c.tag) && g.rng.chance(0.2)));
    if (!avail.length) return;
    const pick = g.rng.weighted(avail, (t) => (BRANCH_PREF[t.branch] || 1) / (t.level * t.level));
    if (!pick) return;
    eco.startResearch(g, c.tag, pick.id);
  }
}

function decisions(g, c, atWar) {
  const tag = c.tag;
  const tryD = (id) => { if (decisionStatus(g, tag, id).ok) takeDecision(g, tag, id); };
  if (c.stability < 35) tryD('national_unity');
  if (atWar) {
    if (c.warSupport < 40) tryD('propaganda');
    const lost = dip.occupiedFraction(g, tag);
    if (lost > 0.08) tryD('reserves');
    if (g.warsOf(tag).some((w) => w.def.includes(tag))) tryD('fortify');
    if (c.treasury < 0) tryD('intl_aid');
  } else {
    const b = eco.budgetInfo(g, tag);
    if (c.treasury > b.income * 365 * 0.8) tryD('stimulus');
    if (c.treasury > b.income * 365 * 0.5 && c.techTier >= 2) tryD('defense_industry');
    if (c.treasury < -b.income * 120) tryD('austerity');
  }
}

function diplomacy(g, c, atWar) {
  const tag = c.tag;
  const s = g.s;
  // ilişki geliştirme
  if (Object.keys(c.improving).length < 2 && c.treasury > 0 && g.rng.chance(0.15)) {
    const cands = Object.values(s.countries).filter((o) => o.alive && o.tag !== tag && o.bloc === c.bloc && !g.atWar(tag, o.tag) && g.rel(tag, o.tag) < 70 && g.rel(tag, o.tag) > 0);
    const pick = g.rng.weighted(cands, (o) => Math.sqrt(eco.countryGdp(g, o.tag)));
    if (pick) dip.improveRelations(g, tag, pick.tag);
  }
  // Batı yaptırımları: haksız saldırganlara
  if (['USA', 'GBR', 'FRA', 'DEU', 'JPN', 'CAN', 'ITA', 'AUS'].includes(tag)) {
    for (const w of s.wars) {
      if (w.ended || w.cb) continue;
      const lead = w.leadA;
      const victimWest = w.def.some((t) => g.C(t)?.bloc === 'W');
      if (victimWest && lead && !g.C(lead).sanctions.includes(tag) && g.rel(tag, lead) < -20 && !g.isAlly(tag, lead)) dip.toggleSanction(g, tag, lead);
    }
  }
  // Tehdit altındaki ülke dostlarıyla ittifak arar
  if (!g.factionOf.get(tag) && g.rng.chance(0.05)) {
    const threatened = Object.values(s.countries).some((o) => o.alive && (o.justify?.target === tag || o.claims[tag] > s.day));
    if (threatened) {
      const cands = Object.values(s.countries).filter((o) => o.alive && o.tag !== tag && !g.isPlayer(o.tag) && dip.wouldAccept(g, tag, o.tag, 'alliance').ok);
      const pick = cands.sort((a, b) => g.militaryPower(b.tag) - g.militaryPower(a.tag))[0];
      if (pick) dip.proposeTreaty(g, tag, pick.tag, 'alliance');
    }
  }
  void atWar;
}

function peace(g, c) {
  const tag = c.tag;
  const s = g.s;
  for (const w of g.warsOf(tag)) {
    if (w.ended || w.scripted) continue;
    const lead = w.leadA === tag || w.leadD === tag;
    const enemyLead = w.att.includes(tag) ? w.leadD : w.leadA;
    if (!enemyLead) continue;
    const days = s.day - w.start;
    if (days < 75) continue;
    const my = dip.warScore(g, w) * (w.att.includes(tag) ? 1 : -1);
    let type = null;
    if (my > 35 && days > 100) type = 'demand';
    else if (my < -30 || (my < -15 && c.warSupport < 25)) type = 'concede';
    else if (Math.abs(my) < 15 && days > 270 && (c.exhaustion > 20 || c.warSupport < 35)) type = 'white';
    else if (Math.abs(my) < 22 && days > 540) type = 'white';
    if (!type) continue;
    if (!lead) {
      // Lider olmayan ülke ayrı barış yapabilir
      if (type === 'demand') continue;
      if (c.exhaustion < 35 && type === 'white') continue;
    }
    if (g.isPlayer(enemyLead)) {
      if (!g.rng.chance(0.2) || s.pending.some((p) => p.kind === 'peaceOffer' && p.from === tag)) continue;
      const label = type === 'white' ? 'beyaz barış (savaş öncesi sınırlar)' : type === 'demand' ? 'işgal ettiğimiz toprakların bize devri' : 'işgal ettiğiniz topraklarımızı size devretmek';
      s.pending.push({ kind: 'peaceOffer', id: s.newsSeq++, from: tag, warId: w.id, type, day: s.day, title: 'Barış Teklifi', text: `${c.name} barış teklif ediyor: ${label}.` });
      g.emit('pending');
    } else if (lead) {
      const res = dip.offerPeace(g, tag, enemyLead, type);
      if (res.ok) return;
    }
  }
}

function landNeighbors(g, tag) {
  const P = g.s.prov, W = g.world;
  const set = new Set();
  for (const pid of g.ownedProvs.get(tag) || []) for (const e of W.adj[pid]) {
    if (e.sea && e.km > 120) continue;
    const o = P.owner[e.to];
    if (o !== tag) set.add(o);
  }
  return set;
}
function considerWar(g, c, atWar) {
  const s = g.s;
  const tag = c.tag;
  if (s.day < 45 || c.puppetOf) return;
  if (atWar || c.stability < 40 || c.warSupport < 30) return;
  // Demokrasiler kendiliğinden fetih savaşı başlatmaz (krizler hariç)
  if (c.gov === 'dem' && !Object.values(c.claims).some((d) => d > s.day)) return;
  const gov = GOVERNMENTS[c.gov];
  const myPow = g.militaryPower(tag);
  if (myPow < 50) return;
  for (const t of landNeighbors(g, tag)) {
    const o = g.C(t);
    if (!o?.alive || g.isAlly(tag, t) || o.puppetOf === tag) continue;
    if (g.isPlayer(t) && s.day < 120) continue;
    if ((c.truce?.[t] || 0) > s.day) continue;
    const claim = c.claims[t] > s.day;
    const r = g.rel(tag, t);
    if (r > -40 && !claim) continue;
    // Caydırıcılık
    const protectors = new Set([...g.alliesOf(t)]);
    for (const tr of s.treaties) if (tr.t === 'guarantee' && tr.b === t) protectors.add(tr.a);
    protectors.delete(tag);
    if (c.nukes === 0 && (o.nukes > 0 || [...protectors].some((p) => g.C(p)?.nukes > 0))) continue;
    let defPow = g.militaryPower(t);
    for (const p of protectors) defPow += g.militaryPower(p) * 0.5;
    const ratio = myPow / Math.max(1, defPow);
    const need = 2.2 / Math.max(0.6, gov.aggression * s.aiAggression);
    if (ratio < need) continue;
    let p = 0.0065 * gov.aggression * s.aiAggression * Math.min(2, ratio / need) * (1 + s.worldTension / 100) * (r < -70 ? 1.5 : 1);
    if (o.nukes > 0 && c.nukes > 0) p *= 0.15;
    if (g.isAtWar(t)) p *= 2;
    if (claim) {
      if (g.rng.chance(0.35)) {
        const res = dip.declareWar(g, tag, t);
        if (res.ok) return;
      }
    } else if (!c.justify && g.rng.chance(p)) {
      dip.justifyWar(g, tag, t);
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// Aylık askeri/mali yardım
// ---------------------------------------------------------------------------
function monthlyAid(g) {
  const s = g.s;
  for (const w of s.wars) {
    if (w.ended) continue;
    for (const side of [w.def, w.att]) {
      const enemyLead = side === w.def ? w.leadA : w.leadD;
      for (const recv of side) {
        const rc = g.C(recv);
        if (!rc?.alive) continue;
        let total = 0;
        for (const donor of Object.values(s.countries)) {
          if (!donor.alive || donor.tag === recv || g.isPlayer(donor.tag) || g.isAtWar(donor.tag)) continue;
          const r = g.rel(donor.tag, recv);
          if (r < 35 || g.rel(donor.tag, enemyLead) > -15) continue;
          const amt = eco.countryGdp(g, donor.tag) * 0.00009 * (r / 100);
          if (amt < 0.02 || donor.treasury < amt * 4) continue;
          donor.treasury -= amt; rc.treasury += amt; total += amt;
          g.addRel(donor.tag, recv, 0.5);
        }
        if (total > 0.5 && (g.isPlayer(recv) || g.rng.chance(0.15))) {
          g.news(`💰 ${rc.name} bu ay müttefiklerinden ${total.toFixed(1)} milyar $ askeri ve mali yardım aldı.`, { type: 'diplo', tags: [recv] });
        }
        // Teçhizat yardımı (ödünç-kiralama): ayda en fazla bir tümenlik teçhizat
        if (side === w.def && (rc.lendLease || 0) < 10 && g.rng.chance(0.3)) {
          const donors = Object.values(s.countries).filter((donor) => donor.alive && donor.tag !== recv && !g.isPlayer(donor.tag) && !g.isAtWar(donor.tag)
            && eco.countryGdp(g, donor.tag) >= 1500 && g.rel(donor.tag, recv) >= 50 && g.rel(donor.tag, enemyLead) <= -25);
          const donor = g.rng.weighted(donors, (d) => Math.sqrt(eco.countryGdp(g, d.tag)));
          const pid = donor ? eco.deployProvince(g, rc) : -1;
          if (donor && pid >= 0) {
            const type = donor.techTier >= 4 && g.rng.chance(0.4) ? 'armor' : 'mechanized';
            g.addUnit(recv, type, pid, { x: 0.1 });
            rc.lendLease = (rc.lendLease || 0) + 1;
            if (g.involvesPlayer([recv, donor.tag, enemyLead]) || g.rng.chance(0.25)) g.news(`📦 ${donor.name}, ${rc.name}'na bir ${UNIT_TYPES[type].name} donatacak askeri teçhizat gönderdi.`, { type: 'diplo', tags: [donor.tag, recv] });
          }
        }
      }
    }
  }
}

// Nükleer misilleme
function processRetaliation(g) {
  const s = g.s;
  if (!s.retaliate?.length) return;
  const list = s.retaliate;
  s.retaliate = [];
  for (const r of list) {
    const c = g.C(r.by);
    if (!c?.alive || c.nukes < 1 || g.isPlayer(r.by) || !g.atWar(r.by, r.target)) continue;
    const t = g.C(r.target);
    let best = t.capital;
    if (g.s.prov.ctrl[best] !== r.target) best = (g.ctrlProvs.get(r.target) || [])[0];
    if (best !== undefined) mil.nuclearStrike(g, r.by, best);
  }
}
export function queueRetaliation(g, by, target) {
  (g.s.retaliate ||= []).push({ by, target });
}
void TECH_BY_ID;
