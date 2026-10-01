// Olaylar, kararlar, seçimler, inşaat projeleri ve dünya haberleri
import { DECISIONS, UNIT_TYPES, TECH_BY_ID } from '../data/rules.js';
import { clamp, dayToDate } from './util.js';
import { countryGdp, manpowerInfo, techCost } from './economy.js';
import { declareWar, concludePeace, warScore, joinWar, applyPeaceTerms, acceptTreaty, TREATY_NAMES } from './diplomacy.js';

const SEISMIC = new Set(['TUR', 'JPN', 'IRN', 'CHL', 'IDN', 'NPL', 'MEX', 'PER', 'ECU', 'ITA', 'GRC', 'PAK', 'AFG', 'CHN', 'PHL', 'NZL', 'TWN', 'GTM', 'COL', 'MMR', 'USA', 'IND']);
const OIL = new Set(['SAU', 'RUS', 'IRN', 'IRQ', 'ARE', 'KWT', 'QAT', 'NOR', 'VEN', 'NGA', 'AGO', 'DZA', 'LBY', 'KAZ', 'AZE', 'OMN', 'CAN', 'BRN', 'GUY', 'BHR', 'TKM']);

// ---------------------------------------------------------------------------
// Rastgele ülke olayları
// ---------------------------------------------------------------------------
const pickProvince = (g, tag) => {
  const list = (g.ownedProvs.get(tag) || []).filter((pid) => g.s.prov.ctrl[pid] === tag);
  return g.rng.weighted(list, (pid) => g.s.prov.pop[pid]) ?? list[0];
};
export const EVENTS = {
  earthquake: {
    title: 'Büyük Deprem',
    chance: (g, c) => (SEISMIC.has(c.tag) ? 0.006 : 0.0007),
    ctx: (g, c) => ({ pid: pickProvince(g, c.tag) }),
    text: (g, c, x) => `${g.world.provinces[x.pid].name} bölgesinde büyük bir deprem meydana geldi. Binlerce bina yıkıldı, altyapı ağır hasar gördü.`,
    pre: (g, c, x) => { const P = g.s.prov; P.gdp[x.pid] *= 0.93; P.pop[x.pid] *= 0.998; P.dev[x.pid] = Math.min(0.6, P.dev[x.pid] + 0.25); c.stability = clamp(c.stability - 3, 0, 100); },
    options: [
      { label: 'Devletin tüm imkânlarını seferber et', desc: 'Hazine: GSYH’nin %0,1’i, istikrar +4', ai: 2, fx: (g, c) => { c.treasury -= countryGdp(g, c.tag) * 0.001; c.stability = clamp(c.stability + 4, 0, 100); } },
      { label: 'Uluslararası yardım kabul et', desc: 'Dost ülkelerle ilişkiler +5, istikrar +1', ai: 1, fx: (g, c) => { for (const t of g.alliesOf(c.tag)) g.addRel(t, c.tag, 5); c.stability = clamp(c.stability + 1, 0, 100); } },
    ],
  },
  economic_crisis: {
    title: 'Ekonomik Kriz',
    chance: (g, c) => 0.0035 + (c.treasury < 0 ? 0.01 : 0),
    text: () => 'Piyasalarda panik var: para birimi sert değer kaybetti, enflasyon hızla yükseliyor.',
    pre: (g, c) => { g.addMod(c, 'growth', -1.5, 240, 'Ekonomik kriz'); },
    options: [
      { label: 'IMF ile kredi anlaşması imzala', desc: 'Hazineye GSYH’nin %0,3’ü, istikrar -5', ai: 1, fx: (g, c) => { c.treasury += countryGdp(g, c.tag) * 0.003; c.stability = clamp(c.stability - 5, 0, 100); } },
      { label: 'Faizleri sert biçimde artır', desc: '6 ay büyüme -1, istikrar +2', ai: 1, fx: (g, c) => { g.addMod(c, 'growth', -1, 180, 'Sıkı para politikası'); c.stability = clamp(c.stability + 2, 0, 100); } },
    ],
  },
  protests: {
    title: 'Kitlesel Protestolar',
    chance: (g, c) => (c.stability < 50 ? 0.02 * (50 - c.stability) / 20 : 0),
    text: (g, c) => `${c.name}'nın büyük şehirlerinde hükümet karşıtı gösteriler büyüyor. Göstericiler meydanları terk etmiyor.`,
    pre: (g, c) => { c.stability = clamp(c.stability - 3, 0, 100); },
    options: [
      { label: 'Taleplere kulak ver, reform sözü ver', desc: 'Hazine: GSYH’nin %0,08’i, istikrar +6', ai: 2, fx: (g, c) => { c.treasury -= countryGdp(g, c.tag) * 0.0008; c.stability = clamp(c.stability + 6, 0, 100); } },
      { label: 'Güvenlik güçleriyle dağıt', desc: 'İstikrar +3, demokrasilerle ilişkiler -5', ai: 1, fx: (g, c) => { c.stability = clamp(c.stability + 3, 0, 100); for (const o of Object.values(g.s.countries)) if (o.alive && o.gov === 'dem' && o.tag !== c.tag) g.addRel(o.tag, c.tag, -5); } },
    ],
  },
  tech_breakthrough: {
    title: 'Bilimsel Atılım',
    chance: (g, c) => (c.research.length ? 0.006 : 0),
    text: (g, c) => `Ulusal araştırma merkezlerimiz önemli bir atılım gerçekleştirdi: ${TECH_BY_ID[c.research[0].id].name} projesi hızlandı.`,
    pre: (g, c) => { const r = c.research[0]; if (r) r.prog += techCost(c, TECH_BY_ID[r.id]) * 0.4; },
    options: [{ label: 'Mükemmel!', desc: 'Araştırma ilerlemesi +%40', ai: 1, fx: () => {} }],
  },
  terror: {
    title: 'Terör Saldırısı',
    chance: () => 0.0028,
    ctx: (g, c) => ({ pid: pickProvince(g, c.tag) }),
    text: (g, c, x) => `${g.world.provinces[x.pid].name} kentinde kanlı bir terör saldırısı gerçekleşti. Halk öfkeli.`,
    pre: (g, c) => { c.stability = clamp(c.stability - 3, 0, 100); c.warSupport = clamp(c.warSupport + 6, 0, 100); },
    options: [
      { label: 'Güvenlik önlemlerini artır', desc: 'Hazine harcaması, istikrar +3', ai: 2, fx: (g, c) => { c.treasury -= countryGdp(g, c.tag) * 0.0003; c.stability = clamp(c.stability + 3, 0, 100); } },
      { label: 'Sınır ötesi operasyon hazırlığı', desc: 'Savaş desteği +6, en düşman komşuya karşı savaş gerekçesi', ai: 1, fx: (g, c) => { c.warSupport = clamp(c.warSupport + 6, 0, 100); const n = hostileNeighbor(g, c.tag); if (n) c.claims[n] = g.s.day + 365; } },
    ],
  },
  coup: {
    title: 'Darbe Girişimi!',
    chance: (g, c) => (['hyb', 'aut', 'jun', 'the'].includes(c.gov) && c.stability < 25 ? 0.04 : 0),
    text: (g, c) => `Ordu içindeki bir grup ${c.name}'nda yönetime el koymaya çalışıyor! Başkentte tanklar görüldü.`,
    options: [
      { label: 'Sadık birliklerle darbeyi bastır', desc: '%60 başarı: istikrar +12. Başarısızlık: askeri yönetim kurulur.', ai: 1, fx: (g, c) => {
        if (g.rng.chance(0.6)) { c.stability = clamp(c.stability + 12, 0, 100); g.news(`${c.name}'nda darbe girişimi bastırıldı.`, { type: 'politics', tags: [c.tag], important: true }); }
        else { c.gov = 'jun'; c.leader = { name: 'Askerî Konsey', title: 'Cunta Lideri', wiki: '' }; c.stability = 38; g.news(`${c.name}'nda ordu yönetime el koydu!`, { type: 'politics', tags: [c.tag], important: true }); }
      } },
      { label: 'Müzakere et ve yetki paylaş', desc: 'İstikrar +5, savaş desteği -10', ai: 1, fx: (g, c) => { c.stability = clamp(c.stability + 5, 0, 100); c.warSupport = clamp(c.warSupport - 10, 0, 100); } },
    ],
  },
  investment: {
    title: 'Büyük Yabancı Yatırım',
    chance: (g, c) => (c.stability > 55 && !g.isAtWar(c.tag) ? 0.004 : 0),
    text: () => 'Uluslararası bir teknoloji şirketi ülkemize milyarlarca dolarlık üretim tesisi kurmaya karar verdi.',
    options: [{ label: 'Yatırımı memnuniyetle karşıla', desc: '1 yıl büyüme +0,8', ai: 1, fx: (g, c) => g.addMod(c, 'growth', 0.8, 365, 'Yabancı yatırım') }],
  },
  defense_export: {
    title: 'Savunma İhracatı Anlaşması',
    chance: (g, c) => (c.techTier >= 3 ? 0.003 : 0),
    text: () => 'Savunma sanayimiz yurt dışından büyük bir sipariş aldı.',
    options: [{ label: 'Anlaşmayı imzala', desc: 'Hazineye GSYH’nin %0,1’i, 6 ay üretim +%5', ai: 1, fx: (g, c) => { c.treasury += countryGdp(g, c.tag) * 0.001; g.addMod(c, 'pp', 0.05, 180, 'İhracat siparişi'); } }],
  },
  refugees: {
    title: 'Mülteci Akını',
    chance: (g, c) => (borderWar(g, c.tag) ? 0.02 : 0),
    text: () => 'Komşu ülkedeki savaştan kaçan yüz binlerce mülteci sınırlarımıza dayandı.',
    options: [
      { label: 'Sınırları aç', desc: 'Hazine harcaması, istikrar -3, dünya ile ilişkiler +', ai: 1, fx: (g, c) => { c.treasury -= countryGdp(g, c.tag) * 0.0004; c.stability = clamp(c.stability - 3, 0, 100); for (const o of Object.values(g.s.countries)) if (o.alive && o.gov === 'dem') g.addRel(o.tag, c.tag, 2); } },
      { label: 'Sınırları kapat', desc: 'İstikrar +2, ilişkiler -', ai: 1, fx: (g, c) => { c.stability = clamp(c.stability + 2, 0, 100); } },
    ],
  },
};
function hostileNeighbor(g, tag) {
  const P = g.s.prov;
  let best = null, br = 0;
  for (const pid of g.ownedProvs.get(tag) || []) for (const e of g.world.adj[pid]) {
    const o = P.owner[e.to];
    if (o === tag) continue;
    const r = g.rel(tag, o);
    if (r < br) { br = r; best = o; }
  }
  return best;
}
function borderWar(g, tag) {
  if (g.isAtWar(tag)) return false;
  const P = g.s.prov;
  for (const pid of g.ownedProvs.get(tag) || []) for (const e of g.world.adj[pid]) {
    const o = P.owner[e.to];
    if (o !== tag && g.isAtWar(o)) return true;
  }
  return false;
}

