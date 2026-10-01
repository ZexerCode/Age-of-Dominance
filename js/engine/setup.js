// Yeni oyun oluşturma: senaryo verisinden başlangıç durumunu kurar
import { COUNTRY_DATA, FACTIONS, DEFENSE_PACTS, GUARANTEES, BLOC_RELATIONS, RELATION_OVERRIDES, SCENARIO } from '../data/countries.js';
import { UNIT_TYPES, GOVERNMENTS, TECHS, TIER_LEVELS, TECH_OVERRIDES, CONSCRIPTION_LAWS } from '../data/rules.js';
import { clamp, pairKey, Rng } from './util.js';

// Kara kuvvetlerinin aktif personel içindeki payı
const LAND_SHARE = {
  USA: 0.47, RUS: 0.55, CHN: 0.48, IND: 0.84, PAK: 0.85, PRK: 0.85, TUR: 0.73, KOR: 0.73, ISR: 0.75, UKR: 0.8,
  IRN: 0.6, EGY: 0.7, JPN: 0.6, GBR: 0.55, FRA: 0.58, DEU: 0.35, ITA: 0.6, GRC: 0.7, TWN: 0.55, VNM: 0.8, SAU: 0.6,
  POL: 0.7, BRA: 0.6, IDN: 0.7, THA: 0.7, AUS: 0.5, CAN: 0.4, SGP: 0.7, MMR: 0.85, ERI: 0.9,
};
// Deniz piyadesi tümeni sayısı
const MARINES = {
  USA: 3, CHN: 2, RUS: 1, KOR: 2, TUR: 1, GBR: 1, FRA: 1, JPN: 1, IDN: 2, TWN: 1, ESP: 1, ITA: 1, BRA: 1, THA: 1,
  PHL: 1, VNM: 1, IND: 1, IRN: 1, NLD: 1, EGY: 1, GRC: 1, ARG: 1, PRK: 1,
};
// Zorunlu askerlik uygulayan ülkeler
const CONSCRIPTION = new Set([
  'TUR', 'ISR', 'KOR', 'RUS', 'CHN', 'IRN', 'EGY', 'GRC', 'FIN', 'NOR', 'SWE', 'CHE', 'AUT', 'DNK', 'EST', 'LVA', 'LTU',
  'VNM', 'TWN', 'SGP', 'THA', 'BRA', 'CYP', 'CYN', 'AZE', 'ARM', 'GEO', 'BLR', 'KAZ', 'UZB', 'TKM', 'KGZ', 'TJK', 'SYR',
  'DZA', 'MAR', 'TUN', 'COL', 'VEN', 'CUB', 'MNG', 'SRB', 'ERI', 'MLI', 'BFA', 'NER',
]);
// Savaşta seferber edilebilen yedek kuvvetler (bin kişi)
export const RESERVES = {
  ISR: 465, FIN: 238, KOR: 3100, TWN: 1650, SGP: 250, CHE: 120, SWE: 30, NOR: 40, GRC: 220, TUR: 380, RUS: 2000,
  IRN: 350, ARM: 210, AZE: 300, POL: 30, EST: 30, LVA: 20, LTU: 30, VNM: 5000, PRK: 600, CUB: 40, EGY: 480, IND: 1150,
  PAK: 550, CHN: 510, USA: 800, GBR: 70, FRA: 40, DEU: 30, JPN: 50, SAU: 100, IRQ: 50, SYR: 50, DZA: 150, MAR: 150,
  GEO: 40, BLR: 290, KAZ: 50, UZB: 50, THA: 200, IDN: 400, MMR: 100, AUS: 30, CAN: 30, ITA: 18, ESP: 15, BRA: 1340,
  COL: 35, VEN: 50, ARG: 0, ROU: 50, BGR: 3, SRB: 50, HUN: 20, DNK: 40, CYP: 50, CYN: 30, JOR: 65, LBN: 0, MNG: 137,
};
const MOBILIZED = { UKR: 'mobilization', PRK: 'mobilization', RUS: 'conscription', ERI: 'mobilization' };
const STABILITY = {
  UKR: 58, RUS: 62, SDN: 18, SDS: 22, HTI: 15, MMR: 25, SYR: 38, LBN: 35, YEM: 20, AFG: 42, PRK: 80, ISR: 50, VEN: 32,
  LBY: 30, SOM: 25, COD: 30, CAF: 25, MLI: 35, BFA: 32, NER: 38, IRN: 45, PAK: 45, BGD: 45, NPL: 40, MDG: 35, GNB: 35,
  CHN: 72, SAU: 72, ARE: 80, QAT: 82, SGP: 82, CHE: 85, NOR: 80, DNK: 78, FIN: 78, JPN: 70, KOR: 60, USA: 58, FRA: 50,
  DEU: 60, GBR: 58, TUR: 55, ARG: 50, BRA: 55, IND: 62, IRQ: 40, ETH: 40, NGA: 40, PSE: 20, CUB: 40, BOL: 40, PER: 40,
};
const WAR_SUPPORT = { UKR: 72, RUS: 58, ISR: 68, PRK: 85, IRN: 55, TUR: 50, POL: 55, TWN: 45, KOR: 45, IND: 50, PAK: 55, AZE: 60, ARM: 45, CHN: 50, USA: 40 };

