// Diplomasi: savaş, barış, antlaşmalar, ilişkiler, teslim olma
import { GOVERNMENTS } from '../data/rules.js';
import { clamp, pairKey } from './util.js';
import { countryValue, provinceValue, countryGdp } from './economy.js';
import { relocateCapital } from './military.js';
import { RESERVES } from './setup.js';

const MAJOR = new Set(['USA', 'CHN', 'RUS', 'IND', 'GBR', 'FRA', 'DEU', 'JPN']);

// ---------------------------------------------------------------------------
// Savaş ilanı
// ---------------------------------------------------------------------------
export function canDeclareWar(g, att, def) {
  if (att === def) return { ok: false, why: 'Kendinize savaş açamazsınız' };
  const a = g.C(att), d = g.C(def);
  if (!a?.alive || !d?.alive) return { ok: false, why: 'Geçersiz ülke' };
  if (g.atWar(att, def)) return { ok: false, why: 'Zaten savaştasınız' };
  if (g.isAlly(att, def)) return { ok: false, why: 'Müttefikinize savaş açamazsınız (önce ittifaktan çıkın)' };
  if (a.puppetOf === def || d.puppetOf === att) return { ok: false, why: 'Kukla ilişkisi var' };
  if (a.puppetOf) return { ok: false, why: 'Kukla devletler bağımsız savaş ilan edemez' };
  return { ok: true };
}

export function warDeclarationCost(g, att, def) {
  const a = g.C(att);
  const hasCB = (a.claims[def] && a.claims[def] > g.s.day) || hasCoreClaim(g, att, def);
  const gov = GOVERNMENTS[a.gov];
  return { hasCB, stability: Math.round(gov.warDeclStab * (hasCB ? 0.35 : 1)), nap: g.hasTreaty('nap', att, def) };
}
function hasCoreClaim(g, att, def) {
  const P = g.s.prov;
  for (const pid of g.ownedProvs.get(def) || []) if (P.core[pid] === att) return true;
  for (const pid of g.ctrlProvs.get(def) || []) if (P.owner[pid] === att) return true;
  return false;
}

export function declareWar(g, att, def, opts = {}) {
  const chk = canDeclareWar(g, att, def);
  if (!chk.ok) return chk;
  const s = g.s;
  const a = g.C(att), d = g.C(def);
  const cost = warDeclarationCost(g, att, def);
  // Saldırmazlık paktı bozuluyor
  if (cost.nap) {
    removeTreaty(g, 'nap', att, def);
    a.stability = clamp(a.stability - 10, 0, 100);
    for (const o of Object.values(s.countries)) if (o.alive && o.tag !== att) g.addRel(o.tag, att, -8);
  }
  removeTreaty(g, 'access', att, def);
  const war = {
    id: s.nextWarId++, name: opts.name || `${a.short}–${d.short} Savaşı`, att: [att], def: [def], start: s.day,
    leadA: att, leadD: def, cas: {}, battles: {}, lastChange: s.day, cb: cost.hasCB,
  };
  s.wars.push(war);
  g.rebuildWars();
  a.stability = clamp(a.stability + cost.stability, 0, 100);
  d.warSupport = clamp(d.warSupport + 15, 0, 100);
  g.setRel(att, def, Math.min(g.rel(att, def), -80));
  for (const o of Object.values(s.countries)) {
    if (!o.alive || o.tag === att || o.tag === def) continue;
    const r = g.rel(o.tag, def);
    if (r > 20) g.addRel(o.tag, att, -(r / 100) * (cost.hasCB ? 8 : 22));
  }
  s.worldTension = clamp(s.worldTension + 4 + (MAJOR.has(att) || MAJOR.has(def) ? 10 : 0), 0, 100);
  g.news(`🔥 ${a.name}, ${d.name}'na savaş ilan etti!${cost.hasCB ? '' : ' (Haklı bir gerekçe olmadan)'}`, { type: 'war', tags: [att, def], important: true });
  relocateForeignUnits(g, war);
  mobilizeReserves(g, def);
  // Müttefik çağrısı
  callAllies(g, war, def, 'def');
  callAllies(g, war, att, 'att');
  g.emit('war', war);
  return { ok: true, war };
}

