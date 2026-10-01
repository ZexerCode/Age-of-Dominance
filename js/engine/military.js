// Askeri sistem: yol bulma, hareket, muharebe, ikmal, işgal, stratejik saldırılar
import { UNIT_TYPES, TERRAINS } from '../data/rules.js';
import { clamp, haversine, MinHeap } from './util.js';
import { manpowerInfo } from './economy.js';

const SEA_TRANSPORT_SPEED = 380; // km/gün
const BASE_DAMAGE = 0.0026;

// Yerel garnizon (polis, jandarma, bölgesel savunma) gücü
export function garrisonPower(g, pid) {
  const P = g.s.prov;
  const ctrl = P.ctrl[pid];
  const c = g.C(ctrl);
  if (!c) return 0;
  const terr = TERRAINS[g.world.provinces[pid].terrain];
  const popF = 1 + Math.min(3, P.pop[pid] / 2.5e6);
  const home = P.core[pid] === ctrl ? 1 : 0.45;
  return 5 * popF * terr.def * (1 + 0.1 * (P.fort[pid] || 0)) * home * (0.8 + 0.1 * c.techTier) * (P.garr[pid] ?? 1);
}
const garrisonActive = (g, pid) => (g.s.prov.garr[pid] ?? 1) > 0.08;

// Muharebe genişliği: bir ilde aynı anda çarpışabilecek tümen sayısı
const WIDTH_TERRAIN = [2, 0, 0, -2, 1, -2, -2, -1, -1];
export function combatWidth(g, pid) {
  const P = g.s.prov;
  return Math.max(3, 5 + (P.infra[pid] || 1) + WIDTH_TERRAIN[g.world.provinces[pid].terrain]);
}

export function dailyMilitary(g) {
  updateSupply(g);
  moveAndEngage(g);
  resolveBattles(g);
  maintainUnits(g);
  airNavalWar(g);
}

// ---------------------------------------------------------------------------
// İkmal
// ---------------------------------------------------------------------------
export function friendlyTags(g, tag) {
  const set = new Set([tag]);
  for (const t of g.coBelligerents(tag)) set.add(t);
  for (const t of g.alliesOf(tag)) if (!g.atWar(tag, t)) set.add(t);
  for (const tr of g.s.treaties) if (tr.t === 'access' && (tr.a === tag || tr.b === tag)) set.add(tr.a === tag ? tr.b : tr.a);
  return set;
}
function navalOK(g, tag) {
  const c = g.C(tag);
  let mine = c.navy, enemy = 0;
  for (const t of g.coBelligerents(tag)) mine += g.C(t).navy * 0.5;
  for (const e of g.enemiesOf(tag)) enemy += g.C(e).navy;
  return mine > 0 && mine * 2.2 >= enemy;
}
export function supplyNetwork(g, tag) {
  const cached = g.supplyCache.get(tag);
  if (cached && cached.day === g.s.day) return cached.set;
  const W = g.world, P = g.s.prov;
  const friends = friendlyTags(g, tag);
  const set = new Uint8Array(W.n);
  const queue = [];
  const seed = (pid) => { if (pid >= 0 && !set[pid] && friends.has(P.ctrl[pid])) { set[pid] = 1; queue.push(pid); } };
  seed(g.C(tag).capital);
  for (const t of friends) if (t !== tag && g.C(t)?.alive) seed(g.C(t).capital);
  const sea = navalOK(g, tag);
  if (sea) {
    for (const pid of W.coastalList) if (P.ctrl[pid] === tag || (friends.has(P.ctrl[pid]) && P.owner[pid] === P.ctrl[pid])) seed(pid);
  }
  while (queue.length) {
    const a = queue.pop();
    for (const e of W.adj[a]) {
      if (set[e.to]) continue;
      if (e.sea && !sea) continue;
      if (!friends.has(P.ctrl[e.to])) continue;
      set[e.to] = 1;
      queue.push(e.to);
    }
  }
  g.supplyCache.set(tag, { day: g.s.day, set });
  return set;
}
function updateSupply(g) {
  const P = g.s.prov;
  for (const [tag, units] of g.unitsByOwner) {
    if (!units.length) continue;
    const atWar = g.isAtWar(tag);
    if (!atWar) {
      for (const u of units) u.sup = true;
      continue;
    }
    const net = supplyNetwork(g, tag);
    for (const u of units) {
      if (net[u.p]) { u.sup = true; continue; }
      let ok = false;
      if (!g.isFriendly(tag, P.ctrl[u.p])) {
        for (const e of g.world.adj[u.p]) if (!e.sea && net[e.to]) { ok = true; break; }
      }
      u.sup = ok;
    }
  }
}

