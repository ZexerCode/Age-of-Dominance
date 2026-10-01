// Ekranlar ve modal pencereler
import { h, mount, clear, section, kv, stat, btn } from './dom.js';
import { dat } from '../engine/tr.js';
import { flagImg, leaderPortrait, wikiAny } from './assets.js';
import { Game } from '../engine/game.js';
import { createGame } from '../engine/setup.js';
import * as eco from '../engine/economy.js';
import * as dip from '../engine/diplomacy.js';
import { resolvePending } from '../engine/events.js';
import { GOVERNMENTS, BLOC_NAMES, DIFFICULTIES } from '../data/rules.js';
import { fmtMoney, fmtInt, fmt1, formatDate } from '../engine/util.js';

const people = (n) => (n >= 1e9 ? `${fmt1(n / 1e9)} Mr` : n >= 1e6 ? `${fmt1(n / 1e6)} Mn` : `${fmtInt(n / 1e3)} B`);
const FEATURED = ['TUR', 'USA', 'RUS', 'CHN', 'DEU', 'GBR', 'FRA', 'IND', 'JPN', 'KOR', 'ISR', 'IRN', 'UKR', 'PAK', 'SAU', 'BRA', 'AZE', 'CYN', 'EGY', 'TWN'];

// ---------------------------------------------------------------------------
// Genel modal
// ---------------------------------------------------------------------------
export function openModal(app, { title, banner, bannerCls = '', body, foot, wide = false, closable = true, onClose }) {
  app.modalOpen = true;
  const close = () => {
    wrap.remove();
    app.modalOpen = !!document.querySelector('.modal-wrap');
    onClose?.();
    if (!app.modalOpen) app.checkPending?.();
  };
  const modal = h('div', { class: `modal ${wide ? 'wide' : ''}` },
    h('div', { class: 'modal-head' }, h('h2', null, title), closable ? h('button', { class: 'close', onclick: close }, '×') : null),
    h('div', { class: 'modal-body' }, banner ? h('div', { class: `event-banner ${bannerCls}` }, banner) : null, body),
    foot ? h('div', { class: 'modal-foot' }, foot) : null);
  const wrap = h('div', { class: 'modal-wrap', onclick: (e) => { if (e.target === wrap && closable) close(); } }, modal);
  document.body.appendChild(wrap);
  return close;
}
export function confirmModal(app, title, text, okLabel, onOk, danger = false) {
  let close;
  close = openModal(app, {
    title, body: h('div', null, text),
    foot: h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, btn('Vazgeç', () => close(), {}), btn(okLabel, () => { close(); onOk(); }, { cls: danger ? 'danger' : 'primary' })),
  });
}
export function promptModal(app, title, label, def, onOk) {
  const input = h('input', { type: 'text', value: def });
  let close;
  close = openModal(app, {
    title, body: h('div', { class: 'stack' }, h('label', null, label), input),
    foot: h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, btn('Vazgeç', () => close()), btn('Tamam', () => { close(); onOk(input.value.trim() || def); }, { cls: 'primary' })),
  });
  setTimeout(() => input.focus(), 50);
}

