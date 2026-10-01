// Harita oluşturucu: Canvas 2D, dünya sarmalı, harita modları, etiketler, birlikler
import { TERRAINS, UNIT_TYPES } from '../data/rules.js';
import { hexToRgb, mix, shade, rgba, heat, relColor, luminance } from './colors.js';
import { trUpper } from '../engine/util.js';
import { supplyNetwork } from '../engine/military.js';

const DEG = Math.PI / 180;
export const MAP_MODES = [
  { id: 'political', name: 'Siyasi', key: 'Q' },
  { id: 'terrain', name: 'Arazi', key: 'W' },
  { id: 'faction', name: 'İttifaklar', key: 'E' },
  { id: 'diplomacy', name: 'Diplomasi', key: 'R' },
  { id: 'economy', name: 'Ekonomi', key: 'T' },
  { id: 'population', name: 'Nüfus', key: 'Y' },
  { id: 'industry', name: 'Sanayi', key: 'U' },
  { id: 'supply', name: 'Cephe ve İkmal', key: 'I' },
];
const FACTION_GREY = '#7d8186';
const TILE = 240;

// Görünür alan dışında kalan sınırları çizmemek için karolara bölünmüş yol kümesi
class TiledPath {
  constructor() { this.tiles = new Map(); }
  add(arc) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let k = 0; k < arc.length; k += 2) {
      const x = arc[k], y = arc[k + 1];
      if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
    }
    const key = Math.floor((y0 + y1) / 2 / TILE) * 1000 + Math.floor((x0 + x1) / 2 / TILE);
    let t = this.tiles.get(key);
    if (!t) { t = { path: new Path2D(), bbox: [x0, y0, x1, y1] }; this.tiles.set(key, t); }
    const b = t.bbox;
    if (x0 < b[0]) b[0] = x0; if (y0 < b[1]) b[1] = y0; if (x1 > b[2]) b[2] = x1; if (y1 > b[3]) b[3] = y1;
    t.path.moveTo(arc[0], arc[1]);
    for (let k = 2; k < arc.length; k += 2) t.path.lineTo(arc[k], arc[k + 1]);
  }
  stroke(ctx, vb) {
    for (const t of this.tiles.values()) {
      const b = t.bbox;
      if (b[2] < vb[0] || b[0] > vb[2] || b[3] < vb[1] || b[1] > vb[3]) continue;
      ctx.stroke(t.path);
    }
  }
}