// ---------------------------------------------------------------------------
// Yol bulma
// ---------------------------------------------------------------------------
function passable(g, tag, pid) {
  const ct = g.s.prov.ctrl[pid];
  return g.canPass(tag, ct);
}
function edgeCost(g, tag, e, P, hostileCost = true) {
  const t = TERRAINS[g.world.provinces[e.to].terrain];
  let c = e.km / (36 * t.speed);
  if (e.sea) c = e.km / 30 + 1.5;
  if (g.atWar(tag, P.ctrl[e.to])) {
    c += 1;
    if (hostileCost) {
      const hu = g.unitsAt(e.to);
      for (const u of hu) if (g.atWar(u.o, tag)) c += 4;
    }
  }
  return c;
}
// A* (karada ve kısa deniz geçişlerinde)
export function findLandPath(g, tag, from, to, maxNodes = 6000) {
  if (from === to) return [];
  const W = g.world, P = g.s.prov;
  if (!passable(g, tag, to)) return null;
  const tp = W.provinces[to];
  const h = (pid) => { const p = W.provinces[pid]; return haversine(p.lon, p.lat, tp.lon, tp.lat) / 60; };
  const gScore = new Map([[from, 0]]);
  const came = new Map();
  const open = new MinHeap();
  open.push(h(from), from);
  const closed = new Set();
  let expanded = 0;
  while (open.size) {
    const cur = open.pop();
    if (cur === to) break;
    if (closed.has(cur)) continue;
    closed.add(cur);
    if (++expanded > maxNodes) return null;
    const gc = gScore.get(cur);
    for (const e of W.adj[cur]) {
      if (closed.has(e.to)) continue;
      if (!passable(g, tag, e.to)) continue;
      const ng = gc + edgeCost(g, tag, e, P);
      if (ng < (gScore.get(e.to) ?? Infinity)) {
        gScore.set(e.to, ng);
        came.set(e.to, cur);
        open.push(ng + h(e.to), e.to);
      }
    }
  }
  if (!came.has(to)) return null;
  const path = [];
  for (let c = to; c !== from; c = came.get(c)) path.push(c);
  path.reverse();
  return path;
}
// Dijkstra: kaynaktan erişilebilen dost kıyı illeri (deniz nakliyesi için)
function reachableCoasts(g, tag, from, maxCost = 60) {
  const W = g.world, P = g.s.prov;
  const dist = new Map([[from, 0]]);
  const came = new Map();
  const open = new MinHeap();
  open.push(0, from);
  const coasts = [];
  while (open.size) {
    const cur = open.pop();
    const d = dist.get(cur);
    if (d > maxCost) break;
    if (W.provinces[cur].coastal && g.isFriendly(tag, P.ctrl[cur])) coasts.push({ pid: cur, cost: d });
    for (const e of W.adj[cur]) {
      if (!g.isFriendly(tag, P.ctrl[e.to])) continue;
      const nd = d + edgeCost(g, tag, e, P, false);
      if (nd < (dist.get(e.to) ?? Infinity)) { dist.set(e.to, nd); came.set(e.to, cur); open.push(nd, e.to); }
    }
  }
  const pathTo = (pid) => { const path = []; for (let c = pid; c !== from; c = came.get(c)) path.push(c); return path.reverse(); };
  return { coasts, pathTo };
}
export function hasSeaCapability(g, tag) {
  if (g.C(tag).navy > 0) return true;
  for (const t of g.coBelligerents(tag)) if (g.C(t).navy > 0) return true;
  for (const t of g.alliesOf(tag)) if (g.C(t).navy > 3) return true;
  return false;
}
export function findPath(g, tag, from, to) {
  if (from === to) return [];
  const W = g.world;
  const land = findLandPath(g, tag, from, to);
  const direct = W.distKm(from, to);
  const landOk = land && pathDays(g, tag, from, land) < Math.max(6, direct / 60 * 3);
  if (landOk) return land;
  if (!hasSeaCapability(g, tag)) return land;
  // Deniz nakliyesi
  let landing = to, tail = [];
  if (!W.provinces[to].coastal) {
    let best = null;
    for (const pid of W.coastalList) {
      if (!passable(g, tag, pid)) continue;
      const d = W.distKm(pid, to);
      if (d < 1500 && (!best || d < best.d)) best = { pid, d };
    }
    if (!best) return land;
    const t = findLandPath(g, tag, best.pid, to);
    if (!t) return land;
    landing = best.pid; tail = t;
  }
  if (!passable(g, tag, landing)) return land;
  const { coasts, pathTo } = reachableCoasts(g, tag, from);
  let best = null;
  for (const c of coasts) {
    if (c.pid === landing) continue;
    const cost = c.cost + W.seaKm(c.pid, landing) / SEA_TRANSPORT_SPEED + 2;
    if (!best || cost < best.cost) best = { pid: c.pid, cost };
  }
  if (!best) return land;
  const seaPath = [...pathTo(best.pid), landing, ...tail];
  if (land && pathDays(g, tag, from, land) <= best.cost + pathDays(g, tag, landing, tail)) return land;
  return seaPath;
}
export function pathDays(g, tag, from, path) {
  let d = 0, cur = from;
  for (const nxt of path) {
    const km = travelKm(g, cur, nxt);
    const e = g.world.adj[cur].find((x) => x.to === nxt);
    d += e ? km / (36 * TERRAINS[g.world.provinces[nxt].terrain].speed) : km / SEA_TRANSPORT_SPEED + 2;
    cur = nxt;
  }
  return d;
}
export function travelKm(g, a, b) {
  const km = g.world.edgeKm(a, b);
  if (km !== null) return km;
  return g.world.seaKm(a, b);
}
export function isSeaMove(g, a, b) {
  for (const e of g.world.adj[a]) if (e.to === b) return e.sea;
  return true;
}

