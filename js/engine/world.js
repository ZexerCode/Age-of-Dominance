// Statik dünya verisi: il geometrisi, komşuluk, mesafeler (oyun boyunca değişmez)
import { haversine } from './util.js';

export class World {
  constructor(raw) {
    this.raw = raw;
    this.W = raw.w;
    this.H = raw.h;
    this.terrainIds = raw.terrains;
    const q = raw.q;

    // Yaylar → projekte koordinatlar
    this.arcs = raw.arcs.map((a) => {
      const out = new Float32Array(a.length);
      let x = a[0], y = a[1];
      out[0] = x / q; out[1] = y / q;
      for (let i = 2; i < a.length; i += 2) { x += a[i]; y += a[i + 1]; out[i] = x / q; out[i + 1] = y / q; }
      return out;
    });

    this.provinces = raw.provinces.map((p, i) => ({
      id: i,
      name: p.n && p.n !== '?' ? p.n : (p.ct || 'Adalar'),
      tag: p.t,
      geo: p.g,
      label: p.l,
      labelR: p.lr,
      lon: p.ll[0],
      lat: p.ll[1],
      area: p.a,
      terrain: p.tr,
      popShare: p.ps,
      gdpShare: p.gs,
      neighbors: p.nb,
      seaLinks: p.sl || [],
      coastal: !!p.c,
      port: p.pt || null,
      city: p.ct || null,
      bbox: null,
    }));
    this.n = this.provinces.length;

    // Yay → il eşlemesi (sınır çizimi için) ve sınır kutuları
    this.arcProvs = this.arcs.map(() => []);
    for (const p of this.provinces) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const poly of p.geo) for (const ring of poly) for (const a of ring) {
        const ai = a < 0 ? ~a : a;
        const list = this.arcProvs[ai];
        if (!list.includes(p.id)) list.push(p.id);
        const arc = this.arcs[ai];
        for (let k = 0; k < arc.length; k += 2) {
          const x = arc[k], y = arc[k + 1];
          if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
        }
      }
      p.bbox = [x0, y0, x1, y1];
    }

    // Komşuluk listesi: [{to, km, sea}]
    this.adj = this.provinces.map((p) => {
      const out = [];
      for (const j of p.neighbors) {
        const q2 = this.provinces[j];
        out.push({ to: j, km: Math.max(15, haversine(p.lon, p.lat, q2.lon, q2.lat) * 1.12), sea: false });
      }
      for (const [j, d] of p.seaLinks) {
        const q2 = this.provinces[j];
        const km = Math.max(d, haversine(p.lon, p.lat, q2.lon, q2.lat));
        out.push({ to: j, km: Math.max(30, km), sea: true });
      }
      return out;
    });
    this.landNeighborSet = this.provinces.map((p) => new Set(p.neighbors));
    this.adjSet = this.adj.map((list) => new Set(list.map((e) => e.to)));
    this.coastalList = this.provinces.filter((p) => p.coastal).map((p) => p.id);

    // Ülke meta verisi
    this.countryMeta = raw.countries;
    this.cities = raw.cities;

    // İsabet testi için ızgara
    this.gridSize = 24;
    this.gridW = Math.ceil(this.W / this.gridSize);
    this.gridH = Math.ceil(this.H / this.gridSize);
    this.grid = new Map();
    for (const p of this.provinces) {
      const [x0, y0, x1, y1] = p.bbox;
      for (let gx = Math.floor(x0 / this.gridSize); gx <= Math.floor(x1 / this.gridSize); gx++) {
        for (let gy = Math.floor(y0 / this.gridSize); gy <= Math.floor(y1 / this.gridSize); gy++) {
          const key = gy * 10000 + gx;
          if (!this.grid.has(key)) this.grid.set(key, []);
          this.grid.get(key).push(p.id);
        }
      }
    }
  }

  // İl halkalarını nokta dizileri olarak üretir
  *rings(pid) {
    const p = this.provinces[pid];
    for (const poly of p.geo) {
      for (const ring of poly) {
        const pts = [];
        for (const a of ring) {
          const arc = this.arcs[a < 0 ? ~a : a];
          const n = arc.length / 2;
          if (a >= 0) { for (let k = pts.length ? 1 : 0; k < n; k++) pts.push(arc[k * 2], arc[k * 2 + 1]); }
          else { for (let k = n - 1 - (pts.length ? 1 : 0); k >= 0; k--) pts.push(arc[k * 2], arc[k * 2 + 1]); }
        }
        yield pts;
      }
    }
  }

  provinceAt(x, y) {
    const key = Math.floor(y / this.gridSize) * 10000 + Math.floor(x / this.gridSize);
    const cands = this.grid.get(key);
    if (!cands) return -1;
    for (const pid of cands) {
      const b = this.provinces[pid].bbox;
      if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
      let inside = false;
      for (const pts of this.rings(pid)) {
        for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
          const xi = pts[i], yi = pts[i + 1], xj = pts[j], yj = pts[j + 1];
          if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
        }
      }
      if (inside) return pid;
    }
    return -1;
  }

  distKm(a, b) {
    const p = this.provinces[a], q = this.provinces[b];
    return haversine(p.lon, p.lat, q.lon, q.lat);
  }
  // Deniz nakliyesi mesafesi (liman noktaları arası)
  seaKm(a, b) {
    const p = this.provinces[a], q = this.provinces[b];
    const pa = p.port || [p.lon, p.lat], pb = q.port || [q.lon, q.lat];
    return haversine(pa[0], pa[1], pb[0], pb[1]) * 1.25 + 60;
  }
  edgeKm(a, b) {
    for (const e of this.adj[a]) if (e.to === b) return e.km;
    return null;
  }
}
