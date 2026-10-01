// Age of Dominance — dünya il haritası üretim hattı
// Kaynak: Natural Earth 1:10m (kamu malı). Çıktı: data/world.json
//
// Adımlar:
//  1. Admin-1 (il/eyalet) sınırlarını sadeleştir, topoloji kur
//  2. Bağımlı toprakları egemen ülkelere bağla, küçük birimleri birleştir
//  3. Çok büyük bölgeleri (Sibirya, Alaska...) şehir adlarıyla parçalara böl
//  4. Projeksiyon (Miller), komşuluk, kıyı, deniz bağlantıları
//  5. Arazi sınıflandırması, nüfus/GSYH payları, başkentler, şehirler
//
// Kullanım: ./tools/fetch-natural-earth.sh && node tools/build-map.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mapshaper from 'mapshaper';
import * as topojson from 'topojson-client';
import { geoArea, geoDistance } from 'd3-geo';
import polylabel from 'polylabel';
import polygonClipping from 'polygon-clipping';
import { Delaunay } from 'd3-delaunay';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NE = path.join(__dirname, '.cache', 'ne');
const OUT = path.join(__dirname, '..', 'data', 'world.json');
const R_EARTH = 6371;
const DEG = Math.PI / 180;

// ---------------------------------------------------------------------------
// Yapılandırma
// ---------------------------------------------------------------------------

// Bağımlı topraklar / özel bölgeler → oyundaki ülke etiketi
const TAG_MAP = {
  GRL: 'DNK', FRO: 'DNK',
  HKG: 'CHN', MAC: 'CHN',
  SAH: 'MAR', SOL: 'SOM', PSX: 'PSE', KAS: 'IND', KAB: 'KAZ', ALD: 'FIN',
  USG: 'CUB', ESB: 'CYP', WSB: 'CYP',
  PRI: 'USA', GUM: 'USA', VIR: 'USA', ASM: 'USA', MNP: 'USA',
  BMU: 'GBR', CYM: 'GBR', TCA: 'GBR', VGB: 'GBR', AIA: 'GBR', MSR: 'GBR',
  FLK: 'GBR', GIB: 'GBR', SHN: 'GBR', IMN: 'GBR', JEY: 'GBR', GGY: 'GBR',
  NCL: 'FRA', PYF: 'FRA', WLF: 'FRA', SPM: 'FRA', BLM: 'FRA', MAF: 'FRA',
  ABW: 'NLD', CUW: 'NLD', SXM: 'NLD',
  COK: 'NZL', NIU: 'NZL',
  NFK: 'AUS', IOA: 'AUS',
};
// Haritadan çıkarılan (ıssız/önemsiz) bölgeler
const DROP = new Set(['ATA', 'ATF', 'HMD', 'SGS', 'CLP', 'PGA', 'ATC', 'CSI', 'IOT', 'UMI', 'PCN']);

// Ülke başına minimum il alanı (km²). Daha küçük birimler komşularıyla birleşir.
const MIN_AREA_DEFAULT = 4500;
const MIN_AREA = { TUR: 0, ISR: 0, PSE: 0, CYN: 0, CYP: 2500, LBN: 2500, KOS: 3000, SGP: 0, QAT: 4000, BHR: 0, KWT: 0, ARE: 6000 };
// Bundan büyük bölgeler parçalanır
const MAX_AREA = 190000;
const SPLIT_TARGET = 145000;
const SPLIT_MAX = 10;

// Projeksiyon: Miller silindirik, dünya genişliği W birim
const W = 3600;
const RU = W / (2 * Math.PI);
const LAT_TOP = 84, LAT_BOTTOM = -60;
const millerY = (lat) => 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * lat * DEG));
const Y_TOP = millerY(LAT_TOP);
const H = Math.round((Y_TOP - millerY(LAT_BOTTOM)) * RU);
const project = (lon, lat) => [(lon + 180) / 360 * W, (Y_TOP - millerY(Math.max(-89, Math.min(89, lat)))) * RU];
const unprojectLat = (y) => (2.5 * Math.atan(Math.exp((Y_TOP - y / RU) / 1.25)) - 0.625 * Math.PI) / DEG;
const unproject = (x, y) => [x / W * 360 - 180, unprojectLat(y)];
const Q = 10; // koordinat hassasiyeti: 0.1 birim

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------
const log = (...a) => console.log('[harita]', ...a);
const readJSON = (f) => JSON.parse(fs.readFileSync(path.join(NE, f), 'utf8'));

function sphereAreaKm2(geom) {
  let a = geoArea({ type: 'Feature', geometry: geom });
  if (a > 2 * Math.PI) a = 4 * Math.PI - a;
  return a * R_EARTH * R_EARTH;
}