// ---------------------------------------------------------------------------
// Emirler
// ---------------------------------------------------------------------------
export function orderMove(g, tag, unitIds, to) {
  const groups = new Map();
  for (const id of unitIds) {
    const u = g.unitById.get(id);
    if (!u || u.o !== tag) continue;
    if (!groups.has(u.p)) groups.set(u.p, []);
    groups.get(u.p).push(u);
  }
  let ok = 0, fail = 0;
  for (const [from, units] of groups) {
    const path = from === to ? [] : findPath(g, tag, from, to);
    for (const u of units) {
      if (path === null) { fail++; continue; }
      leaveBattleAsAttacker(g, u);
      const keepProg = u.path.length && path.length && u.path[0] === path[0];
      u.path = [...path];
      if (!keepProg) u.prog = 0;
      ok++;
    }
  }
  return { ok, fail };
}
export function stopUnits(g, tag, unitIds) {
  for (const id of unitIds) {
    const u = g.unitById.get(id);
    if (!u || u.o !== tag) continue;
    leaveBattleAsAttacker(g, u);
    u.path = []; u.prog = 0;
  }
}
function leaveBattleAsAttacker(g, u) {
  if (!u.b) return;
  const b = g.s.battles.find((x) => x.id === u.b);
  if (b) b.att = b.att.filter((id) => id !== u.id);
  u.b = 0;
}
export function disbandUnits(g, tag, unitIds) {
  for (const id of unitIds) {
    const u = g.unitById.get(id);
    if (!u || u.o !== tag) continue;
    leaveBattleAsAttacker(g, u);
    g.removeUnit(u);
  }
}

// ---------------------------------------------------------------------------
// Hareket
// ---------------------------------------------------------------------------
export function unitSpeed(g, u, next) {
  const ut = UNIT_TYPES[u.t];
  const c = g.C(u.o);
  const terr = TERRAINS[g.world.provinces[next].terrain];
  const infra = 1 + 0.08 * ((g.s.prov.infra[next] || 1) - 1);
  return ut.speed * terr.speed * infra * (1 + g.techSum(c, 'speed')) * (u.sup ? 1 : 0.6) * (0.55 + 0.45 * Math.min(1, u.g / (ut.org / 100)));
}

function moveAndEngage(g) {
  const s = g.s, P = s.prov;
  for (const u of s.units) {
    if (u.dead || !u.path.length) continue;
    const next = u.path[0];
    const ctrl = P.ctrl[next];
    if (!g.canPass(u.o, ctrl)) {
      u.path = []; u.prog = 0;
      if (g.isPlayer(u.o)) g.news(`${g.world.provinces[next].name}: ${g.C(ctrl).name} topraklarına geçiş izniniz yok. Birlik durdu.`, { type: 'mil', tags: [u.o], pid: next });
      continue;
    }
    // Hedefte düşman birlik ya da direnen garnizon var mı?
    let hostile = false, defOwner = null;
    for (const v of g.unitsAt(next)) if (g.atWar(v.o, u.o)) { hostile = true; defOwner = v.o; break; }
    if (!hostile && g.atWar(u.o, ctrl) && garrisonActive(g, next)) { hostile = true; defOwner = ctrl; }
    if (hostile) {
      let b = g.battleByProv.get(next);
      if (!b) {
        b = { id: s.nextBattleId++, p: next, att: [], start: s.day, attTag: u.o, defTag: defOwner, days: 0, ap: 0, dp: 0, lastAtt: 0, lastDef: 0, amph: false };
        s.battles.push(b);
        g.battleByProv.set(next, b);
        s.stats.battles++;
        g.emit('battle', b);
        if ((g.isPlayer(u.o) || g.isPlayer(defOwner)) && g.unitsAt(next).length) {
          g.news(`⚔️ ${g.world.provinces[next].name} muharebesi başladı (${g.C(u.o).name} ↔ ${g.C(defOwner).name}).`, { type: 'battle', tags: [u.o, defOwner], pid: next });
        }
      }
      if (g.atWar(u.o, b.attTag)) { u.path = []; continue; } // karşı taraf saldırıyor; burada savunmacı olamaz
      if (!b.att.includes(u.id)) { b.att.push(u.id); u.b = b.id; }
      if (isSeaMove(g, u.p, next)) b.amph = true;
      u.ent = 0;
      continue;
    }
    if (u.b) leaveBattleAsAttacker(g, u);
    const km = travelKm(g, u.p, next);
    const sea = isSeaMove(g, u.p, next);
    const speed = sea && g.world.edgeKm(u.p, next) === null ? SEA_TRANSPORT_SPEED : sea ? 220 : unitSpeed(g, u, next);
    u.prog += speed;
    u.ent = 0;
    if (sea) seaInterception(g, u);
    if (u.dead) continue;
    if (u.prog >= km) {
      u.prog = 0;
      u.path.shift();
      g.moveUnitTo(u, next);
      if (g.atWar(u.o, ctrl)) occupy(g, next, u.o);
    }
  }
}

function seaInterception(g, u) {
  let mine = g.C(u.o).navy, enemy = 0;
  for (const e of g.enemiesOf(u.o)) enemy += g.C(e).navy * (1 + g.techSum(g.C(e), 'naval_power'));
  if (enemy <= 0) return;
  for (const t of g.coBelligerents(u.o)) mine += g.C(t).navy * 0.6;
  const ratio = enemy / (enemy + mine * (1 + g.techSum(g.C(u.o), 'naval_power')));
  const loss = 0.025 * ratio * ratio;
  u.s -= loss; u.g -= loss * 2;
  if (u.s < 0.08) {
    killUnit(g, u, 'denizde batırıldı');
  }
}