export class MapRenderer {
  constructor(canvas, world) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.world = world;
    this.W = world.W;
    this.H = world.H;
    this.RU = this.W / (2 * Math.PI);
    this.latTop = world.raw.proj.latTop;
    this.yTop = 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * this.latTop * DEG));
    this.cam = { x: this.W * 0.56, y: this.H * 0.36, z: 1 };
    this.mode = 'political';
    this.game = null;
    this.dpr = 1;
    this.dirty = true;
    this.hover = -1;
    this.selectedPid = -1;
    this.selectedCountry = null;
    this.selectedUnits = new Set();
    this.previewPath = null;
    this.effects = [];
    this.counterHits = [];
    this.flagImages = new Map();
    this.showLabels = true;
    this.buildProvincePaths();
    this.buildNoise();
    this.resize();
  }

  // ------------------------------------------------------------------ kurulum
  setGame(game) {
    this.game = game;
    this.rebuildPolitical(true);
    this.dirty = true;
  }
  buildProvincePaths() {
    const W = this.world;
    this.provPaths = new Array(W.n);
    for (let i = 0; i < W.n; i++) {
      const p = new Path2D();
      for (const pts of W.rings(i)) {
        p.moveTo(pts[0], pts[1]);
        for (let k = 2; k < pts.length; k += 2) p.lineTo(pts[k], pts[k + 1]);
        p.closePath();
      }
      this.provPaths[i] = p;
    }
    // Kıyı yayları sabit
    this.coastPath = new TiledPath();
    this.world.arcs.forEach((arc, ai) => {
      if (this.world.arcProvs[ai].length !== 1) return;
      this.coastPath.add(arc);
    });
  }
  addArc(path, arc) {
    path.moveTo(arc[0], arc[1]);
    for (let k = 2; k < arc.length; k += 2) path.lineTo(arc[k], arc[k + 1]);
  }
  buildNoise() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const x = c.getContext('2d');
    const img = x.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v;
      img.data[i + 3] = Math.random() < 0.5 ? 10 : 0;
    }
    x.putImageData(img, 0, 0);
    this.noise = c;
    this.noisePattern = this.ctx.createPattern(c, 'repeat');
  }
  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.dpr = dpr;
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    this.vw = w; this.vh = h;
    this.minZoom = Math.max(h / (this.H * 1.02), 0.15);
    this.clampCam();
    this.dirty = true;
  }

  // ------------------------------------------------------------------ kamera
  clampCam() {
    const c = this.cam;
    c.z = Math.max(this.minZoom, Math.min(40, c.z));
    const halfH = this.vh / 2 / c.z;
    if (halfH * 2 >= this.H) c.y = this.H / 2;
    else c.y = Math.max(halfH, Math.min(this.H - halfH, c.y));
    if (c.x < 0) c.x += this.W;
    if (c.x >= this.W) c.x -= this.W;
  }
  screenToWorld(sx, sy) {
    const c = this.cam;
    return [c.x + (sx - this.vw / 2) / c.z, c.y + (sy - this.vh / 2) / c.z];
  }
  worldToScreen(wx, wy) {
    const c = this.cam;
    let dx = wx - c.x;
    if (dx > this.W / 2) dx -= this.W;
    if (dx < -this.W / 2) dx += this.W;
    return [this.vw / 2 + dx * c.z, this.vh / 2 + (wy - c.y) * c.z];
  }
  panBy(dx, dy) { this.cam.x -= dx / this.cam.z; this.cam.y -= dy / this.cam.z; this.clampCam(); this.dirty = true; }
  zoomAt(sx, sy, f) {
    const [wx, wy] = this.screenToWorld(sx, sy);
    this.cam.z *= f;
    this.clampCam();
    const [wx2, wy2] = this.screenToWorld(sx, sy);
    this.cam.x += wx - wx2; this.cam.y += wy - wy2;
    this.clampCam();
    this.dirty = true;
  }
  centerOn(pid, zoom) {
    const p = this.world.provinces[pid];
    if (!p) return;
    this.cam.x = p.label[0]; this.cam.y = p.label[1];
    if (zoom) this.cam.z = zoom;
    this.clampCam();
    this.dirty = true;
  }
  centerOnCountry(tag) {
    const g = this.game;
    const list = g.ownedProvs.get(tag) || [];
    if (!list.length) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const cap = g.C(tag).capital;
    const capP = this.world.provinces[cap];
    for (const pid of list) {
      const b = this.world.provinces[pid].bbox;
      // uzak denizaşırı toprakları yok say
      if (capP && Math.abs(this.world.provinces[pid].label[0] - capP.label[0]) > 600) continue;
      x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]);
    }
    if (!isFinite(x0)) return;
    this.cam.x = (x0 + x1) / 2; this.cam.y = (y0 + y1) / 2;
    this.cam.z = Math.min(this.vw * 0.55 / (x1 - x0 + 10), this.vh * 0.6 / (y1 - y0 + 10), 14);
    this.clampCam();
    this.dirty = true;
  }
  pickProvince(sx, sy) {
    let [wx, wy] = this.screenToWorld(sx, sy);
    wx = ((wx % this.W) + this.W) % this.W;
    return this.world.provinceAt(wx, wy);
  }
  pickCounter(sx, sy) {
    for (let i = this.counterHits.length - 1; i >= 0; i--) {
      const h = this.counterHits[i];
      if (sx >= h.x && sx <= h.x + h.w && sy >= h.y && sy <= h.y + h.h) return h;
    }
    return null;
  }

  // ------------------------------------------------------------------ siyasi katman
  colorOf(tag) {
    const c = this.game?.s.countries[tag];
    if (!c) return '#888888';
    if (c.puppetOf) {
      const m = this.game.s.countries[c.puppetOf];
      if (m) return mix(m.color, c.color, 0.35);
    }
    return c.color;
  }
  rebuildPolitical(full = false) {
    const g = this.game;
    if (!g) return;
    const P = g.s.prov;
    // Ülke dolgu yolları
    this.countryPaths = new Map();
    for (let i = 0; i < this.world.n; i++) {
      const o = P.owner[i];
      let path = this.countryPaths.get(o);
      if (!path) { path = new Path2D(); this.countryPaths.set(o, path); }
      path.addPath(this.provPaths[i]);
    }
    this.occupied = [];
    for (let i = 0; i < this.world.n; i++) if (P.ctrl[i] !== P.owner[i]) this.occupied.push(i);
    this.rebuildBorders();
    this.recolor();
    this.computeLabels();
    this.dirty = true;
    void full;
  }
  rebuildBorders() {
    const g = this.game, P = g.s.prov, W = this.world;
    this.countryBorder = new TiledPath();
    this.provBorder = new TiledPath();
    this.frontLine = new TiledPath();
    this.ctrlBorder = new TiledPath();
    W.arcs.forEach((arc, ai) => {
      const ps = W.arcProvs[ai];
      if (ps.length < 2) return;
      const [a, b] = ps;
      if (P.owner[a] !== P.owner[b]) this.countryBorder.add(arc);
      else this.provBorder.add(arc);
      if (P.ctrl[a] !== P.ctrl[b]) {
        if (g.atWar(P.ctrl[a], P.ctrl[b])) this.frontLine.add(arc);
        else if (P.owner[a] === P.owner[b]) this.ctrlBorder.add(arc);
      }
    });
  }
  recolor() {
    const g = this.game;
    if (!g) return;
    const P = g.s.prov, W = this.world, n = W.n;
    const col = new Array(n);
    const me = g.s.player || this.selectedCountry;
    switch (this.mode) {
      case 'terrain':
        for (let i = 0; i < n; i++) {
          const base = TERRAINS[W.provinces[i].terrain].color;
          col[i] = shade(base, ((i * 7919) % 13 - 6) / 120);
        }
        break;
      case 'faction': {
        for (let i = 0; i < n; i++) {
          const o = P.owner[i];
          const fid = g.factionOf.get(o);
          let c = fid ? g.s.factions[fid].color : FACTION_GREY;
          if (!fid && g.s.countries[o]?.bloc === 'R') c = '#a35b5b';
          else if (!fid && g.s.countries[o]?.bloc === 'C') c = '#c9a33a';
          else if (!fid && g.s.countries[o]?.bloc === 'W') c = '#7d9cc9';
          col[i] = g.isAtWar(o) ? shade(c, -0.15) : c;
        }
        break;
      }
      case 'diplomacy': {
        const ref = this.selectedCountry || me;
        for (let i = 0; i < n; i++) {
          const o = P.owner[i];
          if (!ref) { col[i] = FACTION_GREY; continue; }
          if (o === ref) col[i] = '#d4a74a';
          else if (g.atWar(o, ref)) col[i] = '#b0302a';
          else if (g.isAlly(o, ref)) col[i] = '#3f7fd0';
          else col[i] = relColor(g.rel(ref, o));
        }
        break;
      }
      case 'economy':
        for (let i = 0; i < n; i++) {
          const v = Math.log10(Math.max(0.01, P.gdp[i] * (1 - P.dev[i])));
          col[i] = heat((v + 1.5) / 4.6);
        }
        break;
      case 'population':
        for (let i = 0; i < n; i++) {
          const d = P.pop[i] / Math.max(1, W.provinces[i].area);
          col[i] = heat(Math.log10(Math.max(0.1, d)) / 3.3);
        }
        break;
      case 'industry':
        for (let i = 0; i < n; i++) col[i] = P.fac[i] > 0 ? heat(0.25 + Math.min(1, P.fac[i] / 12) * 0.75) : '#2a3442';
        break;
      case 'supply': {
        const tag = me;
        const net = tag && g.C(tag)?.alive ? supplyNetwork(g, tag) : null;
        for (let i = 0; i < n; i++) {
          const ct = P.ctrl[i];
          if (!tag) { col[i] = FACTION_GREY; continue; }
          if (g.atWar(ct, tag)) col[i] = mix('#7a2a2a', '#c0392b', Math.min(1, P.fort[i] / 5));
          else if (net && net[i]) col[i] = mix('#2f6b3d', '#6fbf6a', Math.min(1, P.fort[i] / 5));
          else if (ct === tag) col[i] = '#8a6a2a';
          else col[i] = '#4b525a';
        }
        break;
      }
      default:
        for (let i = 0; i < n; i++) col[i] = this.colorOf(P.owner[i]);
    }
    this.provColor = col;
    this.dirty = true;
  }
  setMode(mode) { this.mode = mode; this.recolor(); }

  // Ülke etiketleri (ana eksen boyunca)
  computeLabels() {
    const g = this.game, P = g.s.prov, W = this.world;
    const byTag = new Map();
    for (let i = 0; i < W.n; i++) { const o = P.owner[i]; if (!byTag.has(o)) byTag.set(o, []); byTag.get(o).push(i); }
    const labels = [];
    for (const [tag, list] of byTag) {
      const c = g.s.countries[tag];
      if (!c?.alive) continue;
      const set = new Set(list);
      const seen = new Set();
      let best = null, bestA = 0;
      for (const start of list) {
        if (seen.has(start)) continue;
        const comp = [];
        const st = [start]; seen.add(start);
        while (st.length) {
          const x = st.pop(); comp.push(x);
          for (const nb of W.provinces[x].neighbors) if (set.has(nb) && !seen.has(nb)) { seen.add(nb); st.push(nb); }
        }
        let a = comp.reduce((s2, x) => s2 + W.provinces[x].area, 0);
        if (comp.includes(c.capital)) a *= 40; // başkentin bulunduğu kara parçası öncelikli
        if (a > bestA) { bestA = a; best = comp; }
      }
      if (!best) continue;
      // ağırlıklı merkez ve kovaryans (sarma için referansa göre)
      const ref = W.provinces[best[0]].label[0];
      let sw = 0, mx = 0, my = 0;
      const pts = best.map((x) => {
        const p = W.provinces[x];
        let lx = p.label[0];
        if (lx - ref > this.W / 2) lx -= this.W; else if (ref - lx > this.W / 2) lx += this.W;
        const w = Math.sqrt(p.area);
        sw += w; mx += lx * w; my += p.label[1] * w;
        return { x: lx, y: p.label[1], w, r: Math.max(p.labelR, Math.sqrt((p.bbox[2] - p.bbox[0]) * (p.bbox[3] - p.bbox[1])) * 0.35) };
      });
      mx /= sw; my /= sw;
      let cxx = 0, cyy = 0, cxy = 0;
      for (const q of pts) { cxx += q.w * (q.x - mx) ** 2; cyy += q.w * (q.y - my) ** 2; cxy += q.w * (q.x - mx) * (q.y - my); }
      let angle = best.length > 1 ? 0.5 * Math.atan2(2 * cxy, cxx - cyy) : 0;
      if (angle > Math.PI / 2) angle -= Math.PI; if (angle < -Math.PI / 2) angle += Math.PI;
      const ca = Math.cos(angle), sa = Math.sin(angle);
      let lo = Infinity, hi = -Infinity, lo2 = Infinity, hi2 = -Infinity;
      for (const q of pts) {
        const u = (q.x - mx) * ca + (q.y - my) * sa;
        const v = -(q.x - mx) * sa + (q.y - my) * ca;
        lo = Math.min(lo, u - q.r); hi = Math.max(hi, u + q.r);
        lo2 = Math.min(lo2, v - q.r); hi2 = Math.max(hi2, v + q.r);
      }
      let len = (hi - lo) * 0.78;
      let thick = (hi2 - lo2);
      const text = trUpper(c.short);
      if (Math.abs(angle) > 1.25) { // çok dikey: yatay yaz
        angle = 0; const t2 = len; len = thick * 0.9; thick = t2;
      }
      const size = Math.max(1.2, Math.min(thick * 0.42, len / (text.length * 0.72 + 1)));
      let cx = mx; if (cx < 0) cx += this.W; if (cx >= this.W) cx -= this.W;
      labels.push({ tag, x: cx, y: my, angle, size, text, len });
    }
    labels.sort((a, b) => b.size - a.size);
    this.labels = labels;
  }

  // ------------------------------------------------------------------ çizim
  visibleOffsets() {
    const [x0] = this.screenToWorld(0, 0);
    const [x1] = this.screenToWorld(this.vw, 0);
    const out = [];
    for (let k = Math.floor(x0 / this.W); k <= Math.floor(x1 / this.W); k++) out.push(k * this.W);
    return out;
  }
  viewBounds(off) {
    const [x0, y0] = this.screenToWorld(0, 0);
    const [x1, y1] = this.screenToWorld(this.vw, this.vh);
    return [x0 - off, y0, x1 - off, y1];
  }
  millerY(lat) { return (this.yTop - 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * lat * DEG))) * this.RU; }

  render(now = performance.now()) {
    const ctx = this.ctx, g = this.game;
    const { z } = this.cam;
    const dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Okyanus
    const grd = ctx.createLinearGradient(0, 0, 0, this.vh);
    grd.addColorStop(0, '#0b1a2b'); grd.addColorStop(0.5, '#10283f'); grd.addColorStop(1, '#0b1a2b');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, this.vw, this.vh);
    ctx.fillStyle = this.noisePattern;
    ctx.fillRect(0, 0, this.vw, this.vh);
    if (!g) return;
    const offsets = this.visibleOffsets();
    const P = g.s.prov;
    for (const off of offsets) {
      ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (this.vw / 2 + (off - this.cam.x) * z), dpr * (this.vh / 2 - this.cam.y * z));
      const vb = this.viewBounds(off);
      const inView = (b) => !(b[2] < vb[0] || b[0] > vb[2] || b[3] < vb[1] || b[1] > vb[3]);
      // Enlem-boylam ağı
      ctx.lineWidth = 1 / z;
      ctx.strokeStyle = 'rgba(140,180,220,0.07)';
      ctx.beginPath();
      for (let lon = -180; lon <= 180; lon += 15) { const x = (lon + 180) / 360 * this.W; ctx.moveTo(x, 0); ctx.lineTo(x, this.H); }
      for (let lat = -60; lat <= 80; lat += 15) { const y = this.millerY(lat); ctx.moveTo(0, y); ctx.lineTo(this.W, y); }
      ctx.stroke();
      // Sığ su parıltısı
      ctx.strokeStyle = 'rgba(90,150,200,0.16)';
      ctx.lineWidth = 7 / z;
      ctx.lineJoin = 'round';
      this.coastPath.stroke(ctx, vb);
      ctx.strokeStyle = 'rgba(90,150,200,0.12)';
      ctx.lineWidth = 3 / z;
      this.coastPath.stroke(ctx, vb);
      // Kara
      if (this.mode === 'political' && z < 1.6) {
        for (const [tag, path] of this.countryPaths) {
          ctx.fillStyle = this.colorOf(tag);
          ctx.fill(path, 'evenodd');
        }
        // İşgal şeritleri
        for (const pid of this.occupied) {
          if (!inView(this.world.provinces[pid].bbox)) continue;
          ctx.fillStyle = this.stripePattern(this.colorOf(P.ctrl[pid]), z);
          ctx.fill(this.provPaths[pid], 'evenodd');
        }
      } else {
        for (let i = 0; i < this.world.n; i++) {
          if (!inView(this.world.provinces[i].bbox)) continue;
          ctx.fillStyle = this.provColor[i];
          ctx.fill(this.provPaths[i], 'evenodd');
        }
        if (this.mode !== 'terrain') {
          for (const pid of this.occupied) {
            if (!inView(this.world.provinces[pid].bbox)) continue;
            ctx.fillStyle = this.stripePattern(this.colorOf(P.ctrl[pid]), z, this.mode === 'political' ? 0.9 : 0.55);
            ctx.fill(this.provPaths[pid], 'evenodd');
          }
        }
      }
      // Kabartma hissi için hafif doku
      ctx.globalAlpha = 0.5;
      // İl sınırları
      if (z > 0.75) {
        ctx.strokeStyle = `rgba(20,25,30,${Math.min(0.45, (z - 0.75) * 0.35)})`;
        ctx.lineWidth = 0.7 / z;
        this.provBorder.stroke(ctx, vb);
      }
      ctx.globalAlpha = 1;
      // Kontrol sınırı (aynı ülke içinde işgal)
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 1 / z;
      this.ctrlBorder.stroke(ctx, vb);
      // Ülke sınırları
      ctx.strokeStyle = 'rgba(15,18,22,0.85)';
      ctx.lineWidth = Math.max(1.1, Math.min(2.2, 1 + z * 0.12)) / z;
      this.countryBorder.stroke(ctx, vb);
      // Kıyı çizgisi
      ctx.strokeStyle = 'rgba(10,20,30,0.75)';
      ctx.lineWidth = 0.9 / z;
      this.coastPath.stroke(ctx, vb);
      // Cephe hattı
      ctx.strokeStyle = 'rgba(255,70,50,0.95)';
      ctx.lineWidth = 2.2 / z;
      ctx.setLineDash([5 / z, 3 / z]);
      this.frontLine.stroke(ctx, vb);
      ctx.setLineDash([]);
      // Seçili ülke vurgusu
      if (this.selectedCountry && this.countryPaths.get(this.selectedCountry)) {
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        ctx.strokeStyle = 'rgba(255,230,160,0.9)';
        ctx.lineWidth = 1.6 / z;
        if (z < 1.6) {
          ctx.fill(this.countryPaths.get(this.selectedCountry), 'evenodd');
          ctx.stroke(this.countryPaths.get(this.selectedCountry));
        } else {
          for (const pid of this.game.ownedProvs.get(this.selectedCountry) || []) {
            if (!inView(this.world.provinces[pid].bbox)) continue;
            ctx.fill(this.provPaths[pid], 'evenodd');
          }
        }
      }
      // Fare üstü
      if (this.hover >= 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.16)';
        ctx.fill(this.provPaths[this.hover], 'evenodd');
      }
      if (this.selectedPid >= 0) {
        ctx.strokeStyle = '#ffe08a';
        ctx.lineWidth = 2.2 / z;
        ctx.stroke(this.provPaths[this.selectedPid]);
      }
      // Rota önizleme
      if (this.previewPath && this.previewPath.length) this.drawPreview(ctx, z);
    }
    // Ekran uzayında: etiketler, şehirler, birlikler, efektler
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.showLabels) {
      this.drawCities(ctx, z);
      this.drawCountryLabels(ctx, z);
      this.drawProvinceLabels(ctx, z);
    }
    this.drawMovement(ctx, z);
    this.drawUnits(ctx, z);
    this.drawBattles(ctx, z, now);
    this.drawEffects(ctx, now);
    this.dirty = this.effects.length > 0 || (g.s.battles.length > 0 && z > 1);
  }

  stripePattern(color, z, alpha = 0.9) {
    this._stripes ||= new Map();
    const key = `${color}|${alpha}`;
    let pat = this._stripes.get(key);
    if (!pat) {
      const c = document.createElement('canvas');
      c.width = c.height = 12;
      const x = c.getContext('2d');
      x.strokeStyle = rgba(color, alpha);
      x.lineWidth = 4;
      x.beginPath();
      x.moveTo(-3, 15); x.lineTo(15, -3);
      x.moveTo(-3, 3); x.lineTo(3, -3);
      x.moveTo(9, 15); x.lineTo(15, 9);
      x.stroke();
      pat = this.ctx.createPattern(c, 'repeat');
      this._stripes.set(key, pat);
    }
    pat.setTransform(new DOMMatrix().scale(1 / z, 1 / z));
    return pat;
  }

  drawPreview(ctx, z) {
    const pts = this.previewPath;
    const W = this.world;
    ctx.strokeStyle = 'rgba(255,224,138,0.95)';
    ctx.lineWidth = 2.5 / z;
    ctx.setLineDash([6 / z, 4 / z]);
    ctx.beginPath();
    let [px, py] = W.provinces[pts[0]].label;
    ctx.moveTo(px, py);
    for (let i = 1; i < pts.length; i++) {
      let [x, y] = W.provinces[pts[i]].label;
      if (x - px > this.W / 2) x -= this.W; else if (px - x > this.W / 2) x += this.W;
      ctx.lineTo(x, y);
      px = x; py = y;
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Şehirler
  drawCities(ctx, z) {
    if (z < 2.2) return;
    const g = this.game;
    ctx.font = '600 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (const [name, x, y, popK, cap] of this.world.cities) {
      if (!cap && popK < (z > 5 ? 1000 : 3000)) continue;
      const [sx, sy] = this.worldToScreen(x, y);
      if (sx < -20 || sy < -20 || sx > this.vw + 20 || sy > this.vh + 20) continue;
      if (cap) {
        drawStar(ctx, sx, sy, 4.5, '#ffe08a', '#1a1a1a');
      } else {
        ctx.fillStyle = '#f2f2f2'; ctx.strokeStyle = '#111'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(sx, sy, 2.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      if (z > 3.2) {
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.65)';
        ctx.strokeText(name, sx + 6, sy);
        ctx.fillStyle = '#f5f5f5';
        ctx.fillText(name, sx + 6, sy);
      }
    }
    void g;
  }

  drawCountryLabels(ctx, z) {
    if (!this.labels) return;
    const fade = z < 3.2 ? 1 : Math.max(0, 1 - (z - 3.2) / 2.5);
    if (fade <= 0.02) return;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const L of this.labels) {
      const px = L.size * z;
      if (px < 8.5) continue;
      const fs = Math.min(px, 64);
      const [sx, sy] = this.worldToScreen(L.x, L.y);
      if (sx < -400 || sy < -200 || sx > this.vw + 400 || sy > this.vh + 200) continue;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(L.angle);
      ctx.font = `700 ${fs}px Rajdhani, 'Arial Narrow', sans-serif`;
      const spacing = Math.max(0, Math.min(fs * 0.35, (L.len * z - ctx.measureText(L.text).width) / Math.max(1, L.text.length)));
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing.toFixed(1)}px`;
      const col = this.colorOf(L.tag);
      const dark = luminance(col) > 0.45;
      ctx.globalAlpha = 0.82 * fade;
      ctx.lineWidth = Math.max(2, fs * 0.12);
      ctx.strokeStyle = dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.45)';
      ctx.strokeText(L.text, 0, 0);
      ctx.fillStyle = dark ? 'rgba(25,25,25,0.85)' : 'rgba(255,255,255,0.9)';
      ctx.fillText(L.text, 0, 0);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  drawProvinceLabels(ctx, z) {
    if (z < 3.6) return;
    const alpha = Math.min(1, (z - 3.6) / 1.5);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 11px Inter, system-ui, sans-serif';
    ctx.globalAlpha = alpha;
    for (const p of this.world.provinces) {
      if (p.labelR * z < 16) continue;
      const [sx, sy] = this.worldToScreen(p.label[0], p.label[1] - p.labelR * 0.55);
      if (sx < -60 || sy < -20 || sx > this.vw + 60 || sy > this.vh + 20) continue;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.strokeText(p.name, sx, sy);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillText(p.name, sx, sy);
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------------ birlikler
  flagImage(tag) {
    let img = this.flagImages.get(tag);
    if (img) return img.ok ? img : null;
    if ((this._flagBudget ?? 0) <= 0) return null;
    this._flagBudget--;
    const c = this.game?.s.countries[tag];
    if (!c?.iso2 || c.iso2.length !== 2) { this.flagImages.set(tag, { ok: false }); return null; }
    img = new Image();
    img.onload = () => { img.ok = true; this.dirty = true; };
    img.onerror = () => { img.ok = false; };
    img.referrerPolicy = 'no-referrer';
    img.src = `https://flagcdn.com/w40/${c.iso2}.png`;
    this.flagImages.set(tag, img);
    return null;
  }
  unitGroups() {
    const g = this.game;
    const groups = [];
    for (const [pid, units] of g.unitsByProv) {
      if (!units.length) continue;
      const byOwner = new Map();
      for (const u of units) { if (!byOwner.has(u.o)) byOwner.set(u.o, []); byOwner.get(u.o).push(u); }
      let k = 0;
      const n = byOwner.size;
      for (const [o, list] of byOwner) {
        groups.push({ pid, owner: o, units: list, idx: k++, of: n });
      }
    }
    return groups;
  }
  drawUnits(ctx, z) {
    const g = this.game, W = this.world;
    this.counterHits = [];
    this._flagBudget = 3;
    const me = g.s.player;
    const groups = this.unitGroups();
    const big = z >= 1.35;
    for (const gr of groups) {
      const p = W.provinces[gr.pid];
      let [sx, sy] = this.worldToScreen(p.label[0], p.label[1]);
      if (sx < -40 || sy < -40 || sx > this.vw + 40 || sy > this.vh + 40) continue;
      const own = gr.owner === me;
      const enemy = me && g.atWar(gr.owner, me);
      const ally = me && !own && (g.isAlly(gr.owner, me) || g.coBelligerents(me).has(gr.owner));
      // Kalabalığı azalt: tarafsız birlikler yalnızca yakın zoomda
      if (!own && !enemy && !ally && z < 2.6) continue;
      if (!big) {
        const r = Math.min(7, 2.2 + Math.sqrt(gr.units.length) * 1.4);
        sx += (gr.idx - (gr.of - 1) / 2) * (r * 2 + 2);
        ctx.fillStyle = shade(this.colorOf(gr.owner), -0.35);
        ctx.strokeStyle = own ? '#ffe08a' : enemy ? '#ff5a4a' : 'rgba(255,255,255,0.6)';
        ctx.lineWidth = own ? 1.6 : 1;
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        this.counterHits.push({ x: sx - r, y: sy - r, w: r * 2, h: r * 2, pid: gr.pid, owner: gr.owner });
        continue;
      }
      const w = 40, h = 20;
      sx += (gr.idx - (gr.of - 1) / 2) * (w + 4) - w / 2;
      sy -= h / 2;
      const selected = own && gr.units.some((u) => this.selectedUnits.has(u.id));
      // gövde
      ctx.fillStyle = 'rgba(12,16,22,0.88)';
      roundRect(ctx, sx, sy, w, h + 5, 3);
      ctx.fill();
      ctx.lineWidth = selected ? 2 : 1;
      ctx.strokeStyle = selected ? '#ffd24a' : own ? 'rgba(255,224,138,0.75)' : enemy ? '#ff4a3a' : ally ? '#5aa0ff' : 'rgba(200,200,200,0.5)';
      ctx.stroke();
      // bayrak / renk
      const flag = this.flagImage(gr.owner);
      if (flag) ctx.drawImage(flag, sx + 2, sy + 3, 14, 10);
      else { ctx.fillStyle = this.colorOf(gr.owner); ctx.fillRect(sx + 2, sy + 3, 14, 10); }
      // simge
      const main = mainType(gr.units);
      drawUnitIcon(ctx, main, sx + 18, sy + 3, 10, 10);
      // sayı
      ctx.fillStyle = '#fff';
      ctx.font = '700 11px Rajdhani, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(gr.units.length), sx + w - 2, sy + 8.5);
      // çubuklar
      let str = 0, org = 0;
      for (const u of gr.units) { str += u.s; org += u.g / (UNIT_TYPES[u.t].org / 100); }
      str /= gr.units.length; org /= gr.units.length;
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(sx + 2, sy + h - 4, w - 4, 2.5);
      ctx.fillRect(sx + 2, sy + h, w - 4, 2.5);
      ctx.fillStyle = str > 0.6 ? '#4cc97a' : str > 0.3 ? '#e2c044' : '#e0524a';
      ctx.fillRect(sx + 2, sy + h - 4, (w - 4) * Math.min(1, str), 2.5);
      ctx.fillStyle = '#e8b84a';
      ctx.fillRect(sx + 2, sy + h, (w - 4) * Math.min(1, org), 2.5);
      // ikmalsiz uyarısı
      if (own && gr.units.some((u) => !u.sup)) {
        ctx.fillStyle = '#ff5a4a';
        ctx.beginPath(); ctx.arc(sx + w, sy, 4, 0, Math.PI * 2); ctx.fill();
      }
      this.counterHits.push({ x: sx, y: sy, w, h: h + 5, pid: gr.pid, owner: gr.owner });
    }
  }
  drawMovement(ctx, z) {
    const g = this.game, W = this.world;
    const me = g.s.player;
    if (!me) return;
    ctx.lineCap = 'round';
    for (const u of g.unitsOf(me)) {
      if (!u.path.length) continue;
      const sel = this.selectedUnits.has(u.id);
      if (!sel && z < 1.6) continue;
      ctx.strokeStyle = sel ? 'rgba(255,214,90,0.95)' : 'rgba(255,255,255,0.35)';
      ctx.lineWidth = sel ? 2.4 : 1.4;
      ctx.beginPath();
      let [x, y] = this.worldToScreen(...W.provinces[u.p].label);
      ctx.moveTo(x, y);
      let last = [x, y], prev = [x, y];
      for (const pid of u.path) {
        const [nx, ny] = this.worldToScreen(...W.provinces[pid].label);
        if (Math.abs(nx - last[0]) > this.vw) break;
        ctx.lineTo(nx, ny);
        prev = last; last = [nx, ny];
      }
      ctx.stroke();
      // ok başı
      const ang = Math.atan2(last[1] - prev[1], last[0] - prev[0]);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.moveTo(last[0], last[1]);
      ctx.lineTo(last[0] - 9 * Math.cos(ang - 0.4), last[1] - 9 * Math.sin(ang - 0.4));
      ctx.lineTo(last[0] - 9 * Math.cos(ang + 0.4), last[1] - 9 * Math.sin(ang + 0.4));
      ctx.closePath(); ctx.fill();
    }
  }
  drawBattles(ctx, z, now) {
    const g = this.game, W = this.world;
    if (z < 0.6) return;
    const me = g.s.player;
    for (const b of g.s.battles) {
      const involved = me && (g.atWar(b.attTag, me) || b.attTag === me || g.coBelligerents(me).has(b.attTag) || b.defTag === me);
      if (z < 1.2 && !involved) continue;
      const p = W.provinces[b.p];
      const [sx, sy0] = this.worldToScreen(p.label[0], p.label[1]);
      const sy = sy0 - 24;
      if (sx < -30 || sy < -30 || sx > this.vw + 30 || sy > this.vh + 30) continue;
      const pulse = 0.75 + 0.25 * Math.sin(now / 180);
      ctx.fillStyle = `rgba(160,20,20,${0.85 * pulse})`;
      ctx.beginPath(); ctx.arc(sx, sy, 9, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffd9a0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx - 5, sy - 5); ctx.lineTo(sx + 5, sy + 5); ctx.moveTo(sx + 5, sy - 5); ctx.lineTo(sx - 5, sy + 5); ctx.stroke();
      // üstünlük çubuğu
      const tot = b.ap + b.dp;
      if (tot > 0 && z >= 1.2) {
        const t = b.ap / tot;
        ctx.fillStyle = '#c0392b'; ctx.fillRect(sx - 14, sy + 11, 28, 3);
        ctx.fillStyle = '#4c9be0'; ctx.fillRect(sx - 14, sy + 11, 28 * t, 3);
      }
    }
  }

  // ------------------------------------------------------------------ efektler
  addEffect(kind, pid) {
    this.effects.push({ kind, pid, t0: performance.now() });
    this.dirty = true;
  }
  drawEffects(ctx, now) {
    const W = this.world;
    this.effects = this.effects.filter((e) => now - e.t0 < (e.kind === 'nuke' ? 4000 : 1600));
    for (const e of this.effects) {
      const p = W.provinces[e.pid];
      const [sx, sy] = this.worldToScreen(p.label[0], p.label[1]);
      const t = (now - e.t0) / (e.kind === 'nuke' ? 4000 : 1600);
      if (e.kind === 'nuke') {
        const r = 10 + t * 120;
        const g2 = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
        g2.addColorStop(0, `rgba(255,255,230,${1 - t})`);
        g2.addColorStop(0.4, `rgba(255,170,60,${0.8 * (1 - t)})`);
        g2.addColorStop(1, 'rgba(255,80,20,0)');
        ctx.fillStyle = g2;
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - t)})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(sx, sy, r * 1.2, 0, Math.PI * 2); ctx.stroke();
      } else {
        const r = 4 + t * (e.kind === 'missile' ? 36 : 22);
        ctx.strokeStyle = e.kind === 'missile' ? `rgba(255,140,40,${1 - t})` : `rgba(255,230,90,${1 - t})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = `rgba(255,200,120,${0.5 * (1 - t)})`;
        ctx.beginPath(); ctx.arc(sx, sy, r * 0.5, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
}

// ---------------------------------------------------------------------------
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function drawStar(ctx, x, y, r, fill, stroke) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a));
  }
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke();
}
function mainType(units) {
  const cnt = {};
  for (const u of units) cnt[u.t] = (cnt[u.t] || 0) + 1;
  return Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0];
}
// NATO askeri sembolleri (basitleştirilmiş)
export function drawUnitIcon(ctx, type, x, y, w, h) {
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  const cx = x + w / 2 + 0.5, cy = y + h / 2 + 0.5;
  ctx.beginPath();
  switch (type) {
    case 'infantry':
    case 'militia':
      ctx.moveTo(x + 0.5, y + 0.5); ctx.lineTo(x + w + 0.5, y + h + 0.5);
      ctx.moveTo(x + w + 0.5, y + 0.5); ctx.lineTo(x + 0.5, y + h + 0.5);
      ctx.stroke();
      if (type === 'militia') { ctx.fillRect(x + 1, y + h - 2, w - 1, 2); }
      break;
    case 'armor':
      ctx.ellipse(cx, cy, w * 0.36, h * 0.26, 0, 0, Math.PI * 2); ctx.stroke();
      break;
    case 'mechanized':
      ctx.moveTo(x + 0.5, y + 0.5); ctx.lineTo(x + w + 0.5, y + h + 0.5);
      ctx.moveTo(x + w + 0.5, y + 0.5); ctx.lineTo(x + 0.5, y + h + 0.5);
      ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx, cy, w * 0.36, h * 0.26, 0, 0, Math.PI * 2); ctx.stroke();
      break;
    case 'artillery':
      ctx.arc(cx, cy, 1.8, 0, Math.PI * 2); ctx.fill();
      break;
    case 'marines':
      ctx.moveTo(x + 0.5, y + 0.5); ctx.lineTo(x + w + 0.5, y + h + 0.5);
      ctx.moveTo(x + w + 0.5, y + 0.5); ctx.lineTo(x + 0.5, y + h + 0.5);
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 1, y + h - 1.5); ctx.quadraticCurveTo(cx, y + h - 4, x + w, y + h - 1.5); ctx.stroke();
      break;
    case 'special':
      ctx.moveTo(x + 2, y + h - 1); ctx.lineTo(cx, y + 1.5); ctx.lineTo(x + w - 1, y + h - 1); ctx.stroke();
      break;
    default:
      ctx.stroke();
  }
  ctx.restore();
}
export { hexToRgb };