// ---------------------------------------------------------------------------
// Bekleyen olaylar
// ---------------------------------------------------------------------------
export function showPending(app, p) {
  const g = app.game;
  const done = (choice) => {
    resolvePending(g, p.id, choice);
    app.politicalDirty = true;
    app.refreshUi(true);
    app.updateTopbar();
  };
  let options = [];
  let banner = '📜', cls = '';
  if (p.kind === 'event') {
    options = p.options.map((o, i) => ({ label: o.label, desc: o.desc, i }));
    banner = { earthquake: '🌋', economic_crisis: '📉', protests: '✊', tech_breakthrough: '🔬', terror: '💥', coup: '🪖', investment: '🏗️', defense_export: '📦', refugees: '🚶', ruua_talks: '🕊️' }[p.eventId] || '⚠️';
    if (['taiwan', 'israel_iran', 'india_pakistan', 'essequibo', 'korea', 'horn', 'scs', 'baltic'].includes(p.eventId)) { banner = '🔥'; cls = 'war'; }
  } else if (p.kind === 'callToArms') {
    options = [{ label: 'Savaşa katıl', desc: 'Müttefikimizin yanında savaşacağız.', i: 0 }, { label: 'Reddet', desc: 'İlişkiler ciddi zarar görür (-40).', i: 1 }];
    banner = '⚔️'; cls = 'war';
  } else if (p.kind === 'peaceConference') {
    options = [
      { label: 'Tamamen ilhak et', desc: 'Ülkenin tüm toprakları sizin olur. Dünya ile ilişkiler kötüleşebilir.', i: 0 },
      { label: 'Kukla devlet kur', desc: 'Ülke sizin kontrolünüzde yaşamaya devam eder, gelirinin %25’ini size öder ve savaşlarınıza katılır.', i: 1 },
      { label: 'İşgal edilen toprakları al', desc: 'Yalnızca şu an işgal ettiğiniz illeri ilhak edersiniz.', i: 2 },
    ];
    banner = '🏳️'; cls = 'peace';
  } else if (p.kind === 'treaty') {
    options = [{ label: 'Kabul et', i: 0 }, { label: 'Reddet', desc: 'İlişkiler -5', i: 1 }];
    banner = '🤝'; cls = 'diplo';
  } else if (p.kind === 'peaceOffer') {
    options = [{ label: 'Barışı kabul et', i: 0 }, { label: 'Reddet ve savaşa devam et', i: 1 }];
    banner = '🕊️'; cls = 'peace';
  }
  const flagC = p.from ? g.C(p.from) : p.ally ? g.C(p.ally) : p.target ? g.C(p.target) : null;
  let close;
  const foot = h('div', { class: 'stack' }, options.map((o) => h('button', { class: 'btn option', onclick: () => { done(o.i); close(); } }, o.label, o.desc ? h('span', { class: 'od' }, o.desc) : null)));
  close = openModal(app, {
    title: p.title, banner, bannerCls: cls, closable: false,
    body: h('div', null, flagC ? h('div', { class: 'row', style: { marginBottom: '10px' } }, flagImg(flagC, 'md'), h('b', null, flagC.name)) : null, h('div', null, p.text), h('div', { class: 'tiny muted', style: { marginTop: '8px' } }, formatDate(p.day))),
    foot,
  });
}

// Barış teklifi
export function peaceModal(app, enemy) {
  const g = app.game, me = g.s.player;
  const war = g.warBetween(me, enemy);
  if (!war) { app.toast('Bu ülkeyle savaşta değilsiniz.', 'war'); return; }
  const target = g.C(enemy);
  const lead = (war.leadA === me || war.leadD === me) && (war.leadA === enemy || war.leadD === enemy);
  const sc = dip.warScore(g, war) * (war.att.includes(me) ? 1 : -1);
  const opt = (type, label, desc) => {
    const r = dip.peaceAcceptance(g, war, enemy, me, type);
    return h('button', { class: 'btn option', onclick: () => { close(); const res = dip.offerPeace(g, me, enemy, type); if (!res.ok) app.toast(res.why, 'war'); app.politicalDirty = true; app.refreshUi(true); } },
      label, h('span', { class: 'od' }, `${desc} — Tahmini yanıt: ${r.accept ? '✅ Kabul eder' : '❌ Reddeder'}`));
  };
  let close;
  close = openModal(app, {
    title: 'Barış Teklifi', banner: '🕊️', bannerCls: 'peace',
    body: h('div', null, h('div', { class: 'row', style: { marginBottom: '8px' } }, flagImg(target, 'md'), h('b', null, target.name)),
      h('div', null, `${war.name} · Savaş skoru (sizin açınızdan): ${sc > 0 ? '+' : ''}${fmtInt(sc)}`),
      !lead ? h('div', { class: 'tiny gold', style: { marginTop: '6px' } }, 'Savaş liderleri arasında olmadığından bu ayrı bir barış olacaktır; savaş diğer ülkeler arasında sürebilir.') : null),
    foot: h('div', { class: 'stack' },
      opt('white', 'Beyaz barış', 'Savaş öncesi sınırlara dönülür'),
      opt('demand', 'İşgal ettiğimiz toprakları talep et', 'Kontrolünüzdeki düşman illeri size geçer'),
      opt('concede', 'İşgal ettikleri topraklarımızı bırak', 'Düşmanın kontrolündeki illeriniz ona geçer')),
  });
}
// Yardım gönder
export function aidModal(app, tag) {
  const g = app.game, me = g.s.player;
  const c = g.C(me);
  const amounts = [0.05, 0.1, 0.25].map((f) => Math.max(0.01, Math.round(Math.max(0, c.treasury) * f * 100) / 100));
  let close;
  close = openModal(app, {
    title: 'Yardım Gönder',
    body: h('div', null, `${dat(g.C(tag).name)} mali ve askeri yardım gönderin. İlişkiler gönderilen miktarla orantılı olarak iyileşir. Hazineniz: ${fmtMoney(c.treasury)}.`),
    foot: h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, amounts.map((a) => btn(fmtMoney(a), () => { close(); const r = dip.sendAid(g, me, tag, a); if (!r.ok) app.toast(r.why, 'war'); app.refreshUi(true); app.updateTopbar(); }, { cls: 'primary', disabled: c.treasury < a }))),
  });
}

