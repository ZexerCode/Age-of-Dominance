// Oyun çekirdeği: durum, önbellekler, yardımcı sorgular ve günlük döngü
import { Rng, pairKey, clamp, formatDate, dayToDate } from './util.js';
import { baseRelation } from './setup.js';
import { UNIT_TYPES, CONSCRIPTION_LAWS, TECH_BY_ID, DIFFICULTIES } from '../data/rules.js';
import * as economy from './economy.js';
import * as military from './military.js';
import * as diplomacy from './diplomacy.js';
import * as ai from './ai.js';
import * as events from './events.js';

const LAW_BY_ID = Object.fromEntries(CONSCRIPTION_LAWS.map((l) => [l.id, l]));

export class Game {
  constructor(world, state) {
    this.world = world;
    this.s = state;
    this.rng = new Rng(1);
    this.rng.s = state.rng || state.seed || 12345;
    this.listeners = {};
    this.rebuildAll();
  }

  // ------------------------------------------------------------------ olaylar
  on(ev, fn) { (this.listeners[ev] ||= []).push(fn); return () => { this.listeners[ev] = this.listeners[ev].filter((f) => f !== fn); }; }
  emit(ev, data) { for (const fn of this.listeners[ev] || []) { try { fn(data); } catch (e) { console.error(e); } } }

  // ------------------------------------------------------------------ önbellekler
  rebuildAll() {
    this.rebuildUnits();
    this.rebuildWars();
    this.rebuildTreaties();
    this.rebuildEconomyCache();
    this.supplyCache = new Map();
    this.ownerDirty = true;
  }
  rebuildUnits() {
    this.unitById = new Map();
    this.unitsByProv = new Map();
    this.unitsByOwner = new Map();
    for (const u of this.s.units) {
      this.unitById.set(u.id, u);
      if (!this.unitsByProv.has(u.p)) this.unitsByProv.set(u.p, []);
      this.unitsByProv.get(u.p).push(u);
      if (!this.unitsByOwner.has(u.o)) this.unitsByOwner.set(u.o, []);
      this.unitsByOwner.get(u.o).push(u);
    }
    this.battleByProv = new Map();
    for (const b of this.s.battles) this.battleByProv.set(b.p, b);
  }
  rebuildWars() {
    this.warPairs = new Map(); // pairKey → war
    this.warsByTag = new Map();
    for (const w of this.s.wars) {
      if (w.ended) continue;
      for (const a of w.att) for (const d of w.def) this.warPairs.set(pairKey(a, d), w);
      for (const t of [...w.att, ...w.def]) {
        if (!this.warsByTag.has(t)) this.warsByTag.set(t, []);
        this.warsByTag.get(t).push(w);
      }
    }
    this.enemyCache = new Map();
    this.coBelCache = new Map();
    this.allyCache = new Map();
  }
  rebuildTreaties() {
    this.allyCache = new Map();
    this.treatyIndex = new Map();
    for (const t of this.s.treaties) {
      const key = `${t.t}:${pairKey(t.a, t.b)}`;
      this.treatyIndex.set(key, t);
      if (t.t === 'guarantee') this.treatyIndex.set(`g:${t.a}>${t.b}`, t);
    }
    this.factionOf = new Map();
    for (const f of Object.values(this.s.factions)) for (const m of f.members) this.factionOf.set(m, f.id);
  }
  rebuildEconomyCache() {
    // ülke başına il listeleri
    const P = this.s.prov;
    this.ownedProvs = new Map();
    this.ctrlProvs = new Map();
    for (let i = 0; i < this.world.n; i++) {
      const o = P.owner[i], c = P.ctrl[i];
      if (!this.ownedProvs.has(o)) this.ownedProvs.set(o, []);
      this.ownedProvs.get(o).push(i);
      if (!this.ctrlProvs.has(c)) this.ctrlProvs.set(c, []);
      this.ctrlProvs.get(c).push(i);
    }
    this.ownerDirty = true;
  }

  // ------------------------------------------------------------------ sorgular
  C(tag) { return this.s.countries[tag]; }
  get player() { return this.s.player; }
  get day() { return this.s.day; }
  get date() { return dayToDate(this.s.day); }
  dateStr(day = this.s.day) { return formatDate(day); }
  isPlayer(tag) { return tag === this.s.player; }
  aliveTags() { return Object.keys(this.s.countries).filter((t) => this.s.countries[t].alive); }

  rel(a, b) {
    if (a === b) return 100;
    const v = this.s.rel[pairKey(a, b)];
    if (v !== undefined) return v;
    const ca = this.s.countries[a], cb = this.s.countries[b];
    if (!ca || !cb) return 0;
    return baseRelation(ca, cb);
  }
  setRel(a, b, v) { if (a !== b) this.s.rel[pairKey(a, b)] = clamp(Math.round(v * 10) / 10, -100, 100); }
  addRel(a, b, d) { if (a !== b) this.setRel(a, b, this.rel(a, b) + d); }

