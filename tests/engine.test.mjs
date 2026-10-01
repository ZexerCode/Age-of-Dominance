// Oyun motoru testleri: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { World } from '../js/engine/world.js';
import { createGame } from '../js/engine/setup.js';
import { Game } from '../js/engine/game.js';
import * as eco from '../js/engine/economy.js';
import * as mil from '../js/engine/military.js';
import * as dip from '../js/engine/diplomacy.js';
import { takeDecision, resolvePending } from '../js/engine/events.js';

const raw = JSON.parse(fs.readFileSync(new URL('../data/world.json', import.meta.url)));
const world = new World(raw);
const newGame = (opts = {}) => new Game(world, createGame(world, { seed: 7, ...opts }));
const pidByName = (name, tag) => world.provinces.find((p) => p.name === name && (!tag || p.tag === tag))?.id;

test('harita verisi tutarlı', () => {
  assert.ok(world.n > 2000, 'yeterli il sayısı');
  for (const p of world.provinces) {
    for (const nb of p.neighbors) assert.ok(world.provinces[nb].neighbors.includes(p.id), `komşuluk simetrik: ${p.name}`);
    assert.ok(Number.isFinite(p.label[0]) && Number.isFinite(p.label[1]));
    assert.ok(p.area > 0);
  }
  // Tüm iller kara + deniz bağlantılarıyla erişilebilir
  const seen = new Uint8Array(world.n);
  const st = [0]; seen[0] = 1;
  while (st.length) { const a = st.pop(); for (const e of world.adj[a]) if (!seen[e.to]) { seen[e.to] = 1; st.push(e.to); } }
  assert.equal(seen.reduce((s, v) => s + v, 0), world.n, 'harita tek parça');
  // İsabet testi: Ankara il merkezi
  const ank = pidByName('Ankara', 'TUR');
  const p = world.provinces[ank];
  assert.equal(world.provinceAt(p.label[0], p.label[1]), ank);
});

test('senaryo kurulumu', () => {
  const g = newGame({ player: 'TUR' });
  const s = g.s;
  assert.ok(Object.keys(s.countries).length > 190);
  for (const c of Object.values(s.countries)) {
    assert.equal(s.prov.owner[c.capital], c.tag, `${c.tag} başkenti kendi ili`);
    assert.ok(Number.isFinite(c.treasury) && Number.isFinite(c.costFactor));
  }
  for (const u of s.units) assert.equal(s.prov.ctrl[u.p], u.o, 'birlikler kendi topraklarında başlar');
  assert.ok(g.atWar('RUS', 'UKR'), 'Rusya–Ukrayna savaşı sürüyor');
  const donetsk = pidByName('Donetsk', 'UKR');
  assert.equal(s.prov.owner[donetsk], 'UKR');
  assert.equal(s.prov.ctrl[donetsk], 'RUS');
  assert.ok(g.sameFaction('TUR', 'USA'), 'Türkiye NATO üyesi');
  assert.ok(g.unitsOf('TUR').length >= 10);
  assert.ok(Math.abs(eco.countryGdp(g, 'TUR') - 1440) < 30);
});

test('gün döngüsü kararlı çalışır (180 gün)', () => {
  const g = newGame({ player: 'TUR' });
  for (let i = 0; i < 180; i++) g.tick();
  assert.equal(g.s.day, 180);
  for (const c of Object.values(g.s.countries)) {
    assert.ok(Number.isFinite(c.treasury), `${c.tag} hazine sayı`);
    assert.ok(c.stability >= 0 && c.stability <= 100);
  }
  for (let i = 0; i < world.n; i++) assert.ok(Number.isFinite(g.s.prov.gdp[i]) && g.s.prov.gdp[i] >= 0);
  for (const u of g.s.units) { assert.ok(u.s > 0 && u.s <= 1.0001); assert.ok(!u.dead); }
});

test('kayıt/yükleme deterministik', () => {
  const g1 = newGame({ player: 'DEU' });
  for (let i = 0; i < 20; i++) g1.tick();
  const g2 = Game.deserialize(world, g1.serialize());
  for (let i = 0; i < 25; i++) { g1.tick(); g2.tick(); }
  assert.equal(g1.serialize(), g2.serialize());
});