export function occupy(g, pid, tag) {
  const P = g.s.prov;
  const owner = P.owner[pid];
  const prevCtrl = P.ctrl[pid];
  let newCtrl = tag;
  if (owner !== tag && (g.coBelligerents(tag).has(owner) || g.isAlly(tag, owner)) && !g.atWar(tag, owner)) newCtrl = owner; // kurtarma
  g.setController(pid, newCtrl);
  P.garr[pid] = 0.25;
  P.dev[pid] = Math.min(0.5, P.dev[pid] + 0.06);
  g.s.stats.provincesTaken++;
  const war = g.warBetween(tag, prevCtrl);
  if (war) war.lastChange = g.s.day;
  // Başkent düştü mü?
  const ownerC = g.C(owner);
  if (ownerC && ownerC.capital === pid && newCtrl !== owner) {
    g.news(`🏛️ ${ownerC.name} başkenti ${g.world.provinces[pid].name}, ${g.C(newCtrl).name} kuvvetlerinin eline geçti!`, { type: 'war', tags: [owner, newCtrl], pid, important: true });
    ownerC.stability = clamp(ownerC.stability - 15, 0, 100);
    ownerC.warSupport = clamp(ownerC.warSupport - 10, 0, 100);
    relocateCapital(g, owner);
  } else if (g.isPlayer(owner) && newCtrl !== owner) {
    g.news(`${g.world.provinces[pid].name} düşman işgaline uğradı!`, { type: 'war', tags: [owner, tag], pid });
  }
}

export function relocateCapital(g, tag) {
  const c = g.C(tag);
  const P = g.s.prov;
  let best = -1, bv = -1;
  for (const pid of g.ownedProvs.get(tag) || []) {
    if (P.ctrl[pid] !== tag) continue;
    const v = P.pop[pid] + P.gdp[pid] * 1e5;
    if (v > bv) { bv = v; best = pid; }
  }
  if (best >= 0 && best !== c.capital) {
    c.capitalOld = c.capitalOld ?? c.capital;
    c.capital = best;
    g.news(`${c.name} hükümeti ${g.world.provinces[best].name} şehrine taşındı.`, { type: 'war', tags: [tag], pid: best });
  }
}

// ---------------------------------------------------------------------------
// Muharebe
// ---------------------------------------------------------------------------
function techMul(g, c, ut, role) {
  const cls = ut.cls;
  let m = 1 + g.techSum(c, 'combat');
  if (cls === 'inf') m += g.techSum(c, role === 'atk' ? 'inf_atk' : 'inf_def');
  else if (cls === 'arm') m += g.techSum(c, role === 'atk' ? 'arm_atk' : 'arm_def');
  else if (cls === 'art') m += g.techSum(c, 'art_atk') * (role === 'atk' ? 1 : 0.5);
  return m;
}
const airCache = { day: -1, map: new Map() };
export function airShare(g, tagA, tagB) {
  if (airCache.day !== g.s.day) { airCache.day = g.s.day; airCache.map.clear(); }
  const key = `${tagA}>${tagB}`;
  if (airCache.map.has(key)) return airCache.map.get(key);
  const side = (tag) => {
    let v = 0;
    const c = g.C(tag);
    v += c.air * (1 + g.techSum(c, 'air_power'));
    for (const t of g.coBelligerents(tag)) { const o = g.C(t); v += o.air * (1 + g.techSum(o, 'air_power')) * 0.5; }
    return v;
  };
  const a = side(tagA), b = side(tagB);
  const r = a + b > 0 ? a / (a + b) : 0.5;
  airCache.map.set(key, r);
  return r;
}

function sidePower(g, units, role, b, opp) {
  const P = g.s.prov;
  const terr = TERRAINS[g.world.provinces[b.p].terrain];
  let total = 0, strSum = 0, hardSum = 0, apSum = 0;
  for (const u of units) {
    const ut = UNIT_TYPES[u.t];
    const c = g.C(u.o);
    let v = (role === 'atk' ? ut.atk : ut.def) * u.s * (0.25 + 0.75 * Math.min(1, u.g / (ut.org / 100)));
    v *= techMul(g, c, ut, role);
    v *= u.sup ? 1 : 0.6;
    v *= 1 + 0.3 * u.x;
    v *= g.diff(u.o).playerCombat;
    if (role === 'atk') {
      let tm = terr.atk * (ut.cls === 'arm' ? terr.armor : 1);
      if (ut.terrainExpert) tm = Math.max(tm, 0.85);
      v *= tm;
      if (b.amph && isSeaMove(g, u.p, b.p)) v *= (ut.amphibious ? 0.85 : 0.5) * (1 + g.techSum(c, 'amphib'));
    } else {
      v *= terr.def * 1.15;
      v *= 1 + 0.12 * (P.fort[b.p] || 0);
      v *= 1 + Math.min(10, u.ent) * 0.03 * (1 + g.techSum(c, 'entrench'));
    }
    total += v;
    strSum += u.s;
    hardSum += ut.hard * u.s;
    apSum += (ut.ap + (ut.cls === 'inf' ? g.techSum(c, 'inf_ap') : 0)) * u.s;
  }
  const lead = units[0];
  if (lead && opp[0]) {
    const share = airShare(g, lead.o, opp[0].o);
    total *= (0.88 + 0.24 * share) * (1 + g.techSum(g.C(lead.o), 'air_support') * (share - 0.5));
  }
  return { total, strSum, hard: strSum ? hardSum / strSum : 0, ap: strSum ? apSum / strSum : 0 };
}