// ---------------------------------------------------------------------------
// Başlangıç menüsü
// ---------------------------------------------------------------------------
function ensurePreview(app) {
  if (!app.preview) app.preview = new Game(app.world, createGame(app.world, { player: null, seed: 2026 }));
  app.renderer.setGame(app.preview);
  app.renderer.setMode('political');
}
export function showStartMenu(app) {
  app.mode = 'menu';
  app.game = null;
  ensurePreview(app);
  const r = app.renderer;
  r.selectedCountry = null; r.selectedPid = -1;
  r.cam.z = r.minZoom * 1.12; r.cam.y = r.H * 0.45; r.clampCam(); r.dirty = true;
  const hasAuto = app.constructor.hasAutosave();
  const ui = app.ui;
  mount(ui, h('div', { class: 'screen' },
    h('div', { class: 'start-menu' },
      h('div', { class: 'start-box' },
        h('div', { class: 'logo' }, 'AGE OF ', h('span', null, 'DOMINANCE')),
        h('div', { class: 'tagline' }, 'Modern Dünya · 2026 · Büyük Strateji'),
        h('div', { class: 'start-buttons' },
          btn('Yeni Oyun', () => showCountrySelect(app), { cls: 'lg primary' }),
          hasAuto ? btn('Devam Et', () => { app.loadSlot('auto'); }, { cls: 'lg' }) : null,
          btn('Kayıtlı Oyun Yükle', () => loadModal(app), { cls: 'lg' }),
          btn('Nasıl Oynanır?', () => showHelp(app), { cls: 'lg' }),
          btn('Hakkında', () => aboutModal(app), { cls: 'lg ghost' })))),
    h('div', { class: 'start-foot' }, 'Harita: Natural Earth (kamu malı) · Görseller ve özetler: Wikipedia / Wikimedia Commons · Bayraklar: flagcdn.com')));
}