function polysOf(geom) {
  if (!geom) return [];
  if (geom.type === 'Polygon') return [geom.coordinates];
  if (geom.type === 'MultiPolygon') return geom.coordinates;
  return [];
}

function ringContains(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function polysContain(polys, x, y) {
  for (const poly of polys) {
    if (!ringContains(poly[0], x, y)) continue;
    let inHole = false;
    for (let h = 1; h < poly.length; h++) if (ringContains(poly[h], x, y)) { inHole = true; break; }
    if (!inHole) return true;
  }
  return false;
}
function bboxOfPolys(polys) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of polys) for (const [x, y] of p[0]) {
    if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
  }
  return [x0, y0, x1, y1];
}
// Deterministik rastgele sayı üreteci (yeniden üretilebilir çıktı için)
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
function samplePoints(polys, n, rand) {
  const [x0, y0, x1, y1] = bboxOfPolys(polys);
  const pts = [];
  let tries = 0;
  while (pts.length < n && tries < n * 60) {
    tries++;
    const x = x0 + (x1 - x0) * rand(), y = y0 + (y1 - y0) * rand();
    if (polysContain(polys, x, y)) pts.push([x, y]);
  }
  return pts;
}
function gcKm(a, b) { return geoDistance(a, b) * R_EARTH; }

const TR_SUFFIXES = [
  ' Özerk Cumhuriyeti', ' Özerk Bölgesi', ' Özerk Okrugu', ' Özerk Oblastı', ' Federal Şehri', ' Federal Bölgesi',
  ' İdari Bölgesi', ' Cumhuriyeti', ' Oblastı', ' oblastı', ' Bölgesi', ' bölgesi', ' kazası', ' Kazası', ' ili', ' İli',
  ' Eyaleti', ' eyaleti', ' Valiliği', ' valiliği', ' Vilayeti', ' vilayeti', ' Prefektörlüğü', ' prefektörlüğü',
  ' Departmanı', ' departmanı', ' Kontluğu', ' kontluğu', ' İlçesi', ' ilçesi', ' Belediyesi', ' belediyesi',
  ' Krayı', ' krayı', ' Kantonu', ' kantonu', ' Voyvodalığı', ' Bölge', ' Eyalet', ' Şehri', ' şehri', ' Vilâyeti', ' Valiliği',
];
function cleanName(p) {
  const base = p.name || p.name_en || '?';
  if (!p.name_tr || p.adm0_a3 === 'KOS') return base;
  let n = String(p.name_tr).trim();
  let changed = true;
  while (changed) {
    changed = false;
    for (const s of TR_SUFFIXES) if (n.endsWith(s) && n.length > s.length + 1) { n = n.slice(0, -s.length).trim(); changed = true; }
  }
  if (!n || n.length > base.length * 2 + 8) return base;
  if (GENERIC_NAMES.has(n)) return null; // genel ad → en büyük şehir adı kullanılır
  if (/[^\u0000-\u024F]/.test(n) || /[ŏḷ]/.test(n)) return base;
  return n;
}
const GENERIC_NAMES = new Set(['Federal', 'Başkent', 'Nacional', 'Merkez', 'Capital', 'Central', 'Federal Başkent', 'Başkent Bölgesi', 'Ulusal', 'El Asime', 'Batı', 'Doğu', 'Kuzey', 'Güney', 'Orta', 'Western', 'Eastern', 'Northern', 'Southern']);

// ---------------------------------------------------------------------------
// 1. Sadeleştirme + topoloji
// ---------------------------------------------------------------------------
log('admin-1 okunuyor ve sadeleştiriliyor...');
const pass1 = await mapshaper.applyCommands(
  `-i ${path.join(NE, 'ne_10m_admin_1_states_provinces.geojson')} ` +
  `-filter-fields adm1_code,name,name_tr,name_en,region,adm0_a3 ` +
  `-simplify 30% weighted keep-shapes ` +
  `-o pass1.json format=topojson no-quantization`
);
const topo1 = JSON.parse(pass1['pass1.json']);
const obj1 = topo1.objects[Object.keys(topo1.objects)[0]];
const geoms1 = obj1.geometries;
log('birim sayısı:', geoms1.length);

const nb1 = topojson.neighbors(geoms1);
const units = geoms1.map((g, i) => {
  const p = g.properties;
  const src = p.adm0_a3;
  const tag = TAG_MAP[src] || src;
  const feat = topojson.feature(topo1, g);
  return {
    i, src, tag, drop: DROP.has(src) || !feat.geometry,
    name: cleanName(p), region: p.region || '', geom: feat.geometry,
    area: feat.geometry ? sphereAreaKm2(feat.geometry) : 0,
  };
});