function resolveBattles(g) {
  const s = g.s;
  const P = s.prov;
  const finished = [];
  for (const b of s.battles) {
    const attackers = b.att.map((id) => g.unitById.get(id)).filter((u) => u && !u.dead && u.path[0] === b.p);
    b.att = attackers.map((u) => u.id);
    const attTag = attackers[0]?.o || b.attTag;
    const defenders = g.unitsAt(b.p).filter((v) => !v.dead && g.atWar(v.o, attTag));
    const garrOn = g.atWar(attTag, P.ctrl[b.p]) && garrisonActive(g, b.p);
    if (!attackers.length || (!defenders.length && !garrOn)) {
      if (attackers.length) for (const u of attackers) { u.b = 0; u.prog = Math.max(u.prog, travelKm(g, u.p, b.p) * 0.6); }
      finished.push(b);
      continue;
    }
    b.days++;
    b.attTag = attTag;
    b.defTag = defenders[0]?.o || P.ctrl[b.p];
    // Muharebe genişliği: en güçlü birlikler cepheye, diğerleri yedekte
    const dirsAll = new Set(attackers.map((u) => u.p)).size;
    const width = combatWidth(g, b.p);
    const wA = width + 2 * (dirsAll - 1);
    const pw = (u, k) => UNIT_TYPES[u.t][k] * u.s * (0.3 + u.g);
    const fightA = attackers.length > wA ? [...attackers].sort((x, y) => pw(y, 'atk') - pw(x, 'atk')).slice(0, wA) : attackers;
    const fightD = defenders.length > width ? [...defenders].sort((x, y) => pw(y, 'def') - pw(x, 'def')).slice(0, width) : defenders;
    b.width = width; b.fa = fightA.length; b.fd = fightD.length;
    const A = sidePower(g, fightA, 'atk', b, fightD.length ? fightD : [{ o: b.defTag }]);
    const D = fightD.length ? sidePower(g, fightD, 'def', b, fightA) : { total: 0, strSum: 0, hard: 0, ap: 0.2 };
    const gp = garrOn ? garrisonPower(g, b.p) * (defenders.length ? 0.5 : 1) : 0;
    D.total += gp;
    if (!defenders.length) D.strSum = 1;
    // çok yönlü saldırı bonusu
    const dirs = new Set(fightA.map((u) => u.p)).size;
    A.total *= 1 + Math.min(0.3, 0.1 * (dirs - 1));
    // zırh/delme etkisi
    const pfOnDef = 1 - D.hard * (1 - A.ap) * 0.6;
    const pfOnAtt = 1 - A.hard * (1 - D.ap) * 0.6;
    const dmgToDef = BASE_DAMAGE * A.total * pfOnDef / Math.max(0.5, D.strSum);
    const dmgToAtt = BASE_DAMAGE * D.total * pfOnAtt / Math.max(0.5, A.strSum);
    b.ap = A.total; b.dp = D.total;
    let lossA = 0, lossD = 0;
    for (const v of fightD) {
      const r = g.rng.range(0.8, 1.2);
      v.g -= dmgToDef * r;
      const sl = dmgToDef * r * 0.24;
      v.s -= sl;
      lossD += applyCasualty(g, v, sl, b);
      v.x = Math.min(1, v.x + 0.003);
    }
    for (const u of fightA) {
      const r = g.rng.range(0.8, 1.2);
      u.g -= dmgToAtt * r;
      const sl = dmgToAtt * r * 0.24;
      u.s -= sl;
      lossA += applyCasualty(g, u, sl, b);
      u.x = Math.min(1, u.x + 0.003);
    }
    b.lastAtt = lossA; b.lastDef = lossD;
    // ölü birlikler
    for (const v of defenders) if (v.s < 0.06) killUnit(g, v, 'muharebede imha edildi');
    for (const u of attackers) if (u.s < 0.06) killUnit(g, u, 'muharebede imha edildi');
    if (garrOn) P.garr[b.p] = Math.max(0, (P.garr[b.p] ?? 1) - dmgToDef * (defenders.length ? 0.6 : 1) * 1.1);
    const liveD = defenders.filter((v) => !v.dead);
    const liveA = attackers.filter((u) => !u.dead);
    const orgOf = (list) => { let o = 0, w = 0; for (const x of list) { const m = UNIT_TYPES[x.t].org / 100; o += (x.g / m) * x.s; w += x.s; } return w ? o / w : 0; };
    const dOrg = liveD.length ? orgOf(liveD) : 1;
    const aOrg = orgOf(liveA);
    if (!liveD.length && !garrisonActive(g, b.p)) {
      // garnizon dağıtıldı
      for (const u of liveA) { u.b = 0; u.prog = Math.max(u.prog, travelKm(g, u.p, b.p) * 0.6); }
      finished.push(b);
    } else if (liveD.length && dOrg < 0.12) {
      // savunma çöktü
      for (const v of liveD) retreat(g, v, b, liveA);
      for (const u of liveA) { u.b = 0; u.prog = Math.max(u.prog, travelKm(g, u.p, b.p) * 0.6); }
      battleNews(g, b, attTag, b.defTag, true);
      finished.push(b);
    } else if (!liveA.length || aOrg < 0.12) {
      for (const u of liveA) { u.path = []; u.prog = 0; u.b = 0; }
      battleNews(g, b, attTag, b.defTag, false);
      finished.push(b);
    }
  }
  for (const b of finished) {
    const i = s.battles.indexOf(b);
    if (i >= 0) s.battles.splice(i, 1);
    g.battleByProv.delete(b.p);
    for (const id of b.att) { const u = g.unitById.get(id); if (u && u.b === b.id) u.b = 0; }
  }
}