export function fireEvent(g, tag, id, ctxOverride) {
  const ev = EVENTS[id];
  const c = g.C(tag);
  const ctx = ctxOverride || (ev.ctx ? ev.ctx(g, c) : {});
  if (ev.ctx && ctx.pid === undefined) return;
  if (ev.pre) ev.pre(g, c, ctx);
  if (g.isPlayer(tag)) {
    g.s.pending.push({ kind: 'event', id: g.s.newsSeq++, eventId: id, tag, ctx, day: g.s.day, title: ev.title, text: ev.text(g, c, ctx), options: ev.options.map((o) => ({ label: o.label, desc: o.desc })) });
    g.emit('pending');
  } else {
    const opt = g.rng.weighted(ev.options, (o) => o.ai) || ev.options[0];
    opt.fx(g, c, ctx);
    if (['earthquake', 'coup', 'economic_crisis'].includes(id) && (g.militaryPower(tag) > 300 || g.rng.chance(0.2))) {
      g.news(`${c.name}: ${ev.title.toLocaleLowerCase('tr-TR')}. ${ev.text(g, c, ctx)}`, { type: 'world', tags: [tag], pid: ctx.pid ?? null });
    }
  }
}

// ---------------------------------------------------------------------------
// Bekleyen olayların çözümü (oyuncu)
// ---------------------------------------------------------------------------
export function resolvePending(g, pendingId, choice) {
  const s = g.s;
  const idx = s.pending.findIndex((p) => p.id === pendingId);
  if (idx < 0) return;
  const p = s.pending[idx];
  s.pending.splice(idx, 1);
  const me = s.player;
  if (p.kind === 'event') {
    const ev = EVENTS[p.eventId] || SCRIPTED[p.eventId];
    const opt = ev.options[choice] || ev.options[0];
    opt.fx(g, g.C(p.tag), p.ctx || {});
  } else if (p.kind === 'callToArms') {
    const war = s.wars.find((w) => w.id === p.warId && !w.ended);
    if (!war) return;
    if (choice === 0) joinWar(g, war, me, p.side);
    else {
      g.addRel(me, p.ally, -40);
      g.C(me).stability = clamp(g.C(me).stability - 2, 0, 100);
      g.news(`Müttefikiniz ${g.C(p.ally).name}'nın çağrısını reddettiniz. İlişkiler zarar gördü.`, { type: 'diplo', tags: [me, p.ally] });
    }
  } else if (p.kind === 'peaceConference') {
    const mode = ['annex', 'puppet', 'occupied'][choice] || 'occupied';
    applyPeaceTerms(g, p.target, p.winners, mode, p.main);
    const label = { annex: 'tamamen ilhak edildi', puppet: 'kukla devlete dönüştürüldü', occupied: 'işgal edilen toprakları devretti' }[mode];
    g.news(`🕊️ Barış konferansı: ${g.C(p.target).name} ${label}.`, { type: 'peace', tags: [me, p.target], important: true });
  } else if (p.kind === 'treaty') {
    if (choice === 0) acceptTreaty(g, p.from, me, p.type);
    else g.addRel(p.from, me, -5);
  } else if (p.kind === 'peaceOffer') {
    const war = s.wars.find((w) => w.id === p.warId && !w.ended);
    if (!war) return;
    if (choice === 0) concludePeace(g, war, p.from, me, p.type, true);
    else g.news(`${g.C(p.from).name}'nın barış teklifini reddettiniz.`, { type: 'diplo', tags: [me, p.from] });
  }
  g.emit('pending');
}