// ---------------------------------------------------------------------------
// Ülke seçimi
// ---------------------------------------------------------------------------
function difficultyOf(g, tag) {
  const all = Object.values(g.s.countries).filter((c) => c.alive).map((c) => ({ t: c.tag, v: g.militaryPower(c.tag) + eco.countryGdp(g, c.tag) * 0.05 })).sort((a, b) => b.v - a.v);
  const rank = all.findIndex((x) => x.t === tag);
  let d = rank < 10 ? 0 : rank < 35 ? 1 : rank < 90 ? 2 : 3;
  if (g.isAtWar(tag)) d = Math.min(3, d + 1);
  return [['Kolay', '#4cc97a'], ['Normal', '#e8b84a'], ['Zor', '#f08a3c'], ['Çok Zor', '#e0524a']][d];
}
export function showCountrySelect(app) {
  app.mode = 'select';
  ensurePreview(app);
  const g = app.preview;
  const r = app.renderer;
  r.cam.z = Math.max(r.minZoom, 1.1); r.clampCam(); r.dirty = true;
  let selected = 'TUR';
  let difficulty = 'normal';
  let aggression = 1;
  const left = h('div', { class: 'select-left' });
  const right = h('div', { class: 'select-right' });
  const listEl = h('div', { class: 'list' });
  const search = h('input', { type: 'search', placeholder: '🔎 Ülke ara…' });
  const sortedAll = Object.values(g.s.countries).filter((c) => c.alive).sort((a, b) => eco.countryGdp(g, b.tag) - eco.countryGdp(g, a.tag));
  const renderList = () => {
    const q = search.value.trim().toLocaleLowerCase('tr-TR');
    mount(listEl, sortedAll.filter((c) => !q || c.name.toLocaleLowerCase('tr-TR').includes(q) || c.en.toLowerCase().includes(q)).map((c) =>
      h('div', { class: `li ${c.tag === selected ? 'active' : ''}`, onclick: () => select(c.tag, true) }, flagImg(c, 'sm'), h('span', { class: 'grow ellipsis' }, c.name), h('span', { class: 'tiny muted num' }, fmtMoney(eco.countryGdp(g, c.tag))))));
  };
  search.addEventListener('input', renderList);
  const featured = h('div', { class: 'featured' }, FEATURED.filter((t) => g.C(t)).map((t) => h('div', { class: 'feat', dataset: { tag: t }, onclick: () => select(t, true) }, flagImg(g.C(t), 'md'), g.C(t).short)));
  mount(left,
    h('div', { class: 'panel-head' }, h('h2', null, 'Ülkeni Seç'), h('button', { class: 'close', title: 'Geri', onclick: () => showStartMenu(app) }, '×')),
    h('div', { class: 'panel-body' },
      h('div', { class: 'section' }, h('h3', null, 'Öne Çıkan Ülkeler'), featured),
      h('div', { class: 'section' }, h('h3', null, `Tüm Ülkeler (${sortedAll.length})`), search, h('div', { style: { height: '8px' } }), listEl)));
  const renderRight = () => {
    const c = g.C(selected);
    const b = eco.budgetInfo(g, selected);
    const [dl, dc] = difficultyOf(g, selected);
    const fid = g.factionOf.get(selected);
    const wars = g.warsOf(selected);
    const about = h('div', { class: 'wiki-text muted' }, 'Wikipedia özeti yükleniyor…');
    const diffSel = h('div', { class: 'row' }, Object.entries(DIFFICULTIES).map(([id, d]) => btn(d.name, () => { difficulty = id; renderRight(); }, { cls: `sm ${difficulty === id ? 'active' : ''}` })));
    const aggSel = h('div', { class: 'row' }, [[0.6, 'Barışçıl'], [1, 'Gerçekçi'], [1.6, 'Saldırgan']].map(([v, l]) => btn(l, () => { aggression = v; renderRight(); }, { cls: `sm ${aggression === v ? 'active' : ''}` })));
    mount(right,
      h('div', { class: 'panel-head' }, flagImg(c, 'lg'), h('div', { class: 'grow' }, h('h2', { class: 'ellipsis' }, c.name), h('div', { class: 'sub' }, `${GOVERNMENTS[c.gov].name} · ${BLOC_NAMES[c.bloc]}`))),
      h('div', { class: 'panel-body' },
        h('div', { class: 'row', style: { alignItems: 'flex-start', gap: '12px', marginBottom: '12px' } },
          leaderPortrait(c),
          h('div', { class: 'stack grow', style: { gap: '4px' } },
            h('div', { class: 'tiny muted' }, c.leader.title), h('div', { style: { fontWeight: 700, fontSize: '16px' } }, c.leader.name),
            h('div', { class: 'row wrap', style: { gap: '4px', marginTop: '4px' } },
              h('span', { class: 'diff-pill', style: { background: dc, color: '#111' } }, `Zorluk: ${dl}`),
              fid ? h('span', { class: 'tag blue' }, `🛡️ ${g.s.factions[fid].name}`) : null,
              wars.length ? h('span', { class: 'tag red' }, `⚔️ ${wars[0].name}`) : null,
              c.nukes ? h('span', { class: 'tag red' }, `☢️ ${fmtInt(c.nukes)} nükleer başlık`) : null))),
        h('div', { class: 'stat-grid', style: { marginBottom: '12px' } },
          stat('GSYH', fmtMoney(b.gdp)), stat('Nüfus', people(g.population(selected))), stat('Tümen', fmtInt(g.unitsOf(selected).length)),
          stat('Savaş uçağı', fmtInt(c.air * 12)), stat('Deniz gücü', fmtInt(c.navy)), stat('Fabrika', fmtInt(eco.countryFactories(g, selected))),
          stat('Savunma', `%${fmt1(c.defPct)}`), stat('İstikrar', `%${fmtInt(c.stability)}`), stat('İl sayısı', fmtInt((g.ownedProvs.get(selected) || []).length))),
        section('📖 Hakkında', about),
        section('⚙️ Oyun Ayarları', h('div', { class: 'stack' }, h('div', { class: 'tiny muted' }, 'Zorluk seviyesi'), diffSel, h('div', { class: 'tiny muted' }, 'Yapay zekâ davranışı'), aggSel))),
      h('div', { style: { padding: '12px 14px', borderTop: '1px solid var(--line)' } }, btn(`▶ ${c.short} ile Oyna`, () => app.startNewGame(selected, difficulty, aggression), { cls: 'lg primary block' })));
    wikiAny([[c.wiki, 'tr'], [c.name, 'tr'], [c.en, 'en']]).then((d) => {
      if (!about.isConnected) return;
      if (!d) { about.textContent = 'Özet bulunamadı.'; return; }
      mount(about, h('div', null, d.extract.length > 700 ? `${d.extract.slice(0, 700)}…` : d.extract), h('a', { class: 'src', href: d.url, target: '_blank', rel: 'noopener' }, `Kaynak: Wikipedia (${d.lang})`));
    });
  };
  const select = (tag, center) => {
    if (!g.C(tag)?.alive) return;
    selected = tag;
    r.selectedCountry = tag;
    r.dirty = true;
    if (center) r.centerOnCountry(tag);
    for (const f of featured.querySelectorAll('.feat')) f.classList.toggle('active', f.dataset.tag === tag);
    renderList();
    renderRight();
  };
  app.selectHandler = (pid) => { if (pid >= 0) select(g.s.prov.owner[pid], false); };
  mount(app.ui, h('div', { class: 'screen', style: { pointerEvents: 'none' } },
    h('div', { class: 'select-screen' }, left, h('div', { style: { pointerEvents: 'none', position: 'relative' } }, h('div', { class: 'select-top' }, '1 Ocak 2026 · Haritadan bir ülke seç')), right)));
  select(selected, true);
}

