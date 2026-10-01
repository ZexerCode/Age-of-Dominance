// Renk yardımcıları
export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}
export function rgbToHex([r, g, b]) {
  const c = (x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}
export function shade(hex, amt) { return amt >= 0 ? mix(hex, '#ffffff', amt) : mix(hex, '#000000', -amt); }
export function rgba(hex, a) { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }
export function luminance(hex) { const [r, g, b] = hexToRgb(hex); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }

// Isı haritası rengi (0..1)
const HEAT = ['#1d2b4a', '#25507a', '#2e7f8f', '#4aa37a', '#a7c24f', '#f2c14e', '#f08a3c', '#d9483b'];
export function heat(t) {
  t = Math.max(0, Math.min(1, t));
  const x = t * (HEAT.length - 1);
  const i = Math.min(HEAT.length - 2, Math.floor(x));
  return mix(HEAT[i], HEAT[i + 1], x - i);
}
// İlişki rengi (-100..100)
export function relColor(v) {
  if (v >= 0) return mix('#9c9c8f', '#3f9b55', Math.min(1, v / 100));
  return mix('#9c9c8f', '#c0392b', Math.min(1, -v / 100));
}