// ---------------------------------------------------------------------------
// Ulusal kararlar
// ---------------------------------------------------------------------------
export function decisionStatus(g, tag, id) {
  const d = DECISIONS.find((x) => x.id === id);
  const c = g.C(tag);
  const cost = countryGdp(g, tag) * d.cost;
  const cd = c.cooldowns[id] || 0;
  if (cd > g.s.day) return { ok: false, why: `${cd - g.s.day} gün bekleme süresi`, cost };
  if (d.reqWar && !g.isAtWar(tag)) return { ok: false, why: 'Savaş hâlinde olmalısınız', cost };
  if (cost > 0 && c.treasury < cost) return { ok: false, why: 'Yetersiz hazine', cost };
  return { ok: true, cost };
}
export function takeDecision(g, tag, id) {
  const st = decisionStatus(g, tag, id);
  if (!st.ok) return st;
  const d = DECISIONS.find((x) => x.id === id);
  const c = g.C(tag);
  const s = g.s, P = s.prov;
  c.treasury -= st.cost;
  c.cooldowns[id] = s.day + d.cooldown;
  switch (id) {
    case 'defense_industry': addTimer(g, tag, 120, 'fac', 2); break;
    case 'stimulus': g.addMod(c, 'growth', 1.2, 365, 'Teşvik paketi'); break;
    case 'propaganda': c.warSupport = clamp(c.warSupport + 12, 0, 100); break;
    case 'national_unity': c.stability = clamp(c.stability + 10, 0, 100); c.warSupport = clamp(c.warSupport - 3, 0, 100); break;
    case 'austerity': c.treasury += countryGdp(g, tag) * 0.006; c.stability = clamp(c.stability - 8, 0, 100); g.addMod(c, 'growth', -0.5, 365, 'Kemer sıkma'); break;
    case 'reserves': {
      const mp = manpowerInfo(g, tag);
      const n = Math.max(0, Math.min(3, Math.floor(mp.available / UNIT_TYPES.militia.mp)));
      if (!n) { c.treasury += st.cost; c.cooldowns[id] = 0; return { ok: false, why: 'Yetersiz insan gücü' }; }
      let pid = c.capital;
      if (P.ctrl[pid] !== tag) pid = (g.ctrlProvs.get(tag) || []).find((x) => P.owner[x] === tag) ?? -1;
      if (pid < 0) return { ok: false, why: 'Uygun il yok' };
      for (let i = 0; i < n; i++) g.addUnit(tag, 'militia', pid, { g: 0.25 });
      g.news(`${c.name} ${n} yedek tümeni silah altına aldı.`, { type: 'mil', tags: [tag], pid });
      break;
    }
    case 'fortify': {
      let n = 0;
      for (const pid of g.ownedProvs.get(tag) || []) {
        if (P.ctrl[pid] !== tag) continue;
        const threat = g.world.adj[pid].some((e) => { const o = P.ctrl[e.to]; return o !== tag && (g.atWar(tag, o) || g.rel(tag, o) < -30); });
        if (threat && P.fort[pid] < 5) { P.fort[pid]++; n++; }
      }
      g.news(`${c.name} ${n} sınır ilinde tahkimatları güçlendirdi.`, { type: 'mil', tags: [tag] });
      break;
    }
    case 'intl_aid': {
      let total = 0;
      for (const o of Object.values(s.countries)) {
        if (!o.alive || o.tag === tag || g.atWar(o.tag, tag)) continue;
        const r = g.rel(o.tag, tag);
        if (r < 45) continue;
        const enemies = [...g.enemiesOf(tag)];
        if (enemies.some((e) => g.rel(o.tag, e) > r)) continue;
        const amt = Math.min(o.treasury * 0.15, countryGdp(g, o.tag) * 0.0004 * (r / 100));
        if (amt <= 0.01) continue;
        o.treasury -= amt; c.treasury += amt; total += amt;
      }
      g.news(`${c.name} uluslararası yardım çağrısı yaptı: toplam ${total.toFixed(1)} milyar $ yardım toplandı.`, { type: 'diplo', tags: [tag], important: g.isPlayer(tag) });
      break;
    }
    case 'arms_import': {
      const sellers = ['USA', 'RUS', 'CHN', 'FRA', 'DEU', 'KOR', 'TUR', 'ISR', 'GBR'].filter((t) => t !== tag && s.countries[t]?.alive && g.rel(t, tag) > 15 && !g.atWar(t, tag));
      if (!sellers.length) { c.treasury += st.cost; c.cooldowns[id] = 0; return { ok: false, why: 'Size silah satacak dost ülke yok' }; }
      s.deliveries.push({ tag, item: 'armor', count: 2, day: s.day + 60 });
      g.news(`${c.name}, ${s.countries[sellers[0]].name} başta olmak üzere tedarikçilerden zırhlı araç satın aldı. Teslimat 60 gün içinde.`, { type: 'prod', tags: [tag] });
      break;
    }
    default: break;
  }
  return { ok: true };
}