// Şehirler (nüfus dağılımı, adlandırma, başkentler)
const placesRaw = readJSON('ne_10m_populated_places_simple.geojson').features
  .map((f) => f.properties)
  .filter((p) => p.featurecla !== 'Scientific station' && p.featurecla !== 'Meteorological Station' && p.featurecla !== 'Historic place');
const places = placesRaw.map((p) => ({
  name: p.name, lon: p.longitude, lat: p.latitude, pop: Math.max(p.pop_max || 0, p.pop_min || 0),
  cap: p.adm0cap === 1 && p.featurecla === 'Admin-0 capital', tag: TAG_MAP[p.adm0_a3] || p.adm0_a3,
}));
log('şehir sayısı:', places.length);

// Birimlerin içindeki şehirler
function assignPlacesToUnits(list, getPolys) {
  const res = list.map(() => []);
  const boxes = list.map((u) => (getPolys(u).length ? bboxOfPolys(getPolys(u)) : null));
  for (const pl of places) {
    for (let k = 0; k < list.length; k++) {
      const b = boxes[k];
      if (!b || pl.lon < b[0] || pl.lon > b[2] || pl.lat < b[1] || pl.lat > b[3]) continue;
      if (polysContain(getPolys(list[k]), pl.lon, pl.lat)) { res[k].push(pl); break; }
    }
  }
  return res;
}
const unitPlaces = assignPlacesToUnits(units, (u) => (u.drop ? [] : polysOf(u.geom)));
units.forEach((u, k) => {
  u.places = unitPlaces[k];
  u.cityPop = u.places.reduce((s, p) => s + p.pop, 0);
  if (u.name === null) {
    const big = [...u.places].sort((a, b) => b.pop - a.pop)[0];
    u.name = big ? big.name : (geoms1[u.i].properties.name || '?');
  }
});

// ---------------------------------------------------------------------------
// 2. Küçük birimleri birleştir
// ---------------------------------------------------------------------------
log('küçük birimler birleştiriliyor...');
const parent = units.map((u) => u.i);
const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
const gArea = units.map((u) => u.area);
const gRegion = units.map((u) => u.region);
const gCenter = units.map((u) => {
  const polys = polysOf(u.geom);
  if (!polys.length) return [0, 0];
  let best = polys[0], bestA = 0;
  for (const p of polys) { const a = Math.abs(ringAreaPlanar(p[0])); if (a > bestA) { bestA = a; best = p; } }
  const pl = polylabel(best, 0.05);
  return [pl[0], pl[1]];
});
function ringAreaPlanar(r) {
  let s = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]);
  return s / 2;
}

const byTag = new Map();
for (const u of units) {
  if (u.drop) continue;
  if (!byTag.has(u.tag)) byTag.set(u.tag, []);
  byTag.get(u.tag).push(u.i);
}

for (const [tag, list] of byTag) {
  const minArea = MIN_AREA[tag] ?? MIN_AREA_DEFAULT;
  if (minArea <= 0) continue;
  const finalized = new Set();
  for (;;) {
    // en küçük grup
    const roots = [...new Set(list.map(find))];
    if (roots.length <= 1) break;
    let small = -1, smallA = Infinity;
    for (const r of roots) if (!finalized.has(r) && gArea[r] < minArea && gArea[r] < smallA) { smallA = gArea[r]; small = r; }
    if (small < 0) break;
    // kara komşuları (aynı ülke)
    const cands = new Set();
    for (const m of list) {
      if (find(m) !== small) continue;
      for (const n of nb1[m]) {
        const un = units[n];
        if (un.drop || un.tag !== tag) continue;
        const rn = find(n);
        if (rn !== small) cands.add(rn);
      }
    }
    let target = -1;
    if (cands.size) {
      let bestScore = Infinity;
      for (const c of cands) {
        const score = gArea[c] * (gRegion[c] && gRegion[c] === gRegion[small] ? 0.35 : 1);
        if (score < bestScore) { bestScore = score; target = c; }
      }
    } else {
      // ada: en yakın aynı ülke grubuna bağla
      let bestD = Infinity;
      for (const r of roots) {
        if (r === small) continue;
        const d = gcKm(gCenter[small], gCenter[r]);
        if (d < bestD) { bestD = d; target = r; }
      }
      if (bestD > 450) target = -1;
    }
    if (target < 0) { finalized.add(small); continue; }
    // birleştir: büyük olan kök kalsın
    const [keep, gone] = gArea[target] >= gArea[small] ? [target, small] : [small, target];
    parent[gone] = keep;
    gArea[keep] += gArea[gone];
    if (!gRegion[keep]) gRegion[keep] = gRegion[gone];
  }
}