// ---------------------------------------------------------------------------
// Menü, kayıt, ayarlar
// ---------------------------------------------------------------------------
export function showMenuModal(app) {
  const was = app.speed;
  app.setSpeed(0);
  let close;
  const s = app.settings;
  const toggle = (key, label) => {
    const cb = h('input', { type: 'checkbox' });
    cb.checked = s[key] !== false;
    cb.addEventListener('change', () => { s[key] = cb.checked; import('./app.js').then((m) => m.saveSettings(s)); });
    return h('label', { class: 'row small', style: { cursor: 'pointer' } }, cb, label);
  };
  const labels = h('input', { type: 'checkbox' });
  labels.checked = app.renderer.showLabels;
  labels.addEventListener('change', () => { app.renderer.showLabels = labels.checked; app.renderer.dirty = true; });
  close = openModal(app, {
    title: 'Oyun Menüsü',
    body: h('div', { class: 'stack' },
      section('💾 Kaydet', h('div', { class: 'row wrap' }, [1, 2, 3].map((slot) => {
        const meta = app.constructor.slotMeta(slot);
        return btn(`Yuva ${slot}${meta ? ` (${meta.name}, ${formatDate(meta.day)})` : ''}`, () => { app.saveSlot(slot); close(); }, { cls: 'sm' });
      }))),
      section('📂 Yükle', h('div', { class: 'row wrap' }, btn('Kayıtlı oyunlar…', () => { close(); loadModal(app); }, { cls: 'sm' }), btn('Dosyaya aktar (.json)', () => app.exportSave(), { cls: 'sm' }))),
      section('⚙️ Ayarlar', h('div', { class: 'stack' }, toggle('pauseOnWar', 'Bana savaş ilan edildiğinde duraklat'), toggle('pauseOnNuke', 'Nükleer saldırıda duraklat'), h('label', { class: 'row small', style: { cursor: 'pointer' } }, labels, 'Harita etiketlerini göster')))),
    foot: h('div', { class: 'row', style: { justifyContent: 'space-between' } },
      btn('❓ Nasıl oynanır', () => { close(); showHelp(app); }),
      btn('🏠 Ana menü', () => { close(); confirmModal(app, 'Ana menüye dön', 'Kaydedilmemiş ilerleme kaybolacak (otomatik kayıt her 30 günde bir alınır).', 'Ana menüye dön', () => app.exitToMenu(), true); }, { cls: 'danger' }),
      btn('▶ Devam', () => { close(); app.setSpeed(was); }, { cls: 'primary' })),
  });
}
export function loadModal(app) {
  let close;
  const fileIn = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' } });
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files[0];
    if (!f) return;
    const txt = await f.text();
    close();
    if (app.loadGame(txt)) { /* yüklendi */ }
  });
  const rows = [];
  if (app.constructor.hasAutosave()) rows.push(btn('Otomatik kayıt', () => { close(); app.loadSlot('auto'); }, { cls: 'block' }));
  for (const slot of [1, 2, 3]) {
    const meta = app.constructor.slotMeta(slot);
    rows.push(btn(meta ? `Yuva ${slot}: ${meta.name} — ${formatDate(meta.day)}` : `Yuva ${slot}: boş`, () => { close(); app.loadSlot(slot); }, { cls: 'block', disabled: !meta }));
  }
  close = openModal(app, {
    title: 'Oyun Yükle',
    body: h('div', { class: 'stack' }, rows, h('hr', { class: 'sep' }), btn('📁 Dosyadan yükle…', () => fileIn.click(), { cls: 'block' }), fileIn),
  });
}
function aboutModal(app) {
  openModal(app, {
    title: 'Hakkında',
    body: h('div', { class: 'stack' },
      h('div', null, h('b', null, 'Age of Dominance'), ' — tarayıcıda çalışan, Hearts of Iron ve Age of History’den ilham alan modern dünya büyük strateji oyunu.'),
      kv([
        ['Harita verisi', 'Natural Earth 1:10m (kamu malı)'],
        ['İl sayısı', fmtInt(app.world.n)],
        ['Ülke sayısı', fmtInt(Object.keys(app.world.countryMeta).length)],
        ['Görseller', 'Wikipedia / Wikimedia Commons'],
        ['Bayraklar', 'flagcdn.com (Wikimedia kaynaklı)'],
        ['Senaryo başlangıcı', '1 Ocak 2026'],
      ]),
      h('div', { class: 'tiny muted' }, 'Ekonomik ve askeri değerler kamuya açık 2025 tahminlerine (IMF, SIPRI, IISS) dayanan yaklaşık değerlerdir. Oyun bir simülasyondur; gerçek kişi ve devletlere ilişkin olaylar kurgusaldır.')),
  });
}