const DEFAULT_COLORS = ['#7a9e7e', '#b07d62', '#6d8fb3', '#c2a35d', '#9c6b98', '#5e9c9a', '#b5656d', '#8e8e5a', '#6a7fb0', '#a87e4f', '#5f8f62', '#b38fa5', '#c97b55', '#6a9fb5', '#9fa36a', '#a3685c'];

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function baseRelation(ca, cb) {
  const ba = ca.bloc, bb = cb.bloc;
  const row = BLOC_RELATIONS[ba] && BLOC_RELATIONS[ba][bb] !== undefined ? BLOC_RELATIONS[ba][bb] : (BLOC_RELATIONS[bb] && BLOC_RELATIONS[bb][ba] !== undefined ? BLOC_RELATIONS[bb][ba] : 0);
  const noise = (hashStr(pairKey(ca.tag, cb.tag)) % 17) - 8;
  let v = row + noise;
  if (ca.gov === cb.gov) v += 6;
  if ((ca.gov === 'dem') !== (cb.gov === 'dem')) v -= 5;
  return clamp(v, -100, 100);
}

function guessGrowth(gdp, pop) {
  const pc = (gdp * 1e9) / Math.max(1, pop * 1e6);
  if (pc < 2000) return 4.0;
  if (pc < 10000) return 3.4;
  if (pc < 30000) return 2.4;
  return 1.5;
}
function guessTech(gdp, pop) {
  const pc = (gdp * 1e9) / Math.max(1, pop * 1e6);
  if (pc > 30000) return 3;
  if (pc > 9000) return 2;
  return 1;
}