function callAllies(g, war, tag, side) {
  const s = g.s;
  const other = side === 'def' ? war.att : war.def;
  const cands = new Map();
  const f = g.factionOf.get(tag);
  for (const t of s.treaties) {
    if (side === 'def') {
      if ((t.t === 'defense' || t.t === 'alliance') && (t.a === tag || t.b === tag)) cands.set(t.a === tag ? t.b : t.a, t.t === 'alliance' ? 0.88 : 0.82);
      if (t.t === 'guarantee' && t.b === tag) cands.set(t.a, Math.max(cands.get(t.a) || 0, 0.72));
    } else if (t.t === 'alliance' && (t.a === tag || t.b === tag)) cands.set(t.a === tag ? t.b : t.a, 0.45);
  }
  if (f && (side === 'def' || !s.factions[f].defensive)) {
    for (const m of s.factions[f].members) if (m !== tag) cands.set(m, Math.max(cands.get(m) || 0, side === 'def' ? 0.93 : 0.35));
  }
  for (const o of Object.values(s.countries)) {
    if (!o.alive) continue;
    if (o.puppetOf === tag) cands.set(o.tag, 1);
    if (g.C(tag).puppetOf === o.tag && side === 'def') cands.set(o.tag, 0.95);
  }
  for (const [ally, base] of cands) {
    const c = g.C(ally);
    if (!c?.alive || war.att.includes(ally) || war.def.includes(ally)) continue;
    // Karşı tarafla müttefikse katılmaz
    if (other.some((t) => g.isAlly(ally, t))) continue;
    if (g.isPlayer(ally)) {
      s.pending.push({
        kind: 'callToArms', id: s.newsSeq++, warId: war.id, ally: tag, side, day: s.day,
        title: 'Müttefik Çağrısı',
        text: `${g.C(tag).name} ${side === 'def' ? 'saldırıya uğradı' : 'savaşa giriyor'} ve sizi yardıma çağırıyor: ${war.name}. Savaşa katılacak mısınız?`,
      });
      g.emit('pending');
      continue;
    }
    let p = base;
    const enemyLead = side === 'def' ? war.leadA : war.leadD;
    const rEnemy = g.rel(ally, enemyLead), rFriend = g.rel(ally, tag);
    p += (rFriend - rEnemy) / 400;
    if (rEnemy > 40) p -= 0.3;
    // Nükleer güce karşı savaşa girmek daha az olası (savunma dışında)
    if (g.C(enemyLead).nukes > 0 && side === 'att') p -= 0.25;
    if (g.rng.chance(clamp(p, 0, 1))) joinWar(g, war, ally, side);
    else {
      g.addRel(ally, tag, -25);
      if (g.involvesPlayer([tag, ...other])) g.news(`${c.name} müttefikinin çağrısına yanıt vermedi ve tarafsız kaldı.`, { type: 'diplo', tags: [ally, tag] });
    }
  }
}

export function joinWar(g, war, tag, side) {
  if (war.ended || war.att.includes(tag) || war.def.includes(tag)) return;
  const list = side === 'def' ? war.def : war.att;
  const other = side === 'def' ? war.att : war.def;
  for (const t of other) removeTreaty(g, 'nap', tag, t), removeTreaty(g, 'access', tag, t);
  list.push(tag);
  g.rebuildWars();
  for (const t of other) g.setRel(tag, t, Math.min(g.rel(tag, t), -60));
  g.C(tag).warSupport = clamp(g.C(tag).warSupport + 5, 0, 100);
  g.news(`⚔️ ${g.C(tag).name}, ${war.name} savaşına ${side === 'def' ? 'savunan' : 'saldıran'} tarafta katıldı.`, { type: 'war', tags: [tag, ...other], important: g.involvesPlayer([...war.att, ...war.def]) });
  relocateForeignUnits(g, war);
  if (side === 'def') mobilizeReserves(g, tag);
  g.emit('war', war);
}

// Yedeklerin seferberliği: saldırıya uğrayan ülke yedek tümenlerini silah altına alır
export function mobilizeReserves(g, tag) {
  const c = g.C(tag);
  if (!c?.alive) return;
  if ((c.reservesUsed ?? -9999) > g.s.day - 1095) return;
  const k = RESERVES[tag] ?? 0;
  const n = Math.min(24, Math.floor(k / 18));
  if (n <= 0) return;
  c.reservesUsed = g.s.day;
  const P = g.s.prov;
  const provs = (g.ownedProvs.get(tag) || []).filter((pid) => P.ctrl[pid] === tag);
  if (!provs.length) return;
  provs.sort((a, b) => P.pop[b] - P.pop[a]);
  for (let i = 0; i < n; i++) g.addUnit(tag, c.techTier >= 3 ? 'infantry' : 'militia', provs[i % Math.min(provs.length, 6)], { g: 0.25, s: 0.85 });
  c.warSupport = clamp(c.warSupport + 8, 0, 100);
  g.news(`🎖️ ${c.name} genel seferberlik ilan etti: ${n} yedek tümen silah altına alındı.`, { type: 'mil', tags: [tag], important: g.isPlayer(tag) });
}

// Savaş başında düşman topraklarındaki birlikleri geri çek
function relocateForeignUnits(g, war) {
  const P = g.s.prov;
  for (const u of g.s.units) {
    if (u.dead) continue;
    const ct = P.ctrl[u.p];
    if (!g.atWar(u.o, ct)) continue;
    const pid = nearestFriendly(g, u.o, u.p);
    u.path = []; u.prog = 0;
    if (pid >= 0) g.moveUnitTo(u, pid);
    else g.removeUnit(u);
  }
}
function nearestFriendly(g, tag, from) {
  const P = g.s.prov, W = g.world;
  const seen = new Set([from]);
  let frontier = [from];
  for (let depth = 0; depth < 40 && frontier.length; depth++) {
    const next = [];
    for (const a of frontier) for (const e of W.adj[a]) {
      if (seen.has(e.to)) continue;
      seen.add(e.to);
      if (g.isFriendly(tag, P.ctrl[e.to])) return e.to;
      next.push(e.to);
    }
    frontier = next;
  }
  const cap = g.C(tag).capital;
  return P.ctrl[cap] === tag ? cap : -1;
}