// ---------------------------------------------------------------------------
// Rehber
// ---------------------------------------------------------------------------
export function showHelp(app) {
  const item = (k, v) => h('div', { class: 'row', style: { alignItems: 'flex-start' } }, h('span', { class: 'tag gold', style: { minWidth: '150px', justifyContent: 'center' } }, k), h('span', { class: 'small' }, v));
  openModal(app, {
    title: 'Nasıl Oynanır?', wide: true,
    body: h('div', { class: 'stack' },
      section('🎯 Amaç', h('div', { class: 'small' }, 'Ülkenizi 2026’dan itibaren yönetin: ekonominizi büyütün, ordunuzu modernleştirin, ittifaklar kurun ve gerektiğinde savaşın. Kesin bir zafer koşulu yoktur — dünyanın süper gücü olmak sizin elinizde.')),
      section('🖱️ Kontroller', h('div', { class: 'stack' },
        item('Sol tık', 'İl ya da birlik seç. Birlik sayacına tıklamak o ildeki birliklerinizi seçer.'),
        item('Sağ tık', 'Seçili birlikleri o ile gönder. Düşman iline göndermek saldırı başlatır.'),
        item('Sürükle / tekerlek', 'Haritayı kaydır / yakınlaştır (dokunmatik: iki parmak).'),
        item('Shift + sürükle', 'Kutu içindeki tüm birliklerinizi seç.'),
        item('Çift tık', 'İldeki tüm birliklerinizi seç.'),
        item('Boşluk · 1–5', 'Duraklat / oyun hızı.'),
        item('O A P K D S L N', 'Ordu, Araştırma, Politika, Kararlar, Diplomasi, Savaşlar, Dünya, Haberler menüleri.'),
        item('Q W E R T Y U I', 'Harita modları: Siyasi, Arazi, İttifaklar, Diplomasi, Ekonomi, Nüfus, Sanayi, Cephe/İkmal.'),
        item('H · Esc · F1', 'Ülkene dön · Kapat/menü · Yardım.'))),
      section('⚔️ Savaş', h('div', { class: 'small stack' },
        h('div', null, 'Muharebelerde saldırı/savunma gücü; arazi, tahkimat, mevzilenme, hava üstünlüğü, teknoloji, ikmal ve tecrübeye göre hesaplanır. Organizasyonu biten taraf geri çekilir. Her ilde aynı anda çarpışabilecek tümen sayısı (muharebe genişliği) sınırlıdır; farklı yönlerden saldırmak bonus verir.'),
        h('div', null, 'Düşman ilinde birlik yoksa bile yerel garnizon (polis, jandarma, bölgesel savunma) direnir. İkmal hattı kesilen (kuşatılan) birlikler güç kaybeder; geri çekilecek yeri olmayanlar teslim olur.'),
        h('div', null, 'Denizaşırı hedeflere birlikler deniz yoluyla taşınır; düşman donanması üstünse kayıp verirsiniz. Füze, SİHA ve (varsa) nükleer saldırıları düşman illerinin panelinden yapabilirsiniz.'))),
      section('💰 Ekonomi', h('div', { class: 'small' }, 'Geliriniz GSYH’nizin savunma bütçesine ayrılan payıdır. Birliklerin bakım maliyeti vardır. Fabrikalar üretim hızını, insan gücü askerlik yasasını belirler. Yüksek savunma harcaması barışta istikrarı ve büyümeyi düşürür. İstikrar düşükse protestolar ve darbeler başlayabilir.')),
      section('🤝 Diplomasi', h('div', { class: 'small' }, 'Bir ülkeye tıklayın: ilişkileri geliştirebilir, ittifak, saldırmazlık paktı, geçiş izni, garanti, yaptırım ve yardım gibi eylemler yapabilirsiniz. Gerekçesiz savaş ilanı istikrarınızı düşürür ve dünyayı size karşı çevirir. NATO gibi savunma ittifaklarının üyeleri saldırıya uğrayan üyeyi korur.')),
      section('🌍 Dünya', h('div', { class: 'small' }, 'Senaryo gerçek dünyayı yansıtır: Rusya–Ukrayna savaşı sürmektedir; Tayvan, Kore, Keşmir, Orta Doğu gibi kriz bölgelerinde yapay zekâ ülkeleri savaşa girebilir. Seçimler, depremler, ekonomik krizler, darbeler gibi olaylar sizi bekliyor.'))),
  });
}

// ---------------------------------------------------------------------------
// Oyun sonu
// ---------------------------------------------------------------------------
export function showGameOver(app) {
  const g = app.game;
  let close;
  const alive = Object.values(g.s.countries).filter((c) => c.alive).sort((a, b) => g.militaryPower(b.tag) - g.militaryPower(a.tag)).slice(0, 12);
  close = openModal(app, {
    title: 'Ülkeniz Yıkıldı', banner: '🏴', bannerCls: 'war', closable: false,
    body: h('div', { class: 'stack' }, h('div', null, `${g.C(g.s.player).name} ${formatDate(g.s.day)} tarihinde haritadan silindi.`), h('div', { class: 'tiny muted' }, 'Başka bir ülkenin liderliğini devralarak devam edebilirsiniz:'),
      h('div', { class: 'row wrap' }, alive.map((c) => btn(h('span', { class: 'row' }, flagImg(c, 'sm'), c.short), () => { g.s.player = c.tag; g.s.over = null; close(); app.attachGame(g); app.renderer.centerOnCountry(c.tag); }, { cls: 'sm' })))),
    foot: h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, btn('Ana menü', () => { close(); app.exitToMenu(); }, { cls: 'primary' })),
  });
}
void clear;