export function createGame(world, opts = {}) {
  const seed = opts.seed ?? (Math.random() * 2 ** 31) | 0;
  const rng = new Rng(seed);
  const N = world.n;
  const s = {
    v: 1, seed, rng: 0, day: 0,
    player: opts.player || null,
    difficulty: opts.difficulty || 'normal',
    aiAggression: opts.aiAggression ?? 1,
    prov: {
      owner: new Array(N), ctrl: new Array(N), core: new Array(N),
      pop: new Array(N).fill(0), gdp: new Array(N).fill(0), fac: new Array(N).fill(0),
      fort: new Array(N).fill(0), infra: new Array(N).fill(1), dev: new Array(N).fill(0), garr: new Array(N).fill(1),
    },
    countries: {},
    rel: {},
    treaties: [],
    factions: {},
    wars: [],
    nextWarId: 1,
    units: [],
    nextUnitId: 1,
    battles: [],
    nextBattleId: 1,
    news: [],
    newsSeq: 1,
    pending: [],
    worldTension: 22,
    nukesUsed: 0,
    deliveries: [],
    stats: { battles: 0, provincesTaken: 0 },
    over: null,
  };

  // --- Ülkeler ---
  const tags = Object.keys(world.countryMeta);
  const provByTag = {};
  for (const p of world.provinces) (provByTag[p.tag] ||= []).push(p.id);

  let colorIdx = 0;
  for (const tag of tags) {
    const meta = world.countryMeta[tag];
    const d = COUNTRY_DATA[tag] || {};
    const pop = d.pop ?? Math.max(0.01, meta.pop / 1e6);
    const gdp = d.gdp ?? Math.max(0.05, meta.gdp / 1000);
    const gov = d.g || 'hyb';
    const tech = d.tech ?? guessTech(gdp, pop);
    const name = d.n || meta.nameTr;
    const c = {
      tag, name,
      short: d.s || (name.length > 18 ? (meta.nameTr.length < name.length ? meta.nameTr : name) : name),
      en: d.en || meta.nameEn,
      iso2: (d.iso2 || meta.iso2 || '').toLowerCase(),
      flagFile: d.flag || null,
      wiki: d.wiki || name,
      color: d.col || DEFAULT_COLORS[colorIdx++ % DEFAULT_COLORS.length],
      gov, bloc: d.b || 'N',
      leader: { name: d.l || 'Bilinmiyor', title: d.lt || 'Devlet Başkanı', wiki: d.lw || d.l || '' },
      alive: true,
      capital: meta.capital,
      basePop: pop,
      growth: d.gr ?? guessGrowth(gdp, pop),
      defPct: d.def ?? 1.5,
      resShare: 0.15,
      law: MOBILIZED[tag] || (CONSCRIPTION.has(tag) ? 'conscription' : (tech >= 3 ? 'volunteer' : 'limited')),
      stability: STABILITY[tag] ?? GOVERNMENTS[gov].stability,
      warSupport: WAR_SUPPORT[tag] ?? 35,
      exhaustion: 0,
      casualties: 0,
      totalLosses: 0,
      air: Math.round((d.air ?? Math.min(40, gdp / 10)) / 12 * 10) / 10,
      drones: 0,
      missiles: 0,
      navy: d.nav ?? 0,
      nukes: d.nuk ?? 0,
      techTier: tech,
      ind: d.ind ?? 0.6,
      techs: [],
      research: [],
      queue: [],
      costFactor: 1,
      treasury: 0,
      mods: [],
      cooldowns: {},
      claims: {},
      justify: null,
      improving: {},
      sanctions: [],
      puppetOf: null,
      deploy: null,
      facBonus: 0,
      lastIncome: 0, lastExpense: 0,
      ai: { nextThink: 0, posture: 'peace', targets: [] },
      act: d.act ?? Math.min(400, pop * 1000 * 0.003),
      tk: d.tk,
    };
    if (!world.provinces[c.capital] || world.provinces[c.capital].tag !== tag) c.capital = (provByTag[tag] || [0])[0];
    // Kıyısı yoksa donanma yok
    const coastal = (provByTag[tag] || []).some((pid) => world.provinces[pid].coastal);
    if (d.nav === undefined) c.navy = coastal ? Math.round(Math.min(12, gdp / 40)) : 0;
    if (!coastal) c.navy = 0;
    s.countries[tag] = c;
  }

  assignColors(s, world, provByTag);

  // --- İller ---
  const P = s.prov;
  for (const p of world.provinces) {
    const c = s.countries[p.tag];
    P.owner[p.id] = p.tag; P.ctrl[p.id] = p.tag; P.core[p.id] = p.tag;
    P.pop[p.id] = c.basePop * 1e6 * p.popShare;
    P.gdp[p.id] = (COUNTRY_DATA[p.tag]?.gdp ?? Math.max(0.05, world.countryMeta[p.tag].gdp / 1000)) * p.gdpShare;
    P.infra[p.id] = p.terrain === 7 ? 3 : p.terrain === 0 ? 2 : 1;
  }
  // Fabrikalar
  for (const tag of tags) {
    const c = s.countries[tag];
    const gdp = COUNTRY_DATA[tag]?.gdp ?? world.countryMeta[tag].gdp / 1000;
    const total = Math.round(clamp(Math.sqrt(Math.max(0, gdp)) * c.ind / 2.2, gdp > 4 ? 1 : 0, 160));
    const list = (provByTag[tag] || []).map((pid) => ({ pid, w: world.provinces[pid].gdpShare }));
    const sumW = list.reduce((a, b) => a + b.w, 0) || 1;
    const alloc = list.map((x) => ({ pid: x.pid, q: total * x.w / sumW }));
    alloc.forEach((a) => { a.n = Math.floor(a.q); a.r = a.q - a.n; });
    let rem = total - alloc.reduce((a, b) => a + b.n, 0);
    alloc.sort((a, b) => b.r - a.r);
    for (let i = 0; i < alloc.length && rem > 0; i++, rem--) alloc[i].n++;
    for (const a of alloc) P.fac[a.pid] = a.n;
  }

  // --- Teknolojiler ---
  for (const tag of tags) {
    const c = s.countries[tag];
    const base = TIER_LEVELS[c.techTier] ?? 0;
    const over = TECH_OVERRIDES[tag] || {};
    for (const t of TECHS) {
      const lvl = over[t.branch] ?? base;
      if (t.level <= lvl) c.techs.push(t.id);
    }
    // Nükleer güçler nükleer programa sahiptir
    if (c.nukes > 0 && !c.techs.includes('str3')) { for (const id of ['str1', 'str2', 'str3']) if (!c.techs.includes(id)) c.techs.push(id); }
    if (c.techs.includes('art3')) c.missiles = Math.round(c.techTier * 15 + (tag === 'IRN' || tag === 'PRK' || tag === 'RUS' ? 60 : 0));
    if (c.techs.includes('air3')) c.drones = Math.round(24 * (c.techTier + (tag === 'TUR' || tag === 'UKR' || tag === 'IRN' ? 6 : 0)));
  }

  // --- İlişkiler ---
  for (const [a, b, v] of RELATION_OVERRIDES) {
    if (s.countries[a] && s.countries[b]) s.rel[pairKey(a, b)] = v;
  }

  // --- Antlaşmalar ---
  for (const [id, f] of Object.entries(FACTIONS)) {
    s.factions[id] = { id, name: f.name, full: f.full, leader: f.leader, defensive: f.defensive, color: f.color, members: f.members.filter((t) => s.countries[t]) };
  }
  for (const [a, b] of DEFENSE_PACTS) if (s.countries[a] && s.countries[b]) s.treaties.push({ t: 'defense', a, b, since: 0 });
  for (const [a, b] of GUARANTEES) if (s.countries[a] && s.countries[b]) s.treaties.push({ t: 'guarantee', a, b, since: 0 });
  // Faksiyon üyeleri arası askeri geçiş hakkı faksiyon üyeliğinden gelir; NATO-AB ülkeleri birbirine olumlu
  for (const f of Object.values(s.factions)) {
    for (const a of f.members) for (const b of f.members) {
      if (a < b && s.rel[pairKey(a, b)] === undefined) {
        const base = baseRelation(s.countries[a], s.countries[b]);
        s.rel[pairKey(a, b)] = clamp(base + 15, -100, 100);
      }
    }
  }

  // --- Senaryo savaşları ---
  for (const w of SCENARIO.wars) {
    const war = { id: s.nextWarId++, name: w.name, att: [...w.attackers], def: [...w.defenders], start: -365 * (2026 - w.startedYear), leadA: w.attackers[0], leadD: w.defenders[0], cas: {}, battles: {}, score: 0, scripted: true, lastChange: 0, cb: true };
    s.wars.push(war);
    for (const occ of w.occupied || []) {
      for (const p of world.provinces) {
        if (occ.provinceNames.includes(p.name) && w.defenders.includes(p.tag)) P.ctrl[p.id] = occ.by;
      }
    }
    // Cephe tahkimatları
    for (const p of world.provinces) {
      const own = P.owner[p.id];
      if (![...w.attackers, ...w.defenders].includes(P.ctrl[p.id])) continue;
      const ctrl = P.ctrl[p.id];
      const enemySide = w.attackers.includes(ctrl) ? w.defenders : w.attackers;
      const touches = world.adj[p.id].some((e) => !e.sea && enemySide.includes(P.ctrl[e.to]));
      if (touches) P.fort[p.id] = own === ctrl ? 4 : 3;
      else if (w.defenders.includes(own) && own === ctrl && world.adj[p.id].some((e) => !e.sea && world.adj[e.to].some((e2) => enemySide.includes(P.ctrl[e2.to])))) P.fort[p.id] = 2;
    }
  }

  // --- Ordular ---
  const atWarWith = (tag) => {
    const set = new Set();
    for (const w of s.wars) {
      if (w.att.includes(tag)) w.def.forEach((t) => set.add(t));
      if (w.def.includes(tag)) w.att.forEach((t) => set.add(t));
    }
    return set;
  };
  const relOf = (a, b) => s.rel[pairKey(a, b)] ?? baseRelation(s.countries[a], s.countries[b]);

  for (const tag of tags) {
    const c = s.countries[tag];
    const d = COUNTRY_DATA[tag] || {};
    const armyK = c.act * (LAND_SHARE[tag] ?? 0.65);
    let divs = armyK < 3 ? 0 : Math.max(1, Math.round(armyK / 16));
    divs = Math.min(divs, 75);
    const comp = [];
    if (divs > 0) {
      const tanks = d.tk ?? armyK * 3;
      let armor = Math.min(Math.round(tanks / 300), Math.round(divs * 0.28));
      let mech = Math.round(divs * (c.techTier >= 4 ? 0.28 : c.techTier === 3 ? 0.2 : c.techTier === 2 ? 0.1 : 0));
      let art = divs >= 6 ? Math.round(divs * 0.08) : 0;
      let mar = Math.min(MARINES[tag] || 0, Math.max(0, divs - 2));
      let sof = c.techTier >= 3 && divs >= 8 ? 1 + (divs >= 30 ? 1 : 0) : 0;
      let rest = divs - armor - mech - art - mar - sof;
      if (rest < 1) { mech = Math.max(0, mech + rest - 1); rest = divs - armor - mech - art - mar - sof; }
      let militia = c.techTier === 1 ? Math.round(rest * 0.3) : 0;
      const inf = Math.max(0, rest - militia);
      for (let i = 0; i < armor; i++) comp.push('armor');
      for (let i = 0; i < mech; i++) comp.push('mechanized');
      for (let i = 0; i < sof; i++) comp.push('special');
      for (let i = 0; i < art; i++) comp.push('artillery');
      for (let i = 0; i < mar; i++) comp.push('marines');
      for (let i = 0; i < inf; i++) comp.push('infantry');
      for (let i = 0; i < militia; i++) comp.push('militia');
    }

    // Yerleşim ağırlıkları
    const enemies = atWarWith(tag);
    const myProvs = (provByTag[tag] || []).filter((pid) => P.ctrl[pid] === tag);
    const weights = myProvs.map((pid) => {
      const wp = world.provinces[pid];
      let w = 1 + wp.popShare * 25;
      if (pid === c.capital) w += 4;
      let front = 0, rival = 0;
      for (const e of world.adj[pid]) {
        const ct = P.ctrl[e.to];
        if (ct === tag || e.sea) continue;
        if (enemies.has(ct)) front += 1;
        else if (relOf(tag, ct) < -30) rival += 1;
      }
      if (front) w += 40 + front * 10;
      if (rival) w += 5 + rival * 2;
      return { pid, w, marine: wp.coastal };
    });
    const sumW = weights.reduce((a, b) => a + b.w, 0) || 1;
    // En yüksek ağırlıklı illerden başlayarak dağıt
    weights.sort((a, b) => b.w - a.w);
    const quotas = weights.map((x) => ({ ...x, q: comp.length * x.w / sumW }));
    quotas.forEach((q) => { q.n = Math.floor(q.q); q.r = q.q - q.n; });
    let rem = comp.length - quotas.reduce((a, b) => a + b.n, 0);
    [...quotas].sort((a, b) => b.r - a.r).slice(0, rem).forEach((q) => q.n++);
    const slots = [];
    for (const q of quotas) for (let i = 0; i < q.n; i++) slots.push(q);
    // Zırhlılar önce en önemli illere
    comp.forEach((type, i) => {
      let slot = slots[i] || quotas[0];
      if (!slot) return;
      if (type === 'marines') { const coast = slots.find((x) => x.marine) || slot; slot = coast; }
      const ut = UNIT_TYPES[type];
      s.units.push({ id: s.nextUnitId++, o: tag, t: type, p: slot.pid, s: 1, g: ut.org / 100, x: 0.1, path: [], prog: 0, ent: 8, sup: true, b: 0 });
    });

    // Maliyet endeksi
    const budget = gdpOf(s, world, tag) * c.defPct / 100;
    let upkeep = 0;
    for (const t of comp) upkeep += UNIT_TYPES[t].upkeep;
    upkeep += c.air * 0.3 + c.navy * 0.07 + Math.min(c.nukes, 400) * 0.02;
    const pc = (gdpOf(s, world, tag) * 1e9) / Math.max(1, c.basePop * 1e6);
    c.costFactor = upkeep > 0.5 ? clamp((0.68 * budget) / upkeep, 0.05, 6) : clamp(pc / 45000, 0.15, 2);
    c.treasury = Math.max(0.05, budget * 0.25);
    c.research = [];
  }

  // --- Başlangıç yaptırımları ---
  const EU = ['AUT', 'BEL', 'BGR', 'HRV', 'CYP', 'CZE', 'DNK', 'EST', 'FIN', 'FRA', 'DEU', 'GRC', 'HUN', 'IRL', 'ITA', 'LVA', 'LTU', 'LUX', 'MLT', 'NLD', 'POL', 'PRT', 'ROU', 'SVK', 'SVN', 'ESP', 'SWE'];
  const SANCTIONS = {
    RUS: ['USA', 'GBR', 'CAN', 'JPN', 'AUS', 'NZL', 'NOR', 'CHE', ...EU],
    BLR: ['USA', 'GBR', 'CAN', ...EU],
    IRN: ['USA', 'GBR', 'CAN', ...EU],
    PRK: ['USA', 'KOR', 'JPN', 'AUS', ...EU],
    VEN: ['USA'], CUB: ['USA'],
  };
  for (const [t, by] of Object.entries(SANCTIONS)) if (s.countries[t]) s.countries[t].sanctions = by.filter((x) => s.countries[x]);

  s.rng = rng.s;
  return s;
}