// ---------------------------------------------------------------------------
// Savaş skoru ve teslim olma
// ---------------------------------------------------------------------------
export function occupiedFraction(g, tag) {
  const P = g.s.prov;
  let total = 0, lost = 0;
  for (const pid of g.ownedProvs.get(tag) || []) {
    const v = provinceValue(g, pid);
    total += v;
    if (P.ctrl[pid] !== tag && g.atWar(tag, P.ctrl[pid])) lost += v;
  }
  const c = g.C(tag);
  let f = total ? lost / total : 0;
  const capLost = c.capitalOld !== undefined && P.ctrl[c.capitalOld] !== tag && g.atWar(tag, P.ctrl[c.capitalOld]);
  if (capLost) f += 0.15;
  return clamp(f, 0, 1);
}
// Saldıran taraf açısından -100..100
export function warScore(g, war) {
  const P = g.s.prov;
  const sideVal = (side, enemies) => {
    let total = 0, occ = 0;
    for (const t of side) for (const pid of g.ownedProvs.get(t) || []) {
      const v = provinceValue(g, pid);
      total += v;
      if (enemies.includes(P.ctrl[pid])) occ += v;
    }
    return total ? occ / total : 0;
  };
  const lostD = sideVal(war.def, war.att);
  const lostA = sideVal(war.att, war.def);
  const bA = war.battles?.[war.leadA] || 0, bD = war.battles?.[war.leadD] || 0;
  const battle = bA + bD > 0 ? (bA - bD) / (bA + bD) * 10 : 0;
  const casA = war.att.reduce((x, t) => x + (war.cas[t] || 0), 0), casD = war.def.reduce((x, t) => x + (war.cas[t] || 0), 0);
  const cas = casA + casD > 0 ? (casD - casA) / (casA + casD) * 8 : 0;
  return clamp((lostD - lostA) * 120 + battle + cas, -100, 100);
}

export function dailyDiplomacy(g) {
  const s = g.s;
  if (s.day % 2 !== 0) return;
  for (const war of [...s.wars]) {
    if (war.ended) continue;
    for (const tag of [...war.att, ...war.def]) {
      const c = g.C(tag);
      if (!c.alive) { removeFromWar(g, war, tag); continue; }
      const f = occupiedFraction(g, tag);
      const units = g.unitsOf(tag).length;
      const thresh = c.puppetOf ? 0.4 : 0.6;
      if (f >= thresh || (f >= 0.3 && units === 0) || (f >= 0.45 && c.warSupport < 15)) {
        capitulate(g, war, tag);
        if (war.ended) break;
      }
    }
  }
}

function removeFromWar(g, war, tag) {
  war.att = war.att.filter((t) => t !== tag);
  war.def = war.def.filter((t) => t !== tag);
  if (war.leadA === tag) war.leadA = war.att[0];
  if (war.leadD === tag) war.leadD = war.def[0];
  if (!war.att.length || !war.def.length) endWar(g, war);
  g.rebuildWars();
}

function endWar(g, war) {
  if (war.ended) return;
  war.ended = true;
  war.endDay = g.s.day;
  g.rebuildWars();
  // Sona eren savaşların listesi sınırlı tutulur
  const ended = g.s.wars.filter((w) => w.ended);
  if (ended.length > 30) g.s.wars = g.s.wars.filter((w) => !w.ended || w.endDay > g.s.day - 2000);
  g.emit('war', war);
}

// Teslim olma: işgal edilen topraklar işgalcilere geçer
export function capitulate(g, war, tag) {
  const s = g.s, P = s.prov;
  const c = g.C(tag);
  const enemies = war.att.includes(tag) ? [...war.def] : [...war.att];
  const f = occupiedFraction(g, tag);
  g.news(`🏳️ ${c.name} teslim oldu! (${war.name})`, { type: 'war', tags: [tag, ...enemies], important: true });
  // Ana işgalci
  const occBy = {};
  for (const pid of g.ownedProvs.get(tag) || []) {
    const ct = P.ctrl[pid];
    if (enemies.includes(ct)) occBy[ct] = (occBy[ct] || 0) + provinceValue(g, pid);
  }
  const main = Object.entries(occBy).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (main && g.isPlayer(main) && !g.isPlayer(tag)) {
    // Oyuncu barış konferansında karar verir
    s.pending.push({
      kind: 'peaceConference', id: s.newsSeq++, target: tag, warId: war.id, day: s.day, winners: enemies, main,
      title: 'Barış Konferansı',
      text: `${c.name} teslim oldu. Barış şartlarını belirleyin. (Topraklarının %${Math.round(f * 100)}'i işgal altında)`,
    });
    g.emit('pending');
    // Geçici olarak savaştan çekil (şartlar uygulanana kadar ilerleme durur)
    removeFromWar(g, war, tag);
    setTruce(g, [tag, ...enemies]);
    returnOccupations(g, tag, enemies, true);
    return;
  }
  const side = war.att.includes(tag) ? war.att : war.def;
  const wasLeader = war.leadA === tag || war.leadD === tag;
  removeFromWar(g, war, tag);
  setTruce(g, [tag, ...enemies]);
  applyPeaceTerms(g, tag, enemies, main && f >= 0.85 ? 'annex' : 'occupied', main);
  if (wasLeader && !war.ended) settleRemainder(g, war, side === war.att ? war.att : war.def);
}

