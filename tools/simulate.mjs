// Başsız simülasyon: motoru test etmek ve dengeyi ayarlamak için
import fs from 'node:fs';
import { World } from '../js/engine/world.js';
import { createGame } from '../js/engine/setup.js';
import { Game } from '../js/engine/game.js';
import * as eco from '../js/engine/economy.js';
import { warScore } from '../js/engine/diplomacy.js';

const days = Number(process.argv[2] || 365);
const player = process.argv[3] || null;
const seed = Number(process.argv[4] || 42);
const raw = JSON.parse(fs.readFileSync(new URL('../data/world.json', import.meta.url)));
let t0 = Date.now();
const world = new World(raw);
console.log('dünya yüklendi', Date.now() - t0, 'ms', 'il:', world.n);
t0 = Date.now();
const state = createGame(world, { player, seed });
const g = new Game(world, state);
console.log('oyun kuruldu', Date.now() - t0, 'ms', 'birlik:', g.s.units.length);
const majors = ['USA', 'CHN', 'RUS', 'UKR', 'TUR', 'DEU', 'IND', 'ISR', 'IRN', 'JPN', 'GBR', 'FRA', 'PRK', 'KOR', 'TWN', 'PAK', 'SAU', 'BRA'];
function report() {
  console.log(`--- ${g.dateStr()} | birlik ${g.s.units.length} | muharebe ${g.s.battles.length} | savaş ${g.s.wars.filter(w=>!w.ended).length} | gerginlik ${g.s.worldTension.toFixed(0)}`);
  for (const t of majors) {
    const c = g.C(t); if (!c) continue;
    const b = eco.budgetInfo(g, t);
    const mp = eco.manpowerInfo(g, t);
    console.log(`${t} alive=${c.alive} gdp=${b.gdp.toFixed(0)} tre=${c.treasury.toFixed(1)} net/d=${b.net.toFixed(3)} units=${g.unitsOf(t).length} q=${c.queue.length} fac=${eco.countryFactories(g,t)} mp=${mp.available.toFixed(0)}/${mp.max.toFixed(0)} air=${c.air.toFixed(1)} navy=${c.navy.toFixed(0)} stab=${c.stability.toFixed(0)} ws=${c.warSupport.toFixed(0)} ex=${c.exhaustion.toFixed(1)} techs=${c.techs.length} res=${c.research.map(r=>r.id).join(',')} cf=${c.costFactor.toFixed(2)} def=${c.defPct}`);
  }
  for (const w of g.s.wars.filter(w=>!w.ended)) console.log(`  savaş: ${w.name} [${w.att.join(',')}] vs [${w.def.join(',')}] skor=${warScore(g,w).toFixed(1)} gün=${g.s.day-w.start}`);
}
report();
t0 = Date.now();
let slow = 0;
for (let d = 0; d < days; d++) {
  const t1 = Date.now();
  g.tick();
  const dt = Date.now() - t1;
  if (dt > slow) slow = dt;
  if ((d + 1) % 90 === 0) { console.log(`ort ${(Date.now() - t0) / (d + 1)} ms/gün, en yavaş ${slow} ms`); report(); }
}
console.log('toplam', Date.now() - t0, 'ms');
const important = g.s.news.filter(n => n.important || n.type==='war' || n.type==='peace');
console.log('ÖNEMLİ HABERLER:'); for (const n of important.slice(-60)) console.log(g.dateStr(n.day), n.text);
fs.writeFileSync('/tmp/claude-0/-home-user-Age-of-Dominance/6d9c8cff-8947-5984-91ef-6d5242fce63c/scratchpad/save.json', g.serialize());
