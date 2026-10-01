// Bayraklar ve Wikipedia görselleri/özetleri
import { h } from './dom.js';

// Bayrak: önce flagcdn (Wikimedia Commons kaynaklı), sonra doğrudan Wikimedia Commons
export function flagSources(c, w = 80) {
  const out = [];
  if (c.iso2 && c.iso2.length === 2) out.push(`https://flagcdn.com/w${w}/${c.iso2}.png`);
  const file = c.flagFile || `Flag_of_${commonsName(c)}.svg`;
  out.push(`https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${w * 2}`);
  return out;
}
const THE = new Set(['United States', 'United Kingdom', 'Netherlands', 'Philippines', 'Czech Republic', 'Central African Republic', 'Dominican Republic', 'United Arab Emirates', 'The Bahamas', 'The Gambia', 'Comoros', 'Maldives', 'Marshall Islands', 'Solomon Islands', 'Democratic Republic of the Congo', 'Republic of the Congo', "People's Republic of China", 'Federated States of Micronesia', 'Vatican City']);
function commonsName(c) {
  let n = c.en || c.name;
  if (n.startsWith('The ')) n = n.slice(4);
  if (THE.has(c.en)) n = `the_${n}`;
  return n.replace(/ /g, '_');
}
export function flagImg(c, size = '', w = 80) {
  if (!c) return h('span', { class: `flag ${size}` });
  const srcs = flagSources(c, w);
  let i = 0;
  const img = h('img', { class: `flag ${size}`, alt: c.name, loading: 'lazy', referrerpolicy: 'no-referrer', src: srcs[0] });
  img.addEventListener('error', () => {
    i++;
    if (i < srcs.length) img.src = srcs[i];
    else {
      const fb = h('span', { class: `flag flag-fallback ${size}`, style: { background: c.color } }, c.tag);
      img.replaceWith(fb);
    }
  });
  return img;
}

// Wikipedia REST özeti (önbellekli)
const mem = new Map();
const LS_PREFIX = 'aod_wiki_v1_';
export async function wikiSummary(title, lang = 'tr') {
  if (!title) return null;
  const key = `${lang}:${title}`;
  if (mem.has(key)) return mem.get(key);
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (raw) {
      const v = JSON.parse(raw);
      if (v && Date.now() - v.t < 7 * 864e5) { mem.set(key, v.d); return v.d; }
    }
  } catch { /* depolama kullanılamıyor */ }
  const p = (async () => {
    try {
      const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`;
      const res = await fetch(url, { headers: { accept: 'application/json' } });
      if (!res.ok) return null;
      const j = await res.json();
      if (j.type === 'disambiguation') return null;
      const d = {
        title: j.title, extract: j.extract || '',
        thumb: j.thumbnail?.source || null,
        image: j.originalimage?.source || null,
        url: j.content_urls?.desktop?.page || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`,
        lang,
      };
      try { localStorage.setItem(LS_PREFIX + key, JSON.stringify({ t: Date.now(), d })); } catch { /* yoksay */ }
      return d;
    } catch { return null; }
  })();
  mem.set(key, p);
  const v = await p;
  mem.set(key, v);
  return v;
}
// Önce Türkçe, yoksa İngilizce
export async function wikiAny(titles) {
  for (const [title, lang] of titles) {
    if (!title) continue;
    const d = await wikiSummary(title, lang);
    if (d && (d.extract || d.thumb)) return d;
  }
  return null;
}

// Lider portresi
export function leaderPortrait(c, cls = '') {
  const initials = (c.leader.name || '?').split(' ').filter(Boolean).slice(0, 2).map((x) => x[0]).join('');
  const box = h('div', { class: `portrait portrait-fallback ${cls}` }, initials);
  if (c.leader.wiki) {
    wikiAny([[c.leader.wiki, 'en'], [c.leader.wiki, 'tr']]).then((d) => {
      if (!d?.thumb) return;
      const img = h('img', { class: `portrait ${cls}`, src: d.thumb, alt: c.leader.name, referrerpolicy: 'no-referrer' });
      img.addEventListener('load', () => { if (box.isConnected) box.replaceWith(img); });
    });
  }
  return box;
}