// Savaş lideri teslim olunca uzaktaki müttefikler beyaz barışla savaştan çekilir
function settleRemainder(g, war, side) {
  const P = g.s.prov;
  for (const t of [...side]) {
    if (g.isPlayer(t) || war.ended) continue;
    const enemies = war.att.includes(t) ? war.def : war.att;
    let contact = false;
    for (const pid of g.ownedProvs.get(t) || []) {
      if (enemies.includes(P.ctrl[pid])) { contact = true; break; }
      for (const e of g.world.adj[pid]) if (!e.sea && enemies.includes(P.ctrl[e.to])) { contact = true; break; }
      if (contact) break;
    }
    if (!contact) {
      removeFromWar(g, war, t);
      for (let i = 0; i < g.world.n; i++) if (P.ctrl[i] === t && enemies.includes(P.owner[i])) g.setController(i, P.owner[i]);
      g.news(`🕊️ ${g.C(t).name} savaştan çekildi (${war.name}).`, { type: 'peace', tags: [t, ...enemies] });
    }
  }
}

export function applyPeaceTerms(g, loser, winners, mode, main) {
  const s = g.s, P = s.prov;
  const c = g.C(loser);
  if (mode === 'annex' && main) {
    for (const pid of [...(g.ownedProvs.get(loser) || [])]) {
      const ct = P.ctrl[pid];
      g.setOwner(pid, winners.includes(ct) ? ct : main);
    }
  } else if (mode === 'puppet' && main) {
    for (const pid of [...(g.ownedProvs.get(loser) || [])]) {
      const ct = P.ctrl[pid];
      if (winners.includes(ct) && ct !== main) g.setOwner(pid, ct);
      else g.setController(pid, loser);
    }
    c.puppetOf = main;
    leaveAllFactions(g, loser);
    s.treaties = s.treaties.filter((t) => !(t.a === loser || t.b === loser) || t.t === 'guarantee' && t.a === main);
    g.rebuildTreaties();
    g.news(`${c.name}, ${g.C(main).name}'nın kukla devleti oldu.`, { type: 'diplo', tags: [loser, main], important: true });
  } else {
    for (const pid of [...(g.ownedProvs.get(loser) || [])]) {
      const ct = P.ctrl[pid];
      if (winners.includes(ct)) g.setOwner(pid, ct);
    }
  }
  // Kaybedenin işgal ettiği yerler sahiplerine döner
  returnOccupations(g, loser, winners, false);
  cleanupCountry(g, loser);
  if (main && c.alive) {
    for (const w of winners) g.addRel(w, loser, 10);
  }
  g.rebuildEconomyCache();
}

function returnOccupations(g, loser, winners, both) {
  const P = g.s.prov;
  for (let i = 0; i < g.world.n; i++) {
    if (P.ctrl[i] === loser && winners.includes(P.owner[i])) g.setController(i, P.owner[i]);
    if (both && P.owner[i] === loser && winners.includes(P.ctrl[i])) { /* konferansa kadar işgal sürer */ }
  }
  // Birlikleri düzelt
  for (const u of g.s.units) {
    if (u.dead) continue;
    const ct = P.ctrl[u.p];
    if (ct !== u.o && !g.isFriendly(u.o, ct) && !g.atWar(u.o, ct)) {
      const home = homeProvince(g, u.o, u.p);
      u.path = []; u.prog = 0;
      if (home >= 0) g.moveUnitTo(u, home); else g.removeUnit(u);
    }
  }
}
function homeProvince(g, tag, from) {
  const P = g.s.prov, W = g.world;
  let best = -1, bd = Infinity;
  for (const pid of g.ctrlProvs.get(tag) || []) {
    if (P.owner[pid] !== tag) continue;
    const d = W.distKm(pid, from);
    if (d < bd) { bd = d; best = pid; }
  }
  return best;
}

