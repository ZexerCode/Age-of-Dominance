// Küçük DOM yardımcıları
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  append(el, children);
  return el;
}
function append(el, children) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}
export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
export function mount(el, ...children) { clear(el); append(el, children); return el; }

export function progress(frac, cls = '') {
  return h('div', { class: `progress ${cls}` }, h('div', { style: { width: `${Math.max(0, Math.min(100, frac * 100)).toFixed(1)}%` } }));
}
export function meter(label, frac, text, cls = '') {
  return h('div', { class: 'meter' }, h('span', { class: 'muted', style: { minWidth: '92px' } }, label), progress(frac, cls), h('span', { class: 'num', style: { minWidth: '44px', textAlign: 'right' } }, text));
}
export function kv(pairs) {
  const out = h('div', { class: 'kv' });
  for (const [k, v, cls] of pairs) {
    if (k === null) continue;
    out.appendChild(h('div', { class: 'k' }, k));
    out.appendChild(h('div', { class: `v ${cls || ''}` }, v));
  }
  return out;
}
export function section(title, ...children) {
  return h('div', { class: 'section' }, h('h3', null, title), ...children);
}
export function stat(k, v, cls = '') {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: `v ${cls}` }, v));
}
// Devre dışı düğmeye açıklama ekler
export function btn(label, onClick, opts = {}) {
  const b = h('button', { class: `btn ${opts.cls || ''}`, title: opts.title || opts.why || null, onclick: (e) => { e.stopPropagation(); if (!b.disabled) onClick(e); } }, label);
  if (opts.disabled) b.disabled = true;
  return b;
}