  atWar(a, b) { return a !== b && this.warPairs.has(pairKey(a, b)); }
  warBetween(a, b) { return this.warPairs.get(pairKey(a, b)) || null; }
  warsOf(tag) { return this.warsByTag.get(tag) || []; }
  isAtWar(tag) { return this.warsOf(tag).length > 0; }
  enemiesOf(tag) {
    let set = this.enemyCache.get(tag);
    if (!set) {
      set = new Set();
      for (const w of this.warsOf(tag)) {
        const other = w.att.includes(tag) ? w.def : w.att;
        other.forEach((t) => set.add(t));
      }
      this.enemyCache.set(tag, set);
    }
    return set;
  }
  // Aynı savaşta aynı taraftaki ülkeler
  coBelligerents(tag) {
    let cached = this.coBelCache.get(tag);
    if (cached) return cached;
    const set = new Set();
    this.coBelCache.set(tag, set);
    for (const w of this.warsOf(tag)) {
      const side = w.att.includes(tag) ? w.att : w.def;
      side.forEach((t) => { if (t !== tag) set.add(t); });
    }
    return set;
  }
  hasTreaty(type, a, b) { return this.treatyIndex.has(`${type}:${pairKey(a, b)}`); }
  guarantees(a, b) { return this.treatyIndex.has(`g:${a}>${b}`); }
  sameFaction(a, b) { const fa = this.factionOf.get(a); return !!fa && fa === this.factionOf.get(b); }
  // Savunma yükümlülüğü olan müttefikler (faksiyon + savunma paktı + ittifak)
  alliesOf(tag) {
    let set = this.allyCache.get(tag);
    if (!set) {
      set = new Set();
      const f = this.factionOf.get(tag);
      if (f) this.s.factions[f].members.forEach((m) => { if (m !== tag && this.s.countries[m]?.alive) set.add(m); });
      for (const t of this.s.treaties) {
        if ((t.t === 'defense' || t.t === 'alliance') && (t.a === tag || t.b === tag)) set.add(t.a === tag ? t.b : t.a);
      }
      const c = this.s.countries[tag];
      if (c?.puppetOf) set.add(c.puppetOf);
      for (const o of Object.values(this.s.countries)) if (o.alive && o.puppetOf === tag) set.add(o.tag);
      this.allyCache.set(tag, set);
    }
    return set;
  }
  isAlly(a, b) { return this.alliesOf(a).has(b); }
  // a ülkesi b’nin topraklarına girebilir mi (savaş dışı)
  canPass(a, b) {
    if (a === b) return true;
    if (this.atWar(a, b)) return true;
    if (this.coBelligerents(a).has(b)) return true;
    if (this.isAlly(a, b)) return true;
    if (this.hasTreaty('access', a, b)) return true;
    return false;
  }
  // a için b "dost" (ikmal ağı ve hareket) mı
  isFriendly(a, b) {
    if (a === b) return true;
    if (this.atWar(a, b)) return false;
    return this.coBelligerents(a).has(b) || this.isAlly(a, b) || this.hasTreaty('access', a, b);
  }

  unitsAt(pid) { return this.unitsByProv.get(pid) || []; }
  unitsOf(tag) { return this.unitsByOwner.get(tag) || []; }
  hostileUnitsAt(pid, tag) { return this.unitsAt(pid).filter((u) => this.atWar(u.o, tag)); }

  law(c) { return LAW_BY_ID[c.law] || LAW_BY_ID.limited; }
  hasTech(c, id) { return c.techs.includes(id); }
  techSum(c, key) {
    let v = 0;
    for (const id of c.techs) { const t = TECH_BY_ID[id]; if (t && t.effects[key]) v += t.effects[key]; }
    return v;
  }
  techMax(c, key) {
    let v = 0;
    for (const id of c.techs) { const t = TECH_BY_ID[id]; if (t && t.effects[key] && t.effects[key] > v) v = t.effects[key]; }
    return v;
  }
  diff(tag) {
    const d = DIFFICULTIES[this.s.difficulty] || DIFFICULTIES.normal;
    return tag === this.s.player ? d : DIFFICULTIES.normal;
  }
  modSum(c, key) {
    let v = 0;
    for (const m of c.mods) if (m.key === key && (m.until === undefined || m.until > this.s.day)) v += m.v;
    return v;
  }
  addMod(c, key, v, days, label) { c.mods.push({ key, v, until: days ? this.s.day + days : undefined, label }); }

  // GSYH (milyar $/yıl) — sahip olunan ve kontrol edilen iller
  gdp(tag) { return economy.countryGdp(this, tag); }
  population(tag) {
    let p = 0;
    for (const pid of this.ownedProvs.get(tag) || []) p += this.s.prov.pop[pid];
    return p;
  }
  factories(tag) { return economy.countryFactories(this, tag); }
  manpower(tag) { return economy.manpowerInfo(this, tag); }