export function cleanupCountry(g, tag) {
  const s = g.s;
  const c = g.C(tag);
  const owned = g.ownedProvs.get(tag) || [];
  if (owned.length === 0) {
    c.alive = false;
    for (const u of [...g.unitsOf(tag)]) g.removeUnit(u);
    s.treaties = s.treaties.filter((t) => t.a !== tag && t.b !== tag);
    leaveAllFactions(g, tag);
    for (const w of s.wars) if (!w.ended && (w.att.includes(tag) || w.def.includes(tag))) removeFromWar(g, w, tag);
    for (const o of Object.values(s.countries)) if (o.puppetOf === tag) o.puppetOf = null;
    g.rebuildTreaties();
    g.news(`🏴 ${c.name} haritadan silindi.`, { type: 'war', tags: [tag], important: true });
    if (g.isPlayer(tag)) {
      s.over = { type: 'defeat', day: s.day };
      g.emit('gameover', s.over);
    }
    return;
  }
  if (s.prov.owner[c.capital] !== tag) relocateCapital(g, tag);
  // Kendi toprağı dışında kalan birlikler
  for (const u of [...g.unitsOf(tag)]) {
    const ct = s.prov.ctrl[u.p];
    if (ct !== tag && !g.isFriendly(tag, ct) && !g.atWar(tag, ct)) {
      const home = homeProvince(g, tag, u.p);
      u.path = []; u.prog = 0;
      if (home >= 0) g.moveUnitTo(u, home); else g.removeUnit(u);
    }
  }
}

// ---------------------------------------------------------------------------
// Barış
// ---------------------------------------------------------------------------
// type: 'white' (beyaz barış), 'demand' (işgal ettiklerimizi al), 'concede' (işgal ettiklerini ver)
export function peaceAcceptance(g, war, aiTag, proposer, type) {
  const c = g.C(aiTag);
  const aiIsAtt = war.att.includes(aiTag);
  const score = warScore(g, war) * (aiIsAtt ? 1 : -1); // AI açısından
  const days = g.s.day - war.start;
  const exhaustion = c.exhaustion;
  const ws = c.warSupport;
  let v = 0;
  if (type === 'concede') v = 100; // lehine
  else if (type === 'white') v = -score * 1.2 + (days > 180 ? 10 : 0) + (days > 540 ? 20 : 0) + (60 - ws) * 0.5 + exhaustion * 0.4 - 5;
  else if (type === 'demand') v = -score * 1.4 - 35 + (60 - ws) * 0.6 + exhaustion * 0.5 + (days > 365 ? 10 : 0);
  // Güç dengesi
  const myPow = sidePower(g, aiIsAtt ? war.att : war.def), enPow = sidePower(g, aiIsAtt ? war.def : war.att);
  v += clamp((enPow / Math.max(1, myPow) - 1) * 15, -20, 25);
  return { accept: v > 0, value: v };
}
function sidePower(g, side) { return side.reduce((a, t) => a + g.militaryPower(t), 0); }

export function offerPeace(g, from, to, type) {
  const war = g.warBetween(from, to);
  if (!war) return { ok: false, why: 'Savaşta değilsiniz' };
  const leaders = [war.leadA, war.leadD];
  const fromLead = leaders.includes(from);
  const toLead = leaders.includes(to);
  const res = g.isPlayer(to) ? { accept: false } : peaceAcceptance(g, war, to, from, type);
  if (!res.accept) return { ok: false, why: `${g.C(to).name} teklifi reddetti.` };
  concludePeace(g, war, from, to, type, fromLead && toLead);
  return { ok: true };
}

export function concludePeace(g, war, from, to, type, wholeWar) {
  const P = g.s.prov;
  const fromSide = war.att.includes(from) ? war.att : war.def;
  const toSide = war.att.includes(to) ? war.att : war.def;
  // toprak transferleri
  if (type === 'demand') {
    for (const pid of [...(g.ownedProvs.get(to) || [])]) if (fromSide.includes(P.ctrl[pid])) g.setOwner(pid, P.ctrl[pid]);
  } else if (type === 'concede') {
    for (const pid of [...(g.ownedProvs.get(from) || [])]) if (toSide.includes(P.ctrl[pid])) g.setOwner(pid, P.ctrl[pid]);
  }
  const names = `${g.C(from).name} ve ${g.C(to).name}`;
  const label = type === 'white' ? 'beyaz barış (savaş öncesi sınırlar)' : type === 'demand' ? `${g.C(to).name} işgal altındaki topraklarını devretti` : `${g.C(from).name} işgal altındaki topraklarını devretti`;
  g.news(`🕊️ ${names} barış imzaladı: ${label}.`, { type: 'peace', tags: [from, to], important: true });
  if (wholeWar) {
    // tüm işgaller kalkar
    for (let i = 0; i < g.world.n; i++) {
      if (P.ctrl[i] !== P.owner[i] && (war.att.includes(P.ctrl[i]) || war.def.includes(P.ctrl[i])) && (war.att.includes(P.owner[i]) || war.def.includes(P.owner[i]))) g.setController(i, P.owner[i]);
    }
    endWar(g, war);
  } else {
    for (const t of [from, to]) {
      if (t === war.leadA || t === war.leadD) continue;
      removeFromWar(g, war, t);
      const enemies = war.att.includes(t) ? war.def : war.att;
      for (let i = 0; i < g.world.n; i++) {
        if (P.ctrl[i] === t && enemies.includes(P.owner[i])) g.setController(i, P.owner[i]);
        if (P.owner[i] === t && enemies.includes(P.ctrl[i])) g.setController(i, t);
      }
    }
    if (!war.ended && (from === war.leadA || from === war.leadD) && (to === war.leadA || to === war.leadD)) endWar(g, war);
  }
  g.rebuildWars();
  g.rebuildEconomyCache();
  for (const t of [...war.att, ...war.def, from, to]) if (g.C(t).alive) cleanupCountry(g, t);
  g.setRel(from, to, Math.max(g.rel(from, to), -50));
  setTruce(g, fromSide.concat(toSide));
}
// Barıştan sonra iki yıl ateşkes (yapay zekâ yeniden savaş açmaz)
function setTruce(g, tags) {
  const until = g.s.day + 730;
  for (const a of tags) for (const b of tags) {
    if (a === b) continue;
    const c = g.C(a);
    if (!c) continue;
    (c.truce ||= {})[b] = until;
  }
}