// İnşaat projeleri (il bazlı)
export const PROJECTS = {
  factory: { name: 'Askeri Fabrika', days: 150, cost: (g, c) => 1.6 * c.costFactor + countryGdp(g, c.tag) * 0.0003, desc: '+1 askeri fabrika (150 gün)' },
  fort: { name: 'Tahkimat', days: 45, cost: (g, c, pid) => (0.25 + 0.15 * g.s.prov.fort[pid]) * c.costFactor, desc: '+1 tahkimat seviyesi (en fazla 5)' },
  infra: { name: 'Altyapı', days: 90, cost: (g, c, pid) => 0.5 * c.costFactor * g.s.prov.infra[pid], desc: '+1 altyapı (hız ve büyüme)' },
};
export function canBuild(g, tag, pid, kind) {
  const c = g.C(tag), P = g.s.prov;
  if (P.owner[pid] !== tag || P.ctrl[pid] !== tag) return { ok: false, why: 'Kendi kontrolünüzdeki illerde inşa edebilirsiniz' };
  const pr = PROJECTS[kind];
  const cost = pr.cost(g, c, pid);
  if (kind === 'fort' && P.fort[pid] >= 5) return { ok: false, why: 'Azami seviye', cost };
  if (kind === 'infra' && P.infra[pid] >= 5) return { ok: false, why: 'Azami seviye', cost };
  if (kind === 'factory' && P.fac[pid] >= Math.max(2, Math.ceil(P.gdp[pid] / 15))) return { ok: false, why: 'Bu ilin ekonomisi daha fazla fabrikayı kaldıramaz', cost };
  if ((c.timers || []).some((t) => t.pid === pid && t.kind === kind)) return { ok: false, why: 'Zaten inşa ediliyor', cost };
  if (c.treasury < cost) return { ok: false, why: 'Yetersiz hazine', cost };
  return { ok: true, cost };
}
export function build(g, tag, pid, kind) {
  const chk = canBuild(g, tag, pid, kind);
  if (!chk.ok) return chk;
  const c = g.C(tag);
  c.treasury -= chk.cost;
  addTimer(g, tag, PROJECTS[kind].days, kind, 1, pid);
  return { ok: true };
}
function addTimer(g, tag, days, kind, v, pid) {
  const c = g.C(tag);
  (c.timers ||= []).push({ day: g.s.day + days, kind, v, pid: pid ?? null, start: g.s.day });
}
function runTimers(g) {
  const s = g.s, P = s.prov;
  for (const c of Object.values(s.countries)) {
    if (!c.alive || !c.timers?.length) continue;
    const keep = [];
    for (const t of c.timers) {
      if (t.day > s.day) { keep.push(t); continue; }
      if (t.pid !== null && (P.owner[t.pid] !== c.tag || P.ctrl[t.pid] !== c.tag)) continue;
      if (t.kind === 'fac') c.facBonus += t.v;
      else if (t.kind === 'factory') P.fac[t.pid] += t.v;
      else if (t.kind === 'fort') P.fort[t.pid] = Math.min(5, P.fort[t.pid] + t.v);
      else if (t.kind === 'infra') { P.infra[t.pid] = Math.min(5, P.infra[t.pid] + t.v); P.gdp[t.pid] *= 1.01; }
      if (g.isPlayer(c.tag)) g.news(`🏗️ İnşaat tamamlandı: ${PROJECTS[t.kind]?.name || 'Askeri sanayi yatırımı'}${t.pid !== null ? ` (${g.world.provinces[t.pid].name})` : ''}.`, { type: 'prod', tags: [c.tag], pid: t.pid });
      g.ownerDirty = true;
    }
    c.timers = keep;
  }
}