function applyCasualty(g, u, strLoss, b) {
  const ut = UNIT_TYPES[u.t];
  const men = strLoss * ut.mp; // bin kişi
  const c = g.C(u.o);
  c.casualties += men;
  c.totalLosses += men;
  const mp = manpowerInfoCached(g, u.o);
  c.exhaustion = clamp(c.exhaustion + men / Math.max(60, mp) * 160, 0, 100);
  const war = g.warBetween(b.attTag, b.defTag);
  if (war) war.cas[u.o] = (war.cas[u.o] || 0) + men;
  return men;
}
const mpCache = { day: -1, map: new Map() };
function manpowerInfoCached(g, tag) {
  if (mpCache.day !== g.s.day) { mpCache.day = g.s.day; mpCache.map.clear(); }
  if (!mpCache.map.has(tag)) mpCache.map.set(tag, manpowerInfo(g, tag).max);
  return mpCache.map.get(tag);
}

function battleNews(g, b, attTag, defTag, attackerWon) {
  const pname = g.world.provinces[b.p].name;
  if (g.isPlayer(attTag) || g.isPlayer(defTag)) {
    const playerWon = (attackerWon && g.isPlayer(attTag)) || (!attackerWon && g.isPlayer(defTag));
    g.news(`${playerWon ? '✅' : '❌'} ${pname} muharebesi: ${attackerWon ? `${g.C(attTag).name} savunmayı yardı` : `${g.C(defTag).name} saldırıyı püskürttü`}.`, { type: playerWon ? 'victory' : 'defeat', tags: [attTag, defTag], pid: b.p });
  }
  const war = g.warBetween(attTag, defTag);
  if (war) {
    war.battles = war.battles || {};
    const winner = attackerWon ? attTag : defTag;
    war.battles[winner] = (war.battles[winner] || 0) + 1;
  }
}

function retreat(g, v, b, attackers) {
  const P = g.s.prov;
  const W = g.world;
  const origins = new Set(attackers.map((u) => u.p));
  let best = -1, bestScore = -Infinity;
  for (const e of W.adj[b.p]) {
    if (e.sea) continue;
    const ct = P.ctrl[e.to];
    if (!g.isFriendly(v.o, ct)) continue;
    if (origins.has(e.to)) continue;
    let hostile = false;
    for (const x of g.unitsAt(e.to)) if (g.atWar(x.o, v.o)) { hostile = true; break; }
    if (hostile) continue;
    let score = 0;
    for (const x of g.unitsAt(e.to)) if (x.o === v.o) score += 2;
    if (ct === v.o) score += 3;
    for (const o of origins) score += W.distKm(e.to, o) / 300;
    if (g.battleByProv.has(e.to)) score -= 2;
    if (score > bestScore) { bestScore = score; best = e.to; }
  }
  if (best < 0) {
    killUnit(g, v, 'kuşatıldı ve teslim oldu');
    return;
  }
  v.path = []; v.prog = 0; v.ent = 0;
  v.g = Math.max(0.02, v.g);
  g.moveUnitTo(v, best);
}

export function killUnit(g, u, why) {
  if (u.dead) return;
  const ut = UNIT_TYPES[u.t];
  const c = g.C(u.o);
  const men = u.s * ut.mp;
  c.casualties += men * 0.6;
  c.totalLosses += men;
  if (g.isPlayer(u.o)) g.news(`💀 ${ut.name} (${g.world.provinces[u.p].name}) ${why}.`, { type: 'defeat', tags: [u.o], pid: u.p });
  g.removeUnit(u);
}

// ---------------------------------------------------------------------------
// Birlik bakımı
// ---------------------------------------------------------------------------
function maintainUnits(g) {
  const s = g.s, P = s.prov;
  const garr = P.garr;
  for (let i = 0; i < garr.length; i++) if (garr[i] < 1 && !g.battleByProv.has(i)) garr[i] = Math.min(1, garr[i] + (P.core[i] === P.ctrl[i] ? 0.012 : 0.006));
  const inBattle = new Set();
  for (const b of s.battles) {
    for (const id of b.att) inBattle.add(id);
    for (const v of g.unitsAt(b.p)) inBattle.add(v.id);
  }
  const mpOk = new Map();
  for (const u of s.units) {
    if (u.dead) continue;
    const ut = UNIT_TYPES[u.t];
    const c = g.C(u.o);
    const maxOrg = (ut.org / 100) * (1 + g.techSum(c, 'org') + g.law(c).org);
    if (!inBattle.has(u.id)) {
      if (u.sup) u.g = Math.min(maxOrg, u.g + 0.055 * (1 + g.techSum(c, 'recovery')));
      else u.g = Math.max(0.03, u.g - 0.012);
      if (u.sup && u.s < 1 && c.treasury > 0) {
        let ok = mpOk.get(u.o);
        if (ok === undefined) { ok = manpowerInfo(g, u.o).available > 0; mpOk.set(u.o, ok); }
        if (ok) {
          const add = Math.min(0.015, 1 - u.s);
          u.s += add;
          c.treasury -= add * ut.cost * c.costFactor * 0.4;
        }
      }
      if (!u.path.length) u.ent = Math.min(10, u.ent + 1);
    }
    if (!u.sup) {
      u.s -= 0.004;
      const terr = TERRAINS[g.world.provinces[u.p].terrain];
      u.s -= terr.attrition;
      if (u.s < 0.06) killUnit(g, u, 'ikmalsizlik nedeniyle dağıldı');
    }
    if (u.g > maxOrg) u.g = maxOrg;
    if (u.g < 0) u.g = 0;
  }
}