// ---------------------------------------------------------------------------
// Antlaşmalar
// ---------------------------------------------------------------------------
export const TREATY_NAMES = { alliance: 'Askeri İttifak', defense: 'Savunma Paktı', nap: 'Saldırmazlık Paktı', access: 'Askeri Geçiş İzni', guarantee: 'Bağımsızlık Garantisi' };

export function removeTreaty(g, type, a, b) {
  const before = g.s.treaties.length;
  g.s.treaties = g.s.treaties.filter((t) => !(t.t === type && ((t.a === a && t.b === b) || (t.a === b && t.b === a))));
  if (g.s.treaties.length !== before) g.rebuildTreaties();
}
function addTreaty(g, type, a, b) {
  if (type !== 'guarantee' && g.hasTreaty(type, a, b)) return;
  if (type === 'guarantee' && g.guarantees(a, b)) return;
  g.s.treaties.push({ t: type, a, b, since: g.s.day });
  g.rebuildTreaties();
}
function blocCompatible(ca, cb) {
  const hostile = { W: ['R', 'C', 'I', 'L'], R: ['W'], C: ['W'], I: ['W', 'G'], G: ['I'], L: ['W'] };
  return !(hostile[ca.bloc] || []).includes(cb.bloc) && !(hostile[cb.bloc] || []).includes(ca.bloc);
}
export function wouldAccept(g, from, to, type) {
  const a = g.C(from), b = g.C(to);
  const r = g.rel(from, to);
  if (g.atWar(from, to)) return { ok: false, why: 'Savaştasınız' };
  if (type === 'alliance') {
    if (g.isAlly(from, to)) return { ok: false, why: 'Zaten müttefiksiniz' };
    if (!blocCompatible(a, b)) return { ok: false, why: `${b.name} karşıt blokla ittifak kurmaz` };
    const need = g.isAtWar(from) ? 80 : 55;
    if (r < need) return { ok: false, why: `İlişkiler yetersiz (${Math.round(r)}/${need})` };
    // Yükümlülük kaygısı: zayıf ve savaştaki ülke istemez
    for (const e of g.enemiesOf(from)) if (g.rel(to, e) > 30) return { ok: false, why: `${b.name}, ${g.C(e).name} ile iyi ilişkiler içinde` };
    return { ok: true };
  }
  if (type === 'nap') {
    if (g.hasTreaty('nap', from, to)) return { ok: false, why: 'Zaten var' };
    if (r < -25) return { ok: false, why: `İlişkiler yetersiz (${Math.round(r)}/-25)` };
    return { ok: true };
  }
  if (type === 'access') {
    if (g.hasTreaty('access', from, to) || g.isAlly(from, to)) return { ok: false, why: 'Zaten geçiş hakkınız var' };
    if (r < 35) return { ok: false, why: `İlişkiler yetersiz (${Math.round(r)}/35)` };
    for (const e of g.enemiesOf(from)) if (g.rel(to, e) > 0) return { ok: false, why: `${b.name} savaşınıza karışmak istemiyor` };
    return { ok: true };
  }
  return { ok: false, why: 'Bilinmiyor' };
}
export function proposeTreaty(g, from, to, type) {
  if (type === 'guarantee') {
    addTreaty(g, 'guarantee', from, to);
    g.addRel(from, to, 10);
    g.news(`${g.C(from).name}, ${g.C(to).name}'nın bağımsızlığını garanti etti.`, { type: 'diplo', tags: [from, to] });
    return { ok: true };
  }
  if (g.isPlayer(to)) {
    g.s.pending.push({ kind: 'treaty', id: g.s.newsSeq++, from, type, day: g.s.day, title: 'Diplomatik Teklif', text: `${g.C(from).name} size ${TREATY_NAMES[type]} öneriyor.` });
    g.emit('pending');
    return { ok: true, pending: true };
  }
  const res = wouldAccept(g, from, to, type);
  if (!res.ok) return res;
  addTreaty(g, type, from, to);
  g.addRel(from, to, 8);
  g.news(`🤝 ${g.C(from).name} ile ${g.C(to).name} arasında ${TREATY_NAMES[type]} imzalandı.`, { type: 'diplo', tags: [from, to], important: g.involvesPlayer([from, to]) });
  return { ok: true };
}
export function acceptTreaty(g, from, to, type) {
  addTreaty(g, type, from, to);
  g.addRel(from, to, 8);
  g.news(`🤝 ${g.C(from).name} ile ${g.C(to).name} arasında ${TREATY_NAMES[type]} imzalandı.`, { type: 'diplo', tags: [from, to], important: true });
}
export function cancelTreaty(g, a, b, type) {
  removeTreaty(g, type, a, b);
  if (type === 'guarantee') g.s.treaties = g.s.treaties.filter((t) => !(t.t === 'guarantee' && t.a === a && t.b === b));
  g.rebuildTreaties();
  g.addRel(a, b, type === 'alliance' || type === 'defense' ? -30 : -10);
  g.news(`${g.C(a).name}, ${g.C(b).name} ile ${TREATY_NAMES[type]} anlaşmasını feshetti.`, { type: 'diplo', tags: [a, b] });
}