// ---------------------------------------------------------------------------
// Senaryo krizleri
// ---------------------------------------------------------------------------
const alive = (g, ...tags) => tags.every((t) => g.C(t)?.alive);
const crisisWar = (g, att, def, name) => {
  const res = declareWar(g, att, def, { name });
  if (res.ok) { g.C(att).claims[def] = g.s.day + 365; }
  return res;
};
export const SCRIPTED = {
  taiwan: {
    title: 'Tayvan Boğazı Krizi',
    actor: 'CHN',
    cond: (g) => alive(g, 'CHN', 'TWN') && !g.atWar('CHN', 'TWN') && g.s.day > 120 && g.C('CHN').puppetOf === null,
    chance: (g) => 0.009 * g.s.aiAggression * (g.s.worldTension > 50 ? 1.6 : 1),
    text: () => 'Halk Kurtuluş Ordusu Tayvan çevresinde şimdiye kadarki en büyük tatbikatını başlattı. Politbüro "yeniden birleşme" için tarihi bir fırsat görüyor.',
    options: [
      { label: 'Abluka ve çıkarma harekâtını başlat', desc: 'Tayvan’a savaş ilan et (ABD garantisi devreye girebilir)', ai: 0.3, fx: (g) => crisisWar(g, 'CHN', 'TWN', 'Tayvan Savaşı') },
      { label: 'Askeri baskıyı sürdür, savaştan kaçın', desc: 'Tayvan ile ilişkiler -10, dünya gerginliği +5', ai: 0.7, fx: (g) => { g.addRel('CHN', 'TWN', -10); g.s.worldTension = clamp(g.s.worldTension + 5, 0, 100); g.news('Tayvan Boğazı’nda gerginlik tırmanıyor: Çin savaş gemileri adayı kuşattı.', { type: 'world', tags: ['CHN', 'TWN'], important: true }); } },
    ],
  },
  israel_iran: {
    title: 'İsrail–İran Gerilimi',
    actor: 'ISR',
    cond: (g) => alive(g, 'ISR', 'IRN') && !g.atWar('ISR', 'IRN') && g.s.day > 60,
    chance: () => 0.015,
    text: () => 'İstihbarat raporları İran’ın uranyum zenginleştirme faaliyetlerini yeniden hızlandırdığını gösteriyor. Güvenlik kabinesi olağanüstü toplandı.',
    options: [
      { label: 'Nükleer tesislere kapsamlı hava harekâtı', desc: 'İran’a savaş ilan et', ai: 0.25, fx: (g) => crisisWar(g, 'ISR', 'IRN', 'İsrail–İran Savaşı') },
      { label: 'Sınırlı hedefli saldırılar', desc: 'İran ile ilişkiler -15, gerginlik +6', ai: 0.75, fx: (g) => { g.addRel('ISR', 'IRN', -15); g.s.worldTension = clamp(g.s.worldTension + 6, 0, 100); const ir = g.C('IRN'); ir.missiles = Math.max(0, ir.missiles - 20); g.news('İsrail, İran’daki askeri hedeflere sınırlı hava saldırıları düzenledi; İran füzelerle karşılık verdi.', { type: 'world', tags: ['ISR', 'IRN'], important: true }); } },
    ],
  },
  india_pakistan: {
    title: 'Keşmir’de Sınır Çatışması',
    actor: 'IND',
    cond: (g) => alive(g, 'IND', 'PAK') && !g.atWar('IND', 'PAK'),
    chance: () => 0.008,
    text: () => 'Kontrol Hattı boyunca ağır topçu düellosu yaşanıyor. Kamuoyu sert bir karşılık bekliyor.',
    options: [
      { label: 'Kapsamlı askeri operasyon başlat', desc: 'Pakistan’a savaş ilan et', ai: 0.2, fx: (g) => crisisWar(g, 'IND', 'PAK', 'Hindistan–Pakistan Savaşı') },
      { label: 'Sınırlı misilleme ve diplomasi', desc: 'İlişkiler -10, savaş desteği +5', ai: 0.8, fx: (g) => { g.addRel('IND', 'PAK', -10); g.C('IND').warSupport += 5; g.news('Hindistan ve Pakistan arasında Keşmir’de çatışmalar yaşandı; uluslararası arabuluculukla ateşkes sağlandı.', { type: 'world', tags: ['IND', 'PAK'] }); } },
    ],
  },
  essequibo: {
    title: 'Esequibo Krizi',
    actor: 'VEN',
    cond: (g) => alive(g, 'VEN', 'GUY') && !g.atWar('VEN', 'GUY'),
    chance: () => 0.006,
    text: () => 'Hükümet, Guyana’nın yönettiği petrol zengini Esequibo bölgesini "ulusal toprak" ilan etti. Ordu sınıra yığınak yapıyor.',
    options: [
      { label: 'Esequibo’yu işgal et', desc: 'Guyana’ya savaş ilan et', ai: 0.3, fx: (g) => crisisWar(g, 'VEN', 'GUY', 'Esequibo Savaşı') },
      { label: 'Uluslararası baskı karşısında geri adım at', desc: 'İstikrar -3', ai: 0.7, fx: (g) => { g.C('VEN').stability -= 3; } },
    ],
  },
  korea: {
    title: 'Kore Yarımadasında Kriz',
    actor: 'PRK',
    cond: (g) => alive(g, 'PRK', 'KOR') && !g.atWar('PRK', 'KOR'),
    chance: () => 0.003 * g_aggr,
    text: () => 'Kuzey Kore, Güney Kore’ye "son uyarı" niteliğinde balistik füze denemeleri gerçekleştirdi. Sınırda topçu birlikleri hazır.',
    options: [
      { label: 'Güney’e saldır', desc: 'Güney Kore’ye savaş ilan et', ai: 0.12, fx: (g) => crisisWar(g, 'PRK', 'KOR', 'İkinci Kore Savaşı') },
      { label: 'Gövde gösterisiyle yetin', desc: 'Gerginlik +4', ai: 0.88, fx: (g) => { g.s.worldTension = clamp(g.s.worldTension + 4, 0, 100); g.news('Kuzey Kore yeni balistik füze denemeleri yaptı; Japonya ve Güney Kore alarmda.', { type: 'world', tags: ['PRK', 'KOR', 'JPN'] }); } },
    ],
  },
  horn: {
    title: 'Afrika Boynuzu’nda Gerilim',
    actor: 'ETH',
    cond: (g) => alive(g, 'ETH', 'ERI') && !g.atWar('ETH', 'ERI'),
    chance: () => 0.005,
    text: () => 'Etiyopya, Kızıldeniz’e erişimin "varoluşsal mesele" olduğunu ilan etti. Eritre sınırında birlikler toplanıyor.',
    options: [
      { label: 'Assab limanını ele geçir', desc: 'Eritre’ye savaş ilan et', ai: 0.3, fx: (g) => crisisWar(g, 'ETH', 'ERI', 'Etiyopya–Eritre Savaşı') },
      { label: 'Diplomatik yolları dene', desc: 'İlişkiler -5', ai: 0.7, fx: (g) => g.addRel('ETH', 'ERI', -5) },
    ],
  },
  scs: {
    title: 'Güney Çin Denizi Çatışması',
    actor: 'CHN',
    cond: (g) => alive(g, 'CHN', 'PHL') && !g.atWar('CHN', 'PHL'),
    chance: () => 0.004,
    text: () => 'Çin sahil güvenlik gemileri Filipin ikmal gemilerine tazyikli suyla müdahale etti. Manila ABD’yi devreye girmeye çağırıyor.',
    options: [
      { label: 'Tartışmalı adalara çıkarma yap', desc: 'Filipinler’e savaş ilan et', ai: 0.08, fx: (g) => crisisWar(g, 'CHN', 'PHL', 'Güney Çin Denizi Savaşı') },
      { label: 'Gri bölge baskısını sürdür', desc: 'İlişkiler -8', ai: 0.92, fx: (g) => { g.addRel('CHN', 'PHL', -8); g.addRel('CHN', 'USA', -3); } },
    ],
  },
  baltic: {
    title: 'Baltık Krizi',
    actor: 'RUS',
    cond: (g) => alive(g, 'RUS', 'EST') && !g.atWar('RUS', 'EST') && !g.isAtWar('RUS') && g.s.day > 365,
    chance: () => 0.0015 * g_aggr,
    text: () => 'Kremlin, Baltık ülkelerindeki Rusça konuşan nüfusun "korunması" gerektiğini açıkladı. Narva sınırında askeri hareketlilik var.',
    options: [
      { label: 'Estonya’ya müdahale et (NATO ile savaş riski!)', desc: 'Estonya’ya savaş ilan et', ai: 0.1, fx: (g) => crisisWar(g, 'RUS', 'EST', 'Baltık Savaşı') },
      { label: 'Hibrit baskıyı sürdür', desc: 'Gerginlik +5', ai: 0.9, fx: (g) => { g.s.worldTension = clamp(g.s.worldTension + 5, 0, 100); } },
    ],
  },
};
let g_aggr = 1;