  // Ordunun toplam gücü (yapay zekâ ve arayüz için)
  armyStrength(tag) {
    let v = 0;
    const c = this.s.countries[tag];
    for (const u of this.unitsOf(tag)) {
      const ut = UNIT_TYPES[u.t];
      v += (ut.atk + ut.def) * u.s * (0.4 + 0.6 * u.g);
    }
    const techMul = 1 + 0.08 * (c?.techTier || 1);
    return v * techMul;
  }
  militaryPower(tag) {
    const c = this.s.countries[tag];
    if (!c) return 0;
    return this.armyStrength(tag) + c.air * 12 * (1 + this.techSum(c, 'air_power')) + c.navy * 4;
  }

  // ------------------------------------------------------------------ haberler
  news(text, opts = {}) {
    const item = { id: this.s.newsSeq++, day: this.s.day, text, type: opts.type || 'info', tags: opts.tags || [], pid: opts.pid ?? null, important: !!opts.important };
    this.s.news.push(item);
    if (this.s.news.length > 400) this.s.news.splice(0, this.s.news.length - 400);
    this.emit('news', item);
    return item;
  }
  involvesPlayer(tags) { return tags.includes(this.s.player); }

  // ------------------------------------------------------------------ birim işlemleri
  addUnit(tag, type, pid, opts = {}) {
    const ut = UNIT_TYPES[type];
    const c = this.s.countries[tag];
    const u = {
      id: this.s.nextUnitId++, o: tag, t: type, p: pid,
      s: opts.s ?? 1, g: opts.g ?? (ut.org / 100) * (1 + this.law(c).org), x: opts.x ?? 0, path: [], prog: 0, ent: 0, sup: true, b: 0,
    };
    this.s.units.push(u);
    this.unitById.set(u.id, u);
    if (!this.unitsByProv.has(pid)) this.unitsByProv.set(pid, []);
    this.unitsByProv.get(pid).push(u);
    if (!this.unitsByOwner.has(tag)) this.unitsByOwner.set(tag, []);
    this.unitsByOwner.get(tag).push(u);
    return u;
  }
  moveUnitTo(u, pid) {
    const list = this.unitsByProv.get(u.p);
    if (list) { const i = list.indexOf(u); if (i >= 0) list.splice(i, 1); if (!list.length) this.unitsByProv.delete(u.p); }
    u.p = pid;
    if (!this.unitsByProv.has(pid)) this.unitsByProv.set(pid, []);
    this.unitsByProv.get(pid).push(u);
  }
  removeUnit(u) {
    u.dead = true;
    this.unitById.delete(u.id);
    const list = this.unitsByProv.get(u.p);
    if (list) { const i = list.indexOf(u); if (i >= 0) list.splice(i, 1); if (!list.length) this.unitsByProv.delete(u.p); }
    const ol = this.unitsByOwner.get(u.o);
    if (ol) { const i = ol.indexOf(u); if (i >= 0) ol.splice(i, 1); }
    this.unitsRemoved = true;
  }
  sweepDeadUnits() {
    if (!this.unitsRemoved) return;
    this.s.units = this.s.units.filter((u) => !u.dead);
    this.unitsRemoved = false;
  }

  setController(pid, tag) {
    const P = this.s.prov;
    const prev = P.ctrl[pid];
    if (prev === tag) return;
    P.ctrl[pid] = tag;
    const a = this.ctrlProvs.get(prev); if (a) { const i = a.indexOf(pid); if (i >= 0) a.splice(i, 1); }
    if (!this.ctrlProvs.has(tag)) this.ctrlProvs.set(tag, []);
    this.ctrlProvs.get(tag).push(pid);
    this.ownerDirty = true;
    this.emit('control', { pid, from: prev, to: tag });
  }
  setOwner(pid, tag) {
    const P = this.s.prov;
    const prev = P.owner[pid];
    if (prev === tag) return;
    P.owner[pid] = tag;
    const a = this.ownedProvs.get(prev); if (a) { const i = a.indexOf(pid); if (i >= 0) a.splice(i, 1); }
    if (!this.ownedProvs.has(tag)) this.ownedProvs.set(tag, []);
    this.ownedProvs.get(tag).push(pid);
    this.setController(pid, tag);
    this.ownerDirty = true;
    this.emit('owner', { pid, from: prev, to: tag });
  }

  // ------------------------------------------------------------------ döngü
  tick() {
    if (this.s.over) return;
    const s = this.s;
    s.day++;
    const { d } = dayToDate(s.day);
    military.dailyMilitary(this);
    diplomacy.dailyDiplomacy(this);
    economy.dailyEconomy(this);
    ai.dailyAI(this);
    events.dailyEvents(this);
    if (d === 1) {
      economy.monthlyEconomy(this);
      diplomacy.monthlyDiplomacy(this);
      events.monthlyEvents(this);
    }
    this.sweepDeadUnits();
    s.rng = this.rng.s;
    this.emit('tick', s.day);
  }

  // ------------------------------------------------------------------ kayıt
  serialize() {
    this.s.rng = this.rng.s;
    return JSON.stringify(this.s);
  }
  static deserialize(world, json) {
    const st = typeof json === 'string' ? JSON.parse(json) : json;
    return new Game(world, st);
  }
}