// Faksiyonlar
export function canJoinFaction(g, tag, fid) {
  const f = g.s.factions[fid];
  if (!f) return { ok: false, why: 'Yok' };
  if (f.members.includes(tag)) return { ok: false, why: 'Zaten üyesiniz' };
  if (g.factionOf.get(tag)) return { ok: false, why: 'Başka bir ittifaka üyesiniz' };
  if (g.isAtWar(tag)) return { ok: false, why: 'Savaştaki ülkeler üye kabul edilmez' };
  const lead = f.leader;
  const r = g.rel(tag, lead);
  if (r < 50) return { ok: false, why: `${g.C(lead).name} ile ilişkiler en az 50 olmalı (${Math.round(r)})` };
  const avg = f.members.reduce((a, m) => a + g.rel(tag, m), 0) / Math.max(1, f.members.length);
  if (avg < 20) return { ok: false, why: `Üyelerle ortalama ilişki en az 20 olmalı (${Math.round(avg)})` };
  if (!blocCompatible(g.C(tag), g.C(lead))) return { ok: false, why: 'Blok uyumsuzluğu' };
  return { ok: true };
}
export function joinFaction(g, tag, fid) {
  const chk = canJoinFaction(g, tag, fid);
  if (!chk.ok) return chk;
  g.s.factions[fid].members.push(tag);
  g.rebuildTreaties();
  g.news(`🛡️ ${g.C(tag).name} ${g.s.factions[fid].name} ittifakına katıldı!`, { type: 'diplo', tags: [tag], important: true });
  for (const m of g.s.factions[fid].members) g.addRel(tag, m, 10);
  return { ok: true };
}
export function leaveFaction(g, tag) {
  const fid = g.factionOf.get(tag);
  if (!fid) return;
  const f = g.s.factions[fid];
  f.members = f.members.filter((m) => m !== tag);
  if (f.leader === tag) f.leader = f.members[0];
  if (!f.members.length) delete g.s.factions[fid];
  g.rebuildTreaties();
  for (const m of f.members) g.addRel(tag, m, -20);
  g.news(`${g.C(tag).name}, ${f.name} ittifakından ayrıldı.`, { type: 'diplo', tags: [tag], important: true });
}
function leaveAllFactions(g, tag) {
  for (const f of Object.values(g.s.factions)) {
    if (f.members.includes(tag)) {
      f.members = f.members.filter((m) => m !== tag);
      if (f.leader === tag) f.leader = f.members[0];
    }
  }
  for (const [id, f] of Object.entries(g.s.factions)) if (!f.members.length) delete g.s.factions[id];
  g.rebuildTreaties();
}
export function createFaction(g, tag, name) {
  if (g.factionOf.get(tag)) return { ok: false, why: 'Zaten bir ittifaktasınız' };
  const id = `F${g.s.day}${tag}`;
  g.s.factions[id] = { id, name, full: name, leader: tag, defensive: true, color: g.C(tag).color, members: [tag] };
  g.rebuildTreaties();
  g.news(`${g.C(tag).name} yeni bir askeri ittifak kurdu: ${name}.`, { type: 'diplo', tags: [tag], important: true });
  return { ok: true, id };
}
export function inviteToFaction(g, tag, target) {
  const fid = g.factionOf.get(tag);
  if (!fid || g.s.factions[fid].leader !== tag) return { ok: false, why: 'İttifak lideri değilsiniz' };
  if (g.factionOf.get(target)) return { ok: false, why: 'Hedef başka bir ittifakta' };
  const r = g.rel(tag, target);
  if (r < 60 || !blocCompatible(g.C(tag), g.C(target))) return { ok: false, why: `İlişkiler yetersiz (${Math.round(r)}/60) veya blok uyumsuz` };
  if (g.isAtWar(tag) && r < 85) return { ok: false, why: 'Savaştaki bir ittifaka katılmak istemiyor' };
  g.s.factions[fid].members.push(target);
  g.rebuildTreaties();
  g.news(`🛡️ ${g.C(target).name}, ${g.s.factions[fid].name} ittifakına katıldı.`, { type: 'diplo', tags: [tag, target], important: true });
  return { ok: true };
}