// Rusya–Ukrayna barış görüşmeleri
function ruUaTalks(g) {
  const war = g.warBetween('RUS', 'UKR');
  if (!war || war.ended) return;
  if (g.s.day < 90) return;
  if (!g.rng.chance(0.035)) return;
  const sc = warScore(g, war); // Rusya açısından
  const playerSide = g.isPlayer('RUS') ? 'RUS' : g.isPlayer('UKR') ? 'UKR' : null;
  const type = sc > 2 ? 'concede' : sc < -6 ? 'demand' : 'white';
  // concede: Ukrayna işgal altındaki toprakları bırakır (from=UKR, to=RUS) ; demand: Rusya geri çekilir
  const text = type === 'concede'
    ? 'Arabulucular, mevcut cephe hattının tanınmasına dayalı bir ateşkes planı sundu: Ukrayna, Rusya’nın kontrolündeki toprakları devredecek.'
    : type === 'demand' ? 'Arabulucular, Rus kuvvetlerinin işgal ettiği topraklardan çekilmesini öngören bir plan sundu.' : 'Arabulucular, savaş öncesi sınırlara dönülmesini öngören bir ateşkes planı sundu.';
  if (playerSide) {
    g.s.pending.push({ kind: 'event', id: g.s.newsSeq++, eventId: 'ruua_talks', tag: playerSide, ctx: { type }, day: g.s.day, title: 'Barış Görüşmeleri', text, options: SCRIPTED_RUUA.options.map((o) => ({ label: o.label, desc: o.desc })) });
    g.emit('pending');
    return;
  }
  const ru = g.C('RUS'), ua = g.C('UKR');
  const ruWants = type !== 'demand' ? 0.5 + (100 - ru.warSupport) / 200 : 0.15;
  const uaWants = type === 'concede' ? 0.12 + (100 - ua.warSupport) / 250 + ua.exhaustion / 200 : 0.6;
  if (g.rng.chance(ruWants * uaWants)) {
    concludePeace(g, war, type === 'concede' ? 'UKR' : 'RUS', type === 'concede' ? 'RUS' : 'UKR', type === 'white' ? 'white' : 'concede', true);
  } else if (g.rng.chance(0.3)) {
    g.news('Rusya–Ukrayna barış görüşmeleri sonuçsuz kaldı; çatışmalar sürüyor.', { type: 'world', tags: ['RUS', 'UKR'] });
  }
}
const SCRIPTED_RUUA = {
  title: 'Barış Görüşmeleri',
  options: [
    { label: 'Planı kabul et', desc: 'Savaş sona erer', fx: (g, c, x) => {
      const war = g.warBetween('RUS', 'UKR');
      if (!war) return;
      const type = x.type;
      if (type === 'white') concludePeace(g, war, 'RUS', 'UKR', 'white', true);
      else if (type === 'concede') concludePeace(g, war, 'UKR', 'RUS', 'concede', true);
      else concludePeace(g, war, 'RUS', 'UKR', 'concede', true);
    } },
    { label: 'Reddet, savaşa devam', desc: 'Savaş desteği +3', fx: (g, c) => { c.warSupport = clamp(c.warSupport + 3, 0, 100); } },
  ],
};
SCRIPTED.ruua_talks = SCRIPTED_RUUA;