test('yol bulma: kara ve deniz', () => {
  const g = newGame({ player: 'TUR' });
  const ist = pidByName('İstanbul', 'TUR'), ank = pidByName('Ankara', 'TUR');
  const p1 = mil.findPath(g, 'TUR', ist, ank);
  assert.ok(p1 && p1.length >= 1 && p1[p1.length - 1] === ank);
  // ABD'den Birleşik Krallık'a (müttefik toprağı, deniz yoluyla)
  const usa = g.C('USA').capital, uk = g.C('GBR').capital;
  const p2 = mil.findPath(g, 'USA', usa, uk);
  assert.ok(p2 && p2[p2.length - 1] === uk, 'denizaşırı rota bulunur');
  // Tarafsız ülkeye giriş yok
  const syr = g.C('SYR').capital;
  assert.equal(mil.findPath(g, 'TUR', ank, syr), null, 'savaşta değilken yabancı topraklara girilemez');
});

test('savaş ilanı, muharebe ve işgal', () => {
  const g = newGame({ player: 'TUR' });
  const res = dip.declareWar(g, 'TUR', 'SYR');
  assert.ok(res.ok);
  assert.ok(g.atWar('TUR', 'SYR'));
  const aleppo = pidByName('Halep', 'SYR');
  const ids = g.unitsOf('TUR').map((u) => u.id);
  const r = mil.orderMove(g, 'TUR', ids, aleppo);
  assert.ok(r.ok > 0);
  let taken = false;
  for (let i = 0; i < 120 && !taken; i++) { g.tick(); taken = g.s.prov.ctrl[aleppo] === 'TUR'; }
  assert.ok(taken, 'Halep ele geçirilir');
  assert.ok(g.s.stats.battles > 0);
  const w = g.warBetween('TUR', 'SYR');
  assert.ok(dip.warScore(g, w) > 0, 'savaş skoru saldırgan lehine');
});

test('beyaz barış işgalleri geri verir', () => {
  const g = newGame({ player: 'TUR' });
  dip.declareWar(g, 'TUR', 'SYR');
  const aleppo = pidByName('Halep', 'SYR');
  mil.orderMove(g, 'TUR', g.unitsOf('TUR').map((u) => u.id), aleppo);
  for (let i = 0; i < 120 && g.s.prov.ctrl[aleppo] !== 'TUR'; i++) g.tick();
  const war = g.warBetween('TUR', 'SYR');
  dip.concludePeace(g, war, 'TUR', 'SYR', 'white', true);
  assert.ok(!g.atWar('TUR', 'SYR'));
  assert.equal(g.s.prov.ctrl[aleppo], 'SYR');
  for (const u of g.unitsOf('TUR')) assert.notEqual(g.s.prov.ctrl[u.p], 'SYR', 'birlikler geri çekilir');
});

test('üretim ve araştırma', () => {
  const g = newGame({ player: 'TUR' });
  const c = g.C('TUR');
  const before = g.unitsOf('TUR').length;
  const t0 = c.treasury;
  assert.ok(eco.enqueue(g, 'TUR', 'infantry').ok);
  assert.ok(c.treasury < t0);
  const avail = eco.availableTechs(c)[0];
  assert.ok(eco.startResearch(g, 'TUR', avail.id).ok);
  for (let i = 0; i < 200; i++) g.tick();
  assert.ok(g.unitsOf('TUR').length > before, 'piyade tümeni üretildi');
  assert.ok(c.techs.includes(avail.id), 'teknoloji tamamlandı');
});

test('kararlar ve bekleyen olaylar', () => {
  const g = newGame({ player: 'TUR' });
  const c = g.C('TUR');
  const ws = c.warSupport;
  assert.ok(takeDecision(g, 'TUR', 'propaganda').ok);
  assert.ok(c.warSupport > ws);
  assert.equal(takeDecision(g, 'TUR', 'propaganda').ok, false, 'bekleme süresi');
  // Oyuncuya ittifak teklifi
  dip.proposeTreaty(g, 'AZE', 'TUR', 'nap');
  const p = g.s.pending.find((x) => x.kind === 'treaty');
  assert.ok(p);
  resolvePending(g, p.id, 0);
  assert.ok(g.hasTreaty('nap', 'AZE', 'TUR'));
});

test('stratejik saldırılar', () => {
  const g = newGame({ player: 'TUR' });
  dip.declareWar(g, 'TUR', 'SYR');
  const aleppo = pidByName('Halep', 'SYR');
  const c = g.C('TUR');
  const m0 = c.missiles;
  assert.ok(mil.canStrike(g, 'TUR', aleppo, 'missile').ok);
  mil.missileStrike(g, 'TUR', aleppo);
  assert.equal(c.missiles, m0 - 10);
  assert.ok(mil.canStrike(g, 'TUR', aleppo, 'drone').ok);
  assert.equal(mil.canStrike(g, 'TUR', aleppo, 'nuke').ok, false, 'Türkiye’nin nükleer silahı yok');
});