// Diğer diplomatik eylemler
export function improveRelations(g, from, to) {
  const c = g.C(from);
  const active = Object.keys(c.improving).length;
  const max = 2 + Math.floor(Math.log10(Math.max(1, countryGdp(g, from))));
  if (active >= max && !c.improving[to]) return { ok: false, why: `En fazla ${max} ülkeyle eşzamanlı ilişki geliştirebilirsiniz` };
  c.improving[to] = g.s.day + 120;
  return { ok: true };
}
export function insult(g, from, to) {
  g.addRel(from, to, -25);
  g.C(from).warSupport = clamp(g.C(from).warSupport + 2, 0, 100);
  g.news(`${g.C(from).name}, ${g.C(to).name} yönetimine sert bir diplomatik nota verdi.`, { type: 'diplo', tags: [from, to] });
  return { ok: true };
}
export function toggleSanction(g, from, to) {
  const t = g.C(to);
  if (t.sanctions.includes(from)) {
    t.sanctions = t.sanctions.filter((x) => x !== from);
    g.addRel(from, to, 10);
    g.news(`${g.C(from).name}, ${t.name}'na yönelik yaptırımları kaldırdı.`, { type: 'diplo', tags: [from, to] });
  } else {
    t.sanctions.push(from);
    g.addRel(from, to, -20);
    g.news(`💼 ${g.C(from).name}, ${t.name}'na ekonomik yaptırım uyguladı.`, { type: 'diplo', tags: [from, to], important: g.involvesPlayer([from, to]) });
  }
  return { ok: true };
}
export function justifyWar(g, from, to) {
  const c = g.C(from);
  if (c.justify) return { ok: false, why: 'Zaten bir gerekçe hazırlanıyor' };
  if (c.claims[to] > g.s.day) return { ok: false, why: 'Gerekçe zaten mevcut' };
  c.justify = { target: to, until: g.s.day + 45 };
  g.addRel(from, to, -10);
  g.s.worldTension = clamp(g.s.worldTension + 1.5, 0, 100);
  if (g.isPlayer(to) || g.rng.chance(0.4)) g.news(`🕵️ ${c.name}, ${g.C(to).name}'na karşı savaş gerekçesi hazırlıyor!`, { type: 'diplo', tags: [from, to], important: g.isPlayer(to) });
  return { ok: true };
}
export function sendAid(g, from, to, amount) {
  const a = g.C(from), b = g.C(to);
  if (a.treasury < amount) return { ok: false, why: 'Yetersiz hazine' };
  a.treasury -= amount;
  b.treasury += amount;
  const gdpB = Math.max(1, countryGdp(g, to));
  g.addRel(from, to, clamp(amount / gdpB * 2000, 1, 25));
  if (g.involvesPlayer([from, to]) || amount > 5) g.news(`💰 ${a.name}, ${b.name}'na ${amount.toFixed(1)} milyar $ yardım gönderdi.`, { type: 'diplo', tags: [from, to] });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Aylık
// ---------------------------------------------------------------------------
export function monthlyDiplomacy(g) {
  const s = g.s;
  // İlişki kayması
  for (const key of Object.keys(s.rel)) {
    const [a, b] = key.split('|');
    const ca = s.countries[a], cb = s.countries[b];
    if (!ca?.alive || !cb?.alive) { delete s.rel[key]; continue; }
    if (g.atWar(a, b)) { s.rel[key] = Math.min(s.rel[key], -60); continue; }
    if (ca.improving[b] || cb.improving[a]) continue;
    const v = s.rel[key];
    let target = 0;
    if (g.isAlly(a, b)) target = 60;
    else if (g.hasTreaty('nap', a, b)) target = 10;
    else target = v * 0.97; // yavaşça nötrleşir
    s.rel[key] = Math.round((v + (target - v) * 0.04) * 10) / 10;
  }
  // Kukla devletler gelirlerinin bir kısmını efendiye öder
  for (const c of Object.values(s.countries)) {
    if (!c.alive || !c.puppetOf) continue;
    const m = s.countries[c.puppetOf];
    if (!m?.alive) { c.puppetOf = null; continue; }
    const pay = Math.max(0, c.lastIncome * 30 * 0.25);
    c.treasury -= pay; m.treasury += pay;
  }
  void pairKey;
}