// ---------------------------------------------------------------------------
// Hava ve deniz yıpranması
// ---------------------------------------------------------------------------
function airNavalWar(g) {
  for (const w of g.s.wars) {
    if (w.ended) continue;
    const side = (list, key, techKey) => list.reduce((a, t) => a + g.C(t)[key] * (1 + g.techSum(g.C(t), techKey)), 0);
    const aAir = side(w.att, 'air', 'air_power'), dAir = side(w.def, 'air', 'air_power');
    const aNav = side(w.att, 'navy', 'naval_power'), dNav = side(w.def, 'navy', 'naval_power');
    const hit = (list, mine, enemy, key, rate) => {
      if (enemy <= 0 || mine <= 0) return;
      const ratio = enemy / (enemy + mine);
      for (const t of list) {
        const c = g.C(t);
        c[key] = Math.max(0, c[key] - c[key] * rate * ratio);
      }
    };
    hit(w.att, aAir, dAir, 'air', 0.0016);
    hit(w.def, dAir, aAir, 'air', 0.0016);
    hit(w.att, aNav, dNav, 'navy', 0.0006);
    hit(w.def, dNav, aNav, 'navy', 0.0006);
  }
}

// ---------------------------------------------------------------------------
// Stratejik saldırılar: füze, SİHA, nükleer
// ---------------------------------------------------------------------------
function nearestOwnKm(g, tag, pid) {
  const W = g.world;
  const t = W.provinces[pid];
  let best = Infinity;
  for (const q of g.ctrlProvs.get(tag) || []) {
    const p = W.provinces[q];
    const d = haversine(p.lon, p.lat, t.lon, t.lat);
    if (d < best) best = d;
  }
  return best;
}
export function missileRange(g, tag) { return g.techMax(g.C(tag), 'missile_range'); }
export function droneRange(g, tag) { const c = g.C(tag); return g.hasTech(c, 'air3') ? (g.hasTech(c, 'air5') ? 700 : 400) : 0; }

export function canStrike(g, tag, pid, kind) {
  const c = g.C(tag);
  const target = g.s.prov.ctrl[pid];
  if (!g.atWar(tag, target)) return { ok: false, why: 'Bu ile saldırmak için hedefle savaşta olmalısınız' };
  const dist = nearestOwnKm(g, tag, pid);
  if (kind === 'missile') {
    const r = missileRange(g, tag);
    if (!r) return { ok: false, why: 'Hassas Güdümlü Mühimmat teknolojisi gerekir' };
    if (c.missiles < 10) return { ok: false, why: 'Füze stoku yetersiz (10 gerekli)' };
    if (dist > r) return { ok: false, why: `Menzil dışında (${Math.round(dist)} km > ${r} km)` };
  } else if (kind === 'drone') {
    const r = droneRange(g, tag);
    if (!r) return { ok: false, why: 'SİHA teknolojisi gerekir' };
    if (c.drones < 6) return { ok: false, why: 'SİHA sayısı yetersiz' };
    if (dist > r) return { ok: false, why: `Menzil dışında (${Math.round(dist)} km > ${r} km)` };
  } else if (kind === 'nuke') {
    if (c.nukes < 1) return { ok: false, why: 'Nükleer başlık yok' };
  }
  return { ok: true };
}

function interceptChance(g, targetTag, attackerTag, base) {
  const def = g.techSum(g.C(targetTag), 'missile_def');
  const pen = g.techSum(g.C(attackerTag), 'missile_pen');
  return clamp(base + def - pen, 0, 0.7);
}

export function missileStrike(g, tag, pid) {
  const chk = canStrike(g, tag, pid, 'missile');
  if (!chk.ok) return chk;
  const c = g.C(tag);
  const target = g.s.prov.ctrl[pid];
  c.missiles -= 10;
  c.treasury -= 0.05 * c.costFactor;
  const pname = g.world.provinces[pid].name;
  if (g.rng.chance(interceptChance(g, target, tag, 0.05))) {
    g.news(`🛡️ ${g.C(target).name} hava savunması ${pname} üzerine atılan füzeleri önledi.`, { type: 'mil', tags: [tag, target], pid });
    return { ok: true, intercepted: true };
  }
  const power = 1 + g.techSum(c, 'missile_power');
  const units = g.unitsAt(pid).filter((u) => g.atWar(u.o, tag));
  for (const u of units.slice(0, 6)) {
    u.g -= 0.18 * power; u.s -= 0.035 * power;
    applyCasualty(g, u, 0.035 * power, { attTag: tag, defTag: u.o });
    if (u.s < 0.06) killUnit(g, u, 'füze saldırısında imha edildi');
  }
  const P = g.s.prov;
  if (P.fac[pid] > 0 && g.rng.chance(0.3 * power)) P.fac[pid]--;
  P.dev[pid] = Math.min(0.6, P.dev[pid] + 0.04 * power);
  P.garr[pid] = Math.max(0, (P.garr[pid] ?? 1) - 0.1 * power);
  g.C(target).warSupport = clamp(g.C(target).warSupport - 0.5, 0, 100);
  g.news(`🚀 ${c.name}, ${pname} bölgesine balistik füze saldırısı düzenledi.`, { type: 'strike', tags: [tag, target], pid });
  g.emit('strike', { kind: 'missile', pid, tag });
  return { ok: true };
}