// Grupları oluştur
const groups = new Map();
for (const u of units) {
  if (u.drop) continue;
  const r = find(u.i);
  if (!groups.has(r)) groups.set(r, { tag: u.tag, members: [] });
  groups.get(r).members.push(u.i);
}
log('birleşme sonrası il sayısı:', groups.size);

// Grup geometrisi ve adı
const provinces0 = [];
for (const [, g] of groups) {
  const geom = g.members.length === 1
    ? units[g.members[0]].geom
    : topojson.merge(topo1, g.members.map((m) => geoms1[m]));
  // ad: en kalabalık şehre sahip üye; yoksa en büyük alan
  let best = g.members[0];
  for (const m of g.members) {
    const a = units[m], b = units[best];
    if (a.cityPop > b.cityPop || (a.cityPop === b.cityPop && a.area > b.area)) best = m;
  }
  const places = g.members.flatMap((m) => units[m].places);
  const area = g.members.reduce((s, m) => s + units[m].area, 0);
  provinces0.push({ tag: g.tag, name: units[best].name, geom, area, places });
}

// ---------------------------------------------------------------------------
// 3. Büyük bölgeleri parçala
// ---------------------------------------------------------------------------
log('büyük bölgeler parçalanıyor...');
const DIRS = ['Doğu', 'Kuzeydoğu', 'Kuzey', 'Kuzeybatı', 'Batı', 'Güneybatı', 'Güney', 'Güneydoğu'];
function dirName(base, c, center) {
  const ang = Math.atan2(c[1] - center[1], (c[0] - center[0]) * Math.cos(center[1] * DEG));
  const idx = ((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8;
  return `${DIRS[idx]} ${base}`;
}

const provinces1 = [];
let splitCount = 0;
for (const p of provinces0) {
  if (p.area <= MAX_AREA) { provinces1.push(p); continue; }
  const k = Math.min(SPLIT_MAX, Math.ceil(p.area / SPLIT_TARGET));
  const polys = polysOf(p.geom);
  const rand = rng(Math.round(p.area));
  const pts = samplePoints(polys, 1500, rand);
  if (pts.length < k * 10) { provinces1.push(p); continue; }
  const lat0 = pts.reduce((s, q) => s + q[1], 0) / pts.length;
  const cx = Math.cos(lat0 * DEG);
  const P = pts.map(([x, y]) => [x * cx, y]);
  // k-means++ benzeri başlatma: büyük şehirler öncelikli
  const sortedPlaces = [...p.places].sort((a, b) => b.pop - a.pop);
  let C = [];
  for (const pl of sortedPlaces) {
    if (C.length >= k) break;
    const q = [pl.lon * cx, pl.lat];
    if (C.every((c) => Math.hypot(c[0] - q[0], c[1] - q[1]) > 2.5)) C.push(q);
  }
  while (C.length < k) {
    let far = P[0], farD = -1;
    for (const q of P) {
      const d = Math.min(...C.map((c) => Math.hypot(c[0] - q[0], c[1] - q[1])), Infinity);
      if (d > farD) { farD = d; far = q; }
    }
    C.push([...far]);
  }
  for (let it = 0; it < 30; it++) {
    const sum = C.map(() => [0, 0, 0]);
    for (const q of P) {
      let bi = 0, bd = Infinity;
      for (let j = 0; j < C.length; j++) { const d = (C[j][0] - q[0]) ** 2 + (C[j][1] - q[1]) ** 2; if (d < bd) { bd = d; bi = j; } }
      sum[bi][0] += q[0]; sum[bi][1] += q[1]; sum[bi][2]++;
    }
    C = C.map((c, j) => (sum[j][2] ? [sum[j][0] / sum[j][2], sum[j][1] / sum[j][2]] : c));
  }
  const [bx0, by0, bx1, by1] = bboxOfPolys(polys);
  const del = Delaunay.from(C);
  const vor = del.voronoi([bx0 * cx - 1, by0 - 1, bx1 * cx + 1, by1 + 1]);
  const center = [C.reduce((s, c) => s + c[0], 0) / C.length / cx, C.reduce((s, c) => s + c[1], 0) / C.length];
  const pieces = [];
  for (let j = 0; j < C.length; j++) {
    const cell = vor.cellPolygon(j);
    if (!cell) continue;
    const cellLL = [cell.map(([x, y]) => [x / cx, y])];
    let inter;
    try { inter = polygonClipping.intersection(p.geom.type === 'Polygon' ? [p.geom.coordinates] : p.geom.coordinates, [cellLL]); }
    catch (e) { inter = null; }
    if (!inter || !inter.length) continue;
    const geom = { type: 'MultiPolygon', coordinates: inter };
    const area = sphereAreaKm2(geom);
    if (area < 500) continue;
    const myPlaces = p.places.filter((pl) => polysContain(inter, pl.lon, pl.lat));
    pieces.push({ geom, area, places: myPlaces, c: [C[j][0] / cx, C[j][1]] });
  }
  if (pieces.length < 2) { provinces1.push(p); continue; }
  splitCount++;
  const usedNames = new Set();
  // en kalabalık şehri içeren parça orijinal adı korur
  let mainIdx = 0, mainPop = -1;
  pieces.forEach((pc, j) => { const mp = Math.max(0, ...pc.places.map((x) => x.pop)); if (mp > mainPop) { mainPop = mp; mainIdx = j; } });
  pieces.forEach((pc, j) => {
    let name;
    if (j === mainIdx) name = p.name;
    else {
      const big = [...pc.places].sort((a, b) => b.pop - a.pop).find((pl) => pl.pop >= 8000 && !usedNames.has(pl.name));
      name = big ? big.name : dirName(p.name, pc.c, center);
    }
    let n = name, s = 2;
    while (usedNames.has(n)) n = `${name} ${s++}`;
    usedNames.add(n);
    provinces1.push({ tag: p.tag, name: n, geom: pc.geom, area: pc.area, places: pc.places });
  });
}
log(`parçalanan bölge: ${splitCount}, toplam il: ${provinces1.length}`);

// ---------------------------------------------------------------------------
// 4. Son topoloji
// ---------------------------------------------------------------------------
log('son topoloji kuruluyor...');
const fc = {
  type: 'FeatureCollection',
  features: provinces1.map((p, i) => ({ type: 'Feature', properties: { pid: i }, geometry: p.geom })),
};
const pass2 = await mapshaper.applyCommands(
  '-i in.json snap snap-interval=0.0005 -simplify 65% weighted keep-shapes -o out.json format=topojson no-quantization',
  { 'in.json': fc }
);
const topo2 = JSON.parse(pass2['out.json']);
const geoms2 = topo2.objects[Object.keys(topo2.objects)[0]].geometries.filter((g) => g.type);
log('topoloji il sayısı:', geoms2.length, 'yay sayısı:', topo2.arcs.length);

// Yayları projekte et ve nicemle
let vertexCount = 0;
const arcsQ = topo2.arcs.map((arc) => {
  const out = [];
  let px = null, py = null;
  for (let k = 0; k < arc.length; k++) {
    const [x, y] = project(arc[k][0], arc[k][1]);
    const qx = Math.round(x * Q), qy = Math.round(y * Q);
    if (qx === px && qy === py && k !== arc.length - 1) continue;
    out.push([qx, qy]); px = qx; py = qy;
  }
  if (out.length === 1) out.push(out[0]);
  vertexCount += out.length;
  return out;
});
log('toplam köşe:', vertexCount);

// İl geometrileri (yay indeksleri)
const provinces = [];
for (const g of geoms2) {
  const src = provinces1[g.properties.pid];
  const polysArcs = g.type === 'Polygon' ? [g.arcs] : g.arcs;
  const feat = topojson.feature(topo2, g);
  provinces.push({ ...src, polysArcs, geomLL: feat.geometry });
}

// Yay sahipleri → komşuluk ve kıyı
const arcOwners = topo2.arcs.map(() => []);
provinces.forEach((p, pi) => {
  for (const poly of p.polysArcs) for (const ring of poly) for (const a of ring) {
    const ai = a < 0 ? ~a : a;
    if (!arcOwners[ai].includes(pi)) arcOwners[ai].push(pi);
  }
});
const neighbors = provinces.map(() => new Set());
const coastal = provinces.map(() => false);
arcOwners.forEach((owners) => {
  if (owners.length === 1) coastal[owners[0]] = true;
  for (const a of owners) for (const b of owners) if (a !== b) neighbors[a].add(b);
});

// Projekte halkalar
function ringPoints(ring) {
  const pts = [];
  for (const a of ring) {
    const arc = arcsQ[a < 0 ? ~a : a];
    const seq = a < 0 ? [...arc].reverse() : arc;
    for (let k = pts.length ? 1 : 0; k < seq.length; k++) pts.push([seq[k][0] / Q, seq[k][1] / Q]);
  }
  return pts;
}

// Etiket noktası (polylabel, projekte düzlemde)
provinces.forEach((p) => {
  let best = null, bestA = -1;
  const projPolys = p.polysArcs.map((poly) => poly.map(ringPoints));
  for (const poly of projPolys) { const a = Math.abs(ringAreaPlanar(poly[0])); if (a > bestA) { bestA = a; best = poly; } }
  const pl = polylabel(best, 0.25);
  p.label = [Math.round(pl[0] * 10) / 10, Math.round(pl[1] * 10) / 10];
  p.labelR = Math.round(pl.distance * 10) / 10;
  p.ll = unproject(p.label[0], p.label[1]).map((v) => Math.round(v * 100) / 100);
  p.projPolys = projPolys;
});

// ---------------------------------------------------------------------------
// 5. Deniz bağlantıları
// ---------------------------------------------------------------------------
log('deniz bağlantıları hesaplanıyor...');
const coastPts = provinces.map(() => []);
arcOwners.forEach((owners, ai) => {
  if (owners.length !== 1) return;
  const arc = topo2.arcs[ai];
  const step = Math.max(1, Math.floor(arc.length / 12));
  for (let k = 0; k < arc.length; k += step) coastPts[owners[0]].push(arc[k]);
});
// Izgara
const CELL = 2; // derece
const grid = new Map();
coastPts.forEach((pts, pi) => {
  for (const pt of pts) {
    const key = `${Math.floor(pt[0] / CELL)},${Math.floor(pt[1] / CELL)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push([pt[0], pt[1], pi]);
  }
});
function landHops(a, b, maxDepth) {
  if (a === b) return 0;
  let frontier = [a]; const seen = new Set([a]);
  for (let d = 1; d <= maxDepth; d++) {
    const next = [];
    for (const x of frontier) for (const y of neighbors[x]) {
      if (y === b) return d;
      if (!seen.has(y)) { seen.add(y); next.push(y); }
    }
    frontier = next;
  }
  return Infinity;
}
const SEA_LINK_KM = 160;
const seaLinks = provinces.map(() => new Map()); // pi -> Map(pj -> km)
const pairBest = new Map();
coastPts.forEach((pts, pi) => {
  for (const pt of pts) {
    const cx = Math.floor(pt[0] / CELL), cy = Math.floor(pt[1] / CELL);
    for (let dx = -2; dx <= 2; dx++) for (let dy = -1; dy <= 1; dy++) {
      const cell = grid.get(`${cx + dx},${cy + dy}`);
      if (!cell) continue;
      for (const [x, y, pj] of cell) {
        if (pj <= pi) continue;
        const d = gcKm(pt, [x, y]);
        if (d > SEA_LINK_KM) continue;
        const key = pi * 100000 + pj;
        if (!pairBest.has(key) || pairBest.get(key) > d) pairBest.set(key, d);
      }
    }
  }
});
for (const [key, d] of pairBest) {
  const pi = Math.floor(key / 100000), pj = key % 100000;
  if (neighbors[pi].has(pj)) continue;
  if (landHops(pi, pj, 4) <= 4) continue;
  seaLinks[pi].set(pj, d); seaLinks[pj].set(pi, d);
}
// Bağlantısız kara kütlelerini en yakın kara kütlesine bağla
function components() {
  const comp = provinces.map(() => -1); let c = 0;
  for (let i = 0; i < provinces.length; i++) {
    if (comp[i] >= 0) continue;
    const st = [i]; comp[i] = c;
    while (st.length) {
      const x = st.pop();
      for (const y of [...neighbors[x], ...seaLinks[x].keys()]) if (comp[y] < 0) { comp[y] = c; st.push(y); }
    }
    c++;
  }
  return { comp, count: c };
}
const repPts = coastPts.map((pts, i) => {
  const src = pts.length ? pts : [provinces[i].ll];
  const step = Math.max(1, Math.floor(src.length / 16));
  return src.filter((_, k) => k % step === 0);
});
for (let iter = 0; iter < 400; iter++) {
  const { comp, count } = components();
  if (count <= 1) break;
  // en küçük bileşeni en yakın diğer bileşene bağla
  const sizes = new Array(count).fill(0); comp.forEach((c) => sizes[c]++);
  let target = 0; for (let c = 1; c < count; c++) if (sizes[c] < sizes[target]) target = c;
  let best = null;
  for (let i = 0; i < provinces.length; i++) {
    if (comp[i] !== target) continue;
    for (const pt of repPts[i]) {
      for (let j = 0; j < provinces.length; j++) {
        if (comp[j] === target) continue;
        // kaba ön eleme
        if (Math.abs(provinces[j].ll[1] - pt[1]) > 30) continue;
        for (const q of repPts[j]) {
          const d = gcKm(pt, q);
          if (!best || d < best.d) best = { i, j, d };
        }
      }
    }
  }
  if (!best) break;
  seaLinks[best.i].set(best.j, best.d); seaLinks[best.j].set(best.i, best.d);
}
log('deniz bağlantısı sayısı:', seaLinks.reduce((s, m) => s + m.size, 0) / 2);

// Liman noktası (kıyı): etiket noktasına en yakın kıyı noktası
provinces.forEach((p, pi) => {
  if (!coastal[pi] || !coastPts[pi].length) return;
  let best = coastPts[pi][0], bd = Infinity;
  for (const q of coastPts[pi]) { const d = gcKm(p.ll, q); if (d < bd) { bd = d; best = q; } }
  p.port = [Math.round(best[0] * 100) / 100, Math.round(best[1] * 100) / 100];
});

// ---------------------------------------------------------------------------
// 6. Arazi
// ---------------------------------------------------------------------------
log('arazi sınıflandırılıyor...');
const geo = readJSON('ne_10m_geography_regions_polys.geojson').features.map((f) => ({
  cls: f.properties.FEATURECLA, polys: polysOf(f.geometry), name: f.properties.NAME,
})).filter((g) => ['Range/mtn', 'Desert', 'Tundra', 'Wetlands', 'Plateau', 'Foothills', 'Delta', 'Plain', 'Lowland', 'Basin'].includes(g.cls));
geo.forEach((g) => { g.bbox = bboxOfPolys(g.polys); });
const JUNGLE_BOXES = [[-80, -16, -44, 8], [-92, 7, -77, 18], [8, -8, 31, 6], [-13, 4, 10, 8.5], [92, -11, 155, 22], [-62, 1, -50, 9]];
const inBox = (lon, lat, b) => lon >= b[0] && lon <= b[2] && lat >= b[1] && lat <= b[3];
// Kodlar: 0 ova, 1 orman, 2 tepe, 3 dağ, 4 çöl, 5 orman (tropik), 6 bataklık, 7 kentsel, 8 kutup
const TERRAIN_NAMES = ['plains', 'forest', 'hills', 'mountain', 'desert', 'jungle', 'marsh', 'urban', 'arctic'];
provinces.forEach((p, pi) => {
  const polys = polysOf(p.geomLL);
  const rand = rng(pi * 7919 + 13);
  let pts = samplePoints(polys, 24, rand);
  if (!pts.length) pts = [p.ll];
  const frac = {};
  for (const [x, y] of pts) {
    const hit = new Set();
    for (const g of geo) {
      if (x < g.bbox[0] || x > g.bbox[2] || y < g.bbox[1] || y > g.bbox[3]) continue;
      if (polysContain(g.polys, x, y)) hit.add(g.cls);
    }
    for (const c of hit) frac[c] = (frac[c] || 0) + 1 / pts.length;
  }
  const lat = pts.reduce((s, q) => s + q[1], 0) / pts.length;
  const lon = pts.reduce((s, q) => s + q[0], 0) / pts.length;
  const mtn = frac['Range/mtn'] || 0, des = frac.Desert || 0, tun = frac.Tundra || 0, wet = (frac.Wetlands || 0) + (frac.Delta || 0) * 0.6;
  const plat = frac.Plateau || 0, foot = frac.Foothills || 0;
  const cityDensity = p.places.reduce((s, q) => s + q.pop, 0) / Math.max(1, p.area);
  let t = 0;
  if (cityDensity > 450 && p.area < 25000) t = 7;
  else if (mtn >= 0.45) t = 3;
  else if (des >= 0.45) t = 4;
  else if (tun >= 0.35 || Math.abs(lat) > 65) t = 8;
  else if (wet >= 0.4) t = 6;
  else if (mtn >= 0.18 || plat >= 0.5 || foot >= 0.4) t = 2;
  else if (JUNGLE_BOXES.some((b) => inBox(lon, lat, b)) && !(des > 0.1)) t = 5;
  else if ((lat >= 50 && lat <= 66 && (lon < -52 || lon > 25)) || (lat >= 58 && lat <= 66 && lon >= 5 && lon <= 32)) t = 1;
  else if (lat >= 46 && lat < 50 && lon < -52 && lon > -100) t = 1;
  p.terrain = t;
});
const terrCounts = {};
provinces.forEach((p) => { terrCounts[TERRAIN_NAMES[p.terrain]] = (terrCounts[TERRAIN_NAMES[p.terrain]] || 0) + 1; });
log('arazi dağılımı:', JSON.stringify(terrCounts));

// ---------------------------------------------------------------------------
// 7. Nüfus ve ekonomi payları, başkentler
// ---------------------------------------------------------------------------
log('nüfus payları hesaplanıyor...');
const TERRAIN_DENSITY = [1, 0.35, 0.75, 0.35, 0.04, 0.3, 0.35, 2.5, 0.02];
const tagProv = new Map();
provinces.forEach((p, pi) => { if (!tagProv.has(p.tag)) tagProv.set(p.tag, []); tagProv.get(p.tag).push(pi); });
for (const [, list] of tagProv) {
  const cityTot = list.reduce((s, pi) => s + provinces[pi].places.reduce((a, q) => a + q.pop, 0), 0);
  const ruralTot = list.reduce((s, pi) => s + provinces[pi].area * TERRAIN_DENSITY[provinces[pi].terrain], 0);
  for (const pi of list) {
    const p = provinces[pi];
    const c = p.places.reduce((a, q) => a + q.pop, 0);
    const wc = cityTot > 0 ? c / cityTot : 0;
    const wr = ruralTot > 0 ? p.area * TERRAIN_DENSITY[p.terrain] / ruralTot : 1 / list.length;
    p.popShare = cityTot > 0 ? 0.55 * wc + 0.45 * wr : wr;
    p.gdpShare = cityTot > 0 ? 0.72 * wc + 0.28 * wr : wr;
  }
}

// Başkentler
const capitals = {};
for (const [tag, list] of tagProv) {
  const capPlace = places.filter((pl) => pl.cap && pl.tag === tag).sort((a, b) => b.pop - a.pop)[0];
  let cap = -1;
  if (capPlace) cap = list.find((pi) => provinces[pi].places.includes(capPlace)) ?? -1;
  if (cap < 0) cap = list.reduce((b, pi) => (provinces[pi].popShare > provinces[b].popShare ? pi : b), list[0]);
  capitals[tag] = cap;
}
// Özel durum: KKTC başkenti Lefkoşa — tek il zaten
// Ana şehir adı (il bilgisi için)
provinces.forEach((p) => {
  const big = [...p.places].sort((a, b) => b.pop - a.pop)[0];
  p.city = big ? big.name : null;
});

// Ülke bilgileri (Natural Earth admin-0 yedek değerleri)
const adm0 = readJSON('ne_10m_admin_0_countries.geojson').features.map((f) => f.properties);
const countries = {};
for (const [tag, list] of tagProv) {
  const a = adm0.find((x) => x.ADM0_A3 === tag) || adm0.find((x) => x.SOV_A3 === tag) || {};
  countries[tag] = {
    nameTr: a.NAME_TR || a.NAME || tag,
    nameEn: a.NAME_EN || a.NAME || tag,
    iso2: (a.ISO_A2_EH && a.ISO_A2_EH !== '-99' ? a.ISO_A2_EH : a.ISO_A2) || '',
    pop: a.POP_EST || 0,
    gdp: a.GDP_MD || 0,
    color: a.MAPCOLOR13 || 1,
    capital: capitals[tag],
    provinces: list.length,
  };
}
if (countries.PSE) { countries.PSE.nameTr = 'Filistin'; countries.PSE.iso2 = 'PS'; }

// Önemli şehirler (harita etiketleri)
const cityList = places
  .filter((pl) => pl.pop >= 1000000 || pl.cap)
  .filter((pl) => pl.lat > LAT_BOTTOM && pl.lat < LAT_TOP)
  .map((pl) => { const [x, y] = project(pl.lon, pl.lat); return [pl.name, Math.round(x * 10) / 10, Math.round(y * 10) / 10, Math.round(pl.pop / 1000), pl.cap ? 1 : 0]; });

// ---------------------------------------------------------------------------
// 8. Yazdır
// ---------------------------------------------------------------------------
function encodeArc(arc) {
  const out = [arc[0][0], arc[0][1]];
  for (let k = 1; k < arc.length; k++) out.push(arc[k][0] - arc[k - 1][0], arc[k][1] - arc[k - 1][1]);
  return out;
}
const outProvinces = provinces.map((p, pi) => {
  const o = {
    n: p.name, t: p.tag,
    g: p.polysArcs,
    l: p.label, lr: p.labelR, ll: p.ll,
    a: Math.round(p.area),
    tr: p.terrain,
    ps: Math.round(p.popShare * 1e6) / 1e6,
    gs: Math.round(p.gdpShare * 1e6) / 1e6,
    nb: [...neighbors[pi]].sort((a, b) => a - b),
  };
  if (seaLinks[pi].size) o.sl = [...seaLinks[pi].entries()].map(([j, d]) => [j, Math.round(d)]);
  if (coastal[pi]) { o.c = 1; if (p.port) o.pt = p.port; }
  if (p.city) o.ct = p.city;
  return o;
});
const world = {
  v: 1,
  generated: new Date().toISOString().slice(0, 10),
  source: 'Natural Earth 1:10m (public domain)',
  w: W, h: H, q: Q,
  proj: { type: 'miller', latTop: LAT_TOP, latBottom: LAT_BOTTOM },
  terrains: TERRAIN_NAMES,
  arcs: arcsQ.map(encodeArc),
  provinces: outProvinces,
  countries,
  cities: cityList,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const json = JSON.stringify(world);
fs.writeFileSync(OUT, json);
log(`yazıldı: ${OUT} (${(json.length / 1024 / 1024).toFixed(2)} MB), il: ${outProvinces.length}, ülke: ${Object.keys(countries).length}, şehir: ${cityList.length}`);