export function gdpOf(s, world, tag) {
  let g = 0;
  for (let i = 0; i < world.n; i++) if (s.prov.owner[i] === tag) g += s.prov.gdp[i];
  return g;
}

export { CONSCRIPTION_LAWS };

// Komşu ülkelerin renkleri birbirinden ayırt edilebilir olsun
function hsl2hex(h, sat, l) {
  sat /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = sat * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const c = (x) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${c(f(0))}${c(f(8))}${c(f(4))}`;
}
const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const cdist = (a, b) => { const A = rgbOf(a), B = rgbOf(b); return Math.sqrt(2 * (A[0] - B[0]) ** 2 + 4 * (A[1] - B[1]) ** 2 + 3 * (A[2] - B[2]) ** 2); };
function assignColors(s, world, provByTag) {
  const nb = {};
  for (const [tag, list] of Object.entries(provByTag)) {
    const set = new Set();
    for (const pid of list) for (const e of world.adj[pid]) { const o = world.provinces[e.to].tag; if (o !== tag && (!e.sea || e.km < 250)) set.add(o); }
    nb[tag] = set;
  }
  const palette = [];
  for (let h = 0; h < 360; h += 12) for (const sat of [32, 45, 58]) for (const l of [42, 52, 62]) palette.push(hsl2hex(h, sat, l));
  const explicit = new Set(Object.keys(COUNTRY_DATA).filter((t) => COUNTRY_DATA[t].col));
  const order = Object.keys(s.countries).sort((a, b) => (provByTag[b]?.length || 0) - (provByTag[a]?.length || 0));
  const done = new Set([...explicit].filter((t) => s.countries[t]));
  for (const tag of order) {
    if (explicit.has(tag)) continue;
    const near = [...(nb[tag] || [])].filter((t) => done.has(t)).map((t) => s.countries[t].color);
    let best = s.countries[tag].color, bd = -1;
    const h0 = hashStr(tag) % palette.length;
    for (let i = 0; i < palette.length; i++) {
      const cand = palette[(i + h0) % palette.length];
      const d = near.length ? Math.min(...near.map((c) => cdist(c, cand))) : 999;
      if (d > bd + 25) { bd = d; best = cand; }
      if (bd > 260) break;
    }
    s.countries[tag].color = best;
    done.add(tag);
  }
}