export function droneStrike(g, tag, pid) {
  const chk = canStrike(g, tag, pid, 'drone');
  if (!chk.ok) return chk;
  const c = g.C(tag);
  const target = g.s.prov.ctrl[pid];
  const share = airShare(g, tag, target);
  const lost = Math.round(6 * (1 - share) * g.rng.range(0.2, 0.8));
  c.drones -= Math.max(1, lost);
  const power = 1 + g.techSum(c, 'drone_power');
  const units = g.unitsAt(pid).filter((u) => g.atWar(u.o, tag));
  const pname = g.world.provinces[pid].name;
  for (const u of units.slice(0, 4)) {
    const armorBonus = UNIT_TYPES[u.t].cls === 'arm' ? 1.3 : 1;
    u.g -= 0.12 * power * armorBonus; u.s -= 0.02 * power * armorBonus;
    applyCasualty(g, u, 0.02 * power, { attTag: tag, defTag: u.o });
    if (u.s < 0.06) killUnit(g, u, 'SİHA saldırısında imha edildi');
  }
  if (!units.length) g.s.prov.garr[pid] = Math.max(0, (g.s.prov.garr[pid] ?? 1) - 0.08 * power);
  g.news(`🛩️ ${c.name} SİHA'ları ${pname} bölgesindeki ${units.length ? 'düşman birliklerini' : 'hedefleri'} vurdu${lost ? ` (${lost} SİHA kaybı)` : ''}.`, { type: 'strike', tags: [tag, target], pid });
  g.emit('strike', { kind: 'drone', pid, tag });
  return { ok: true };
}

export function nuclearStrike(g, tag, pid) {
  const chk = canStrike(g, tag, pid, 'nuke');
  if (!chk.ok) return chk;
  const s = g.s, P = s.prov;
  const c = g.C(tag);
  const target = P.ctrl[pid];
  const tc = g.C(target);
  c.nukes -= 1;
  s.nukesUsed++;
  s.worldTension = 100;
  const pname = g.world.provinces[pid].name;
  if (g.rng.chance(interceptChance(g, target, tag, 0) * 0.6)) {
    g.news(`☢️🛡️ ${c.name} ${pname} hedefine nükleer füze fırlattı, ancak ${tc.name} füze kalkanı başlığı imha etti!`, { type: 'nuke', tags: [tag, target], pid, important: true });
    nuclearDiplomacy(g, tag, 0.6);
    g.emit('strike', { kind: 'nuke', pid, tag, intercepted: true });
    return { ok: true, intercepted: true };
  }
  for (const u of [...g.unitsAt(pid)]) {
    u.s -= 0.85; u.g = 0;
    if (u.s < 0.06) killUnit(g, u, 'nükleer saldırıda yok oldu');
  }
  for (const e of g.world.adj[pid]) {
    if (e.sea) continue;
    for (const u of [...g.unitsAt(e.to)]) { u.s -= 0.2; u.g -= 0.4; if (u.s < 0.06) killUnit(g, u, 'nükleer serpintide yok oldu'); }
    P.pop[e.to] *= 0.95; P.dev[e.to] = Math.min(0.8, P.dev[e.to] + 0.2);
  }
  const deaths = P.pop[pid] * 0.3;
  P.pop[pid] *= 0.7;
  P.gdp[pid] *= 0.5;
  P.dev[pid] = 0.95;
  P.fac[pid] = Math.floor(P.fac[pid] * 0.3);
  P.garr[pid] = 0;
  P.nuked = P.nuked || {};
  P.nuked[pid] = s.day;
  tc.stability = clamp(tc.stability - 20, 0, 100);
  tc.warSupport = clamp(tc.warSupport + (tc.nukes > 0 ? 10 : -25), 0, 100);
  c.stability = clamp(c.stability - 10, 0, 100);
  g.news(`☢️ NÜKLEER SALDIRI! ${c.name}, ${tc.name} topraklarındaki ${pname} bölgesini vurdu. Tahmini kayıp: ${Math.round(deaths / 1000)} bin kişi.`, { type: 'nuke', tags: [tag, target], pid, important: true });
  nuclearDiplomacy(g, tag, 1);
  g.emit('strike', { kind: 'nuke', pid, tag });
  // Misilleme (yapay zekâ)
  if (tc.nukes > 0 && !g.isPlayer(target) && g.rng.chance(0.75)) (s.retaliate ||= []).push({ by: target, target: tag });
  for (const a of g.alliesOf(target)) {
    const ac = g.C(a);
    if (ac?.nukes > 0 && !g.isPlayer(a) && g.atWar(a, tag) && g.rng.chance(0.3)) (s.retaliate ||= []).push({ by: a, target: tag });
  }
  // Küresel nükleer kış
  if (s.nukesUsed === 15) {
    g.news('🌫️ Kullanılan nükleer silahlar küresel bir "nükleer kış" başlattı. Dünya ekonomisi çöküyor.', { type: 'nuke', tags: [], important: true });
    for (const o of Object.values(s.countries)) if (o.alive) g.addMod(o, 'growth', -4, 730, 'Nükleer kış');
  }
  return { ok: true };
}
function nuclearDiplomacy(g, tag, k) {
  for (const o of Object.values(g.s.countries)) {
    if (!o.alive || o.tag === tag) continue;
    g.addRel(o.tag, tag, -60 * k);
  }
}
