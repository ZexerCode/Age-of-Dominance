// Ortak yardımcılar

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;

// Tohumlu rastgele sayı üreteci (kayıt dosyasında saklanabilir)
export class Rng {
  constructor(seed = 1) { this.s = (seed >>> 0) || 0x9e3779b9; }
  next() {
    let t = (this.s += 0x6d2b79f5) >>> 0;
    this.s = t;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(n) { return Math.floor(this.next() * n); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  weighted(items, weightFn) {
    let total = 0;
    for (const it of items) total += Math.max(0, weightFn(it));
    if (total <= 0) return null;
    let r = this.next() * total;
    for (const it of items) { r -= Math.max(0, weightFn(it)); if (r <= 0) return it; }
    return items[items.length - 1];
  }
}

const R_EARTH = 6371;
export function haversine(lon1, lat1, lon2, lat2) {
  const d = Math.PI / 180;
  const dLat = (lat2 - lat1) * d, dLon = (lon2 - lon1) * d;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * d) * Math.cos(lat2 * d) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(a)));
}

export const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const START_MS = Date.UTC(2026, 0, 1);
export function dayToDate(day) {
  const dt = new Date(START_MS + day * 86400000);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}
export function formatDate(day, withDay = true) {
  const { y, m, d } = dayToDate(day);
  return withDay ? `${d} ${MONTHS_TR[m - 1]} ${y}` : `${MONTHS_TR[m - 1]} ${y}`;
}

const nf1 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
export function fmtInt(v) { return nf0.format(Math.round(v)); }
export function fmt1(v) { return nf1.format(v); }
export function fmt2(v) { return nf2.format(v); }
// milyar $ cinsinden para
export function fmtMoney(b) {
  const a = Math.abs(b), sign = b < 0 ? '-' : '';
  if (a >= 1000) return `${sign}$${nf2.format(a / 1000)} T`;
  if (a >= 10) return `${sign}$${nf0.format(a)} Mr`;
  if (a >= 1) return `${sign}$${nf1.format(a)} Mr`;
  return `${sign}$${nf0.format(a * 1000)} Mn`;
}
// kişi sayısı
export function fmtPeople(n) {
  const a = Math.abs(n);
  if (a >= 1e9) return `${nf2.format(n / 1e9)} Mr`;
  if (a >= 1e6) return `${nf1.format(n / 1e6)} Mn`;
  if (a >= 1e3) return `${nf0.format(n / 1e3)} B`;
  return nf0.format(n);
}
// bin kişi cinsinden insan gücü
export function fmtManpower(k) {
  if (Math.abs(k) >= 1000) return `${nf2.format(k / 1000)} Mn`;
  return `${nf0.format(k)} B`;
}
export function pct(v, digits = 0) { return `%${digits ? nf1.format(v * 100) : nf0.format(v * 100)}`; }

export function trUpper(s) { return s.toLocaleUpperCase('tr-TR'); }

// İkili ilişki anahtarı
export const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

// Basit ikili yığın (öncelik kuyruğu)
export class MinHeap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v;
    let i = k.length; k.push(key); v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= key) break;
      k[i] = k[p]; v[i] = v[p]; i = p;
    }
    k[i] = key; v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v;
    const topV = v[0];
    const lastK = k.pop(), lastV = v.pop();
    if (k.length) {
      let i = 0; const n = k.length;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && k[c + 1] < k[c]) c++;
        if (k[c] >= lastK) break;
        k[i] = k[c]; v[i] = v[c]; i = c;
      }
      k[i] = lastK; v[i] = lastV;
    }
    return topV;
  }
}