// ---------------------------------------------------------------------------
// Seçimler ve planlı lider değişiklikleri
// ---------------------------------------------------------------------------
const SCHEDULED = [
  { date: '2026-01-27', tag: 'HND', leader: 'Nasry Asfura', title: 'Devlet Başkanı', text: 'Nasry Asfura Honduras Devlet Başkanı olarak yemin etti.' },
  { date: '2026-03-11', tag: 'CHL', leader: 'José Antonio Kast', title: 'Devlet Başkanı', text: 'José Antonio Kast Şili Devlet Başkanı olarak göreve başladı.' },
  { date: '2026-02-12', tag: 'BGD', election: true, cands: [['Tarık Rahman', 'Tarique Rahman', 'Başbakan', 0.7]], text: 'Bangladeş’te genel seçim yapıldı.' },
  { date: '2026-04-12', tag: 'HUN', election: true, cands: [['Péter Magyar', 'Péter Magyar', 'Başbakan', 0.55]], text: 'Macaristan’da kritik genel seçim yapıldı.' },
  { date: '2026-04-12', tag: 'PER', election: true, cands: [['Rafael López Aliaga', 'Rafael López Aliaga', 'Devlet Başkanı', 0.5], ['Keiko Fujimori', 'Keiko Fujimori', 'Devlet Başkanı', 0.5]], always: true, text: 'Peru’da devlet başkanlığı seçimi yapıldı.' },
  { date: '2026-05-31', tag: 'COL', election: true, cands: [['Abelardo de la Espriella', 'Abelardo de la Espriella', 'Devlet Başkanı', 0.5], ['Iván Cepeda', 'Iván Cepeda', 'Devlet Başkanı', 0.5]], always: true, text: 'Kolombiya’da devlet başkanlığı seçimi yapıldı.' },
  { date: '2026-09-13', tag: 'SWE', election: true, cands: [['Magdalena Andersson', 'Magdalena Andersson', 'Başbakan', 0.5]], text: 'İsveç’te genel seçim yapıldı.' },
  { date: '2026-10-04', tag: 'BRA', election: true, cands: [['Tarcísio de Freitas', 'Tarcísio de Freitas', 'Devlet Başkanı', 0.45]], text: 'Brezilya’da genel seçim yapıldı.' },
  { date: '2026-10-27', tag: 'ISR', election: true, cands: [['Naftali Bennett', 'Naftali Bennett', 'Başbakan', 0.5]], text: 'İsrail’de Knesset seçimi yapıldı.' },
  { date: '2026-11-03', tag: 'USA', midterm: true, text: 'ABD’de ara seçimler yapıldı.' },
];
const DATED_NEWS = [
  { date: '2026-02-06', text: '🏅 2026 Milano-Cortina Kış Olimpiyatları başladı.' },
  { date: '2026-06-11', text: '⚽ FIFA 2026 Dünya Kupası ABD, Kanada ve Meksika’da başladı.' },
  { date: '2026-07-07', text: '🛡️ NATO Zirvesi Ankara’da toplandı. Müttefikler savunma harcamalarını artırma kararı aldı.', fx: (g) => { const f = g.s.factions.NATO; if (!f) return; for (const a of f.members) for (const b of f.members) if (a < b) g.addRel(a, b, 3); if (g.C('TUR')?.alive) g.C('TUR').stability += 2; } },
  { date: '2026-09-15', text: '🇺🇳 BM Genel Kurulu New York’ta toplandı.' },
  { date: '2026-11-09', text: '🌍 COP31 İklim Zirvesi Antalya’da başladı.' },
  { date: '2026-12-14', text: '💼 G20 Liderler Zirvesi ABD’de toplandı.' },
];
function isoOf(day) { const { y, m, d } = dayToDate(day); return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }

function scheduledToday(g) {
  const today = isoOf(g.s.day);
  for (const n of DATED_NEWS) if (n.date === today) { g.news(n.text, { type: 'world', tags: [] }); n.fx?.(g); }
  for (const e of SCHEDULED) {
    if (e.date !== today) continue;
    const c = g.C(e.tag);
    if (!c?.alive) continue;
    if (e.leader) { setLeader(g, c, e.leader, e.leader, e.title); g.news(`🗳️ ${e.text}`, { type: 'politics', tags: [e.tag] }); continue; }
    if (e.midterm) {
      const lose = c.stability < 55 || g.rng.chance(0.6);
      c.stability = clamp(c.stability + (lose ? -3 : 3), 0, 100);
      g.news(`🗳️ ${e.text} ${lose ? 'Muhalefet Temsilciler Meclisi’nin kontrolünü ele geçirdi.' : 'İktidar partisi Kongre’deki çoğunluğunu korudu.'}`, { type: 'politics', tags: [e.tag] });
      continue;
    }
    if (e.election) runElection(g, c, e);
  }
}
function setLeader(g, c, name, wiki, title) {
  c.leader = { name, title: title || c.leader.title, wiki: wiki || '' };
  g.emit('leader', c.tag);
}
function runElection(g, c, e) {
  const incumbentChance = clamp(0.25 + c.stability / 140, 0.2, 0.8);
  let changed = false;
  if (e.always) {
    const cand = g.rng.weighted(e.cands, (x) => x[3]);
    setLeader(g, c, cand[0], cand[1], cand[2]);
    changed = true;
  } else if (!g.rng.chance(incumbentChance * (1 - (e.cands[0][3] - 0.5)))) {
    const cand = e.cands[0];
    setLeader(g, c, cand[0], cand[1], cand[2]);
    changed = true;
  }
  c.stability = clamp(c.stability + (changed ? -2 : 4), 0, 100);
  g.news(`🗳️ ${e.text} ${changed ? `Kazanan: ${c.leader.name}.` : `${c.leader.name} görevini sürdürecek.`}`, { type: 'politics', tags: [c.tag], important: g.isPlayer(c.tag) });
}
// 2026 sonrası genel seçimler (demokrasiler, 4–5 yılda bir)
function genericElections(g) {
  const { m, d, y } = dayToDate(g.s.day);
  if (d !== 15 || y < 2027) return;
  for (const c of Object.values(g.s.countries)) {
    if (!c.alive || c.gov !== 'dem') continue;
    const h = [...c.tag].reduce((a, ch) => a + ch.charCodeAt(0), 0);
    if (h % 12 + 1 !== m || (y + h) % 4 !== 0) continue;
    const win = g.rng.chance(clamp(0.2 + c.stability / 120, 0.25, 0.8));
    if (!win) {
      setLeader(g, c, 'Yeni Hükümet Lideri', '', c.leader.title);
      c.stability = clamp(c.stability + 6, 0, 100);
      c.warSupport = clamp(c.warSupport - 5, 0, 100);
    } else c.stability = clamp(c.stability + 3, 0, 100);
    if (g.isPlayer(c.tag) || g.militaryPower(c.tag) > 400) {
      g.news(`🗳️ ${c.name}’nda genel seçim: ${win ? 'iktidar güven tazeledi' : 'muhalefet iktidara geldi'}.`, { type: 'politics', tags: [c.tag], important: g.isPlayer(c.tag) });
    }
  }
}

// ---------------------------------------------------------------------------
// Döngüler
// ---------------------------------------------------------------------------
export function dailyEvents(g) {
  g_aggr = g.s.aiAggression;
  runTimers(g);
  scheduledToday(g);
  genericElections(g);
}
export function monthlyEvents(g) {
  const s = g.s;
  g_aggr = s.aiAggression;
  // Rastgele olaylar
  for (const c of Object.values(s.countries)) {
    if (!c.alive) continue;
    const mult = g.isPlayer(c.tag) ? 1.8 : 1;
    for (const [id, ev] of Object.entries(EVENTS)) {
      const p = ev.chance(g, c) * mult;
      if (p > 0 && g.rng.chance(p)) { fireEvent(g, c.tag, id); break; }
    }
  }
  // Küresel petrol fiyatı şoku
  if (g.rng.chance(0.025)) {
    const up = g.rng.chance(0.55);
    g.news(up ? '🛢️ Petrol fiyatları varil başına 110 doları aştı! İhracatçılar kazanıyor, ithalatçılar sıkıntıda.' : '🛢️ Petrol fiyatları sert düştü. Petrol ihracatçısı ülkelerin bütçeleri baskı altında.', { type: 'world', tags: [] });
    for (const c of Object.values(s.countries)) {
      if (!c.alive) continue;
      const gdp = countryGdp(g, c.tag);
      if (OIL.has(c.tag)) { c.treasury += gdp * (up ? 0.004 : -0.002); g.addMod(c, 'growth', up ? 0.8 : -0.8, 180, 'Petrol fiyatları'); }
      else g.addMod(c, 'growth', up ? -0.3 : 0.2, 180, 'Petrol fiyatları');
    }
  }
  // Senaryo krizleri
  for (const [id, sc] of Object.entries(SCRIPTED)) {
    if (!sc.cond || !sc.cond(g)) continue;
    if (!g.rng.chance(sc.chance(g))) continue;
    const actor = sc.actor;
    if (g.isPlayer(actor)) {
      s.pending.push({ kind: 'event', id: s.newsSeq++, eventId: id, tag: actor, ctx: {}, day: s.day, title: sc.title, text: sc.text(g), options: sc.options.map((o) => ({ label: o.label, desc: o.desc })) });
      g.emit('pending');
    } else {
      const opt = g.rng.weighted(sc.options, (o) => o.ai) || sc.options[1];
      opt.fx(g, g.C(actor), {});
    }
    break;
  }
  ruUaTalks(g);
  void TREATY_NAMES;
}
