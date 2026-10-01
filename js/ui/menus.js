// Sol menüler
import { h, mount, section, kv, stat, btn, meter, progress } from './dom.js';
import { flagImg } from './assets.js';
import { UNIT_TYPES, UNIT_ORDER, OTHER_PRODUCTION, TECHS, TECH_BRANCHES, TECH_BY_ID, CONSCRIPTION_LAWS, DECISIONS, GOVERNMENTS, BLOC_NAMES } from '../data/rules.js';
import { fmtMoney, fmtInt, fmt1, fmtManpower, formatDate } from '../engine/util.js';
import * as eco from '../engine/economy.js';
import * as dip from '../engine/diplomacy.js';
import { decisionStatus, takeDecision } from '../engine/events.js';
import { unitIconCanvas } from './panels.js';
import { peaceModal, promptModal } from './screens.js';

export const MENUS = [
  { id: 'production', name: 'Ordu ve Üretim', short: 'Ordu', icon: '🪖', key: 'O', render: renderProduction },
  { id: 'research', name: 'Araştırma', short: 'Ar-Ge', icon: '🔬', key: 'A', render: renderResearch },
  { id: 'politics', name: 'Politika ve Ekonomi', short: 'Politika', icon: '🏛️', key: 'P', render: renderPolitics },
  { id: 'decisions', name: 'Ulusal Kararlar', short: 'Kararlar', icon: '📜', key: 'K', render: renderDecisions },
  { id: 'diplomacy', name: 'Diplomasi', short: 'Diplomasi', icon: '🤝', key: 'D', render: renderDiplomacy },
  { id: 'wars', name: 'Savaşlar', short: 'Savaş', icon: '⚔️', key: 'S', render: renderWars },
  { id: 'world', name: 'Dünya Sıralaması', short: 'Dünya', icon: '🌍', key: 'L', render: renderWorld },
  { id: 'news', name: 'Haber Arşivi', short: 'Haber', icon: '📰', key: 'N', render: renderNewsMenu },
];

const people = (n) => (n >= 1e9 ? `${fmt1(n / 1e9)} Mr` : n >= 1e6 ? `${fmt1(n / 1e6)} Mn` : `${fmtInt(n / 1e3)} B`);

// ---------------------------------------------------------------------------
// Ordu ve üretim
// ---------------------------------------------------------------------------
function renderProduction(app, body) {
  const g = app.game, tag = g.s.player, c = g.C(tag);
  const pp = eco.productionPoints(g, tag);
  const mp = eco.manpowerInfo(g, tag);
  const fac = eco.countryFactories(g, tag);
  body.appendChild(h('div', { class: 'stat-grid', style: { marginBottom: '12px' } },
    stat('Fabrika', fmtInt(fac)), stat('Üretim/gün', fmt1(pp)), stat('İnsan gücü', fmtManpower(Math.max(0, mp.available))),
    stat('Hazine', fmtMoney(c.treasury), c.treasury < 0 ? 'red' : ''), stat('Maliyet endeksi', `×${fmt1(c.costFactor)}`), stat('Kuyruk', `${c.queue.length}`)));
  // Yapay zekâya devretme
  c.auto ||= {};
  const tog = (key, label, hint) => {
    const cb = h('input', { type: 'checkbox' });
    cb.checked = !!c.auto[key];
    cb.addEventListener('change', () => { c.auto[key] = cb.checked; app.toast(cb.checked ? `${label} yapay zekâya devredildi.` : `${label} yeniden sizin kontrolünüzde.`, 'diplo'); });
    return h('label', { class: 'row small', style: { cursor: 'pointer' }, title: hint }, cb, label);
  };
  body.appendChild(section('🤖 Komuta Devri', h('div', { class: 'stack', style: { gap: '4px' } },
    tog('army', 'Genelkurmay: cephe ve saldırıları yönetsin', 'Yapay zekâ birliklerinizi cephelere dağıtır ve uygun gördüğü saldırıları yapar.'),
    tog('prod', 'Savunma sanayii: üretimi yönetsin', 'Bütçe ve tehdit durumuna göre otomatik üretim yapılır.'),
    tog('research', 'Bilim kurulu: araştırmayı yönetsin', 'Boş araştırma yuvaları otomatik doldurulur.'))));
  const dep = eco.deployProvince(g, c);
  body.appendChild(h('div', { class: 'tiny muted', style: { marginBottom: '10px' } }, `📍 Yeni birlikler: ${dep >= 0 ? app.world.provinces[dep].name : '—'} (bir ile tıklayıp "burada konuşlandır" diyerek değiştirin)`));

  // Kuyruk
  if (c.queue.length) {
    const list = h('div', { class: 'stack' });
    let cum = 0;
    c.queue.forEach((q, i) => {
      const it = eco.PROD_ITEMS[q.item];
      const remain = it.pp - q.prog;
      cum += remain;
      const eta = pp > 0 ? Math.ceil(Math.max(remain / Math.max(it.pp / 14, 8), cum / pp)) : '∞';
      list.appendChild(h('div', { class: 'card' },
        h('div', { class: 'row' }, it.kind === 'unit' ? unitIconCanvas(q.item, 16) : h('span', null, prodIcon(it.kind)),
          h('div', { class: 'grow' }, h('div', { style: { fontWeight: 600 } }, it.name), h('div', { class: 'tiny muted' }, `~${eta} gün`)),
          btn('▲', () => { eco.moveQueue(g, tag, i, -1); app.renderLeft(); }, { cls: 'sm', disabled: i === 0 }),
          btn('▼', () => { eco.moveQueue(g, tag, i, 1); app.renderLeft(); }, { cls: 'sm', disabled: i === c.queue.length - 1 }),
          btn('✖', () => { eco.cancelQueue(g, tag, i); app.renderLeft(); app.updateTopbar(); }, { cls: 'sm', title: 'İptal (ödemenin bir kısmı iade edilir)' })),
        h('div', { style: { marginTop: '6px' } }, progress(q.prog / it.pp))));
    });
    body.appendChild(section(`🏭 Üretim Kuyruğu`, list));
  }

  // Kara birlikleri
  const land = h('div', { class: 'stack' });
  for (const id of UNIT_ORDER) {
    const ut = UNIT_TYPES[id];
    const chk = eco.canProduce(g, tag, id);
    const cost = ut.cost * c.costFactor;
    land.appendChild(h('div', { class: 'card hover' },
      h('div', { class: 'row' }, unitIconCanvas(id, 18),
        h('div', { class: 'grow' },
          h('div', { style: { fontWeight: 600 } }, ut.name),
          h('div', { class: 'tiny muted' }, `⚔️ ${ut.atk} 🛡️ ${ut.def} 🏃 ${ut.speed} km/g · ${fmtMoney(cost)} · ${ut.pp} ÜP · ${ut.mp} B kişi · bakım ${fmtMoney(ut.upkeep * c.costFactor)}/yıl`)),
        btn('Üret', () => { const r = eco.enqueue(g, tag, id); if (!r.ok) app.toast(r.why, 'war'); app.renderLeft(); app.updateTopbar(); }, { cls: 'sm primary', disabled: !chk.ok, why: chk.why }))));
  }
  body.appendChild(section('🪖 Kara Kuvvetleri', land));

  // Diğer
  const other = h('div', { class: 'stack' });
  for (const [id, it] of Object.entries(OTHER_PRODUCTION)) {
    const chk = eco.canProduce(g, tag, id);
    if (it.req && !c.techs.includes(it.req) && !(id === 'nuke' && c.nukes > 0)) {
      other.appendChild(h('div', { class: 'card', style: { opacity: 0.55 } }, h('div', { class: 'row' }, h('span', null, prodIcon(it.kind)), h('div', { class: 'grow' }, h('div', { style: { fontWeight: 600 } }, it.name), h('div', { class: 'tiny muted' }, `🔒 Gerekli: ${TECH_BY_ID[it.req].name}`)))));
      continue;
    }
    other.appendChild(h('div', { class: 'card hover' },
      h('div', { class: 'row' }, h('span', { style: { fontSize: '18px' } }, prodIcon(it.kind)),
        h('div', { class: 'grow' }, h('div', { style: { fontWeight: 600 } }, it.name),
          h('div', { class: 'tiny muted' }, `${fmtMoney(it.cost * c.costFactor)} · ${it.pp} ÜP${it.upkeep ? ` · bakım ${fmtMoney(it.upkeep * c.costFactor)}/yıl` : ''}`)),
        btn('Üret', () => { const r = eco.enqueue(g, tag, id); if (!r.ok) app.toast(r.why, 'war'); app.renderLeft(); app.updateTopbar(); }, { cls: 'sm primary', disabled: !chk.ok, why: chk.why }))));
  }
  body.appendChild(section('✈️ Hava, Deniz ve Stratejik', other));

  // Ordu özeti
  const units = g.unitsOf(tag);
  const counts = {};
  let str = 0;
  for (const u of units) { counts[u.t] = (counts[u.t] || 0) + 1; str += u.s; }
  body.appendChild(section('📊 Silahlı Kuvvetler',
    h('div', { class: 'row wrap', style: { gap: '4px', marginBottom: '8px' } }, Object.entries(counts).map(([t, n]) => h('span', { class: 'tag' }, unitIconCanvas(t, 13), `${n} ${UNIT_TYPES[t].short}`))),
    kv([
      ['Toplam tümen', `${units.length} (ort. güç %${fmtInt(units.length ? str / units.length * 100 : 0)})`],
      ['Savaş uçağı', `${fmtInt(c.air * 12)} (${fmt1(c.air)} filo)`],
      ['Deniz gücü', fmtInt(c.navy)],
      ['Balistik füze', fmtInt(c.missiles)],
      ['SİHA', fmtInt(c.drones)],
      ['Nükleer başlık', fmtInt(c.nukes), c.nukes ? 'red' : ''],
      ['Toplam kayıp', fmtManpower(c.totalLosses)],
    ]),
    h('div', { class: 'row', style: { marginTop: '8px' } },
      btn('Tüm birlikleri seç', () => app.selectUnits(units.map((u) => u.id)), { cls: 'sm' }),
      btn('Boştakileri seç', () => app.selectUnits(units.filter((u) => !u.path.length && !u.b).map((u) => u.id)), { cls: 'sm' }))));
}
function prodIcon(kind) { return { air: '✈️', navy: '⚓', nuke: '☢️', missile: '🚀', drone: '🛩️', unit: '🪖' }[kind] || '•'; }

// ---------------------------------------------------------------------------
// Araştırma
// ---------------------------------------------------------------------------
function renderResearch(app, body) {
  const g = app.game, tag = g.s.player, c = g.C(tag);
  const rp = eco.researchPoints(g, tag);
  const slots = eco.researchSlots(c);
  body.appendChild(h('div', { class: 'stat-grid', style: { marginBottom: '12px' } },
    stat('Araştırma/gün', fmt1(rp)), stat('Yuva', `${c.research.length}/${slots}`), stat('Teknoloji', `${c.techs.length}/${TECHS.length}`)));
  const active = h('div', { class: 'stack' });
  for (const r of c.research) {
    const t = TECH_BY_ID[r.id];
    const cost = eco.techCost(c, t);
    active.appendChild(h('div', { class: 'card' },
      h('div', { class: 'row' }, h('span', null, TECH_BRANCHES[t.branch].icon), h('div', { class: 'grow' }, h('div', { style: { fontWeight: 600 } }, t.name), h('div', { class: 'tiny muted' }, `${t.desc} · ~${Math.ceil((cost - r.prog) / Math.max(0.1, rp))} gün`)),
        btn('✖', () => { eco.cancelResearch(g, tag, r.id); app.renderLeft(); }, { cls: 'sm', title: 'İptal (ilerleme kaybolur)' })),
      h('div', { style: { marginTop: '6px' } }, progress(r.prog / cost))));
  }
  for (let i = c.research.length; i < slots; i++) active.appendChild(h('div', { class: 'card muted tiny' }, '— Boş araştırma yuvası: aşağıdan bir teknoloji seçin —'));
  body.appendChild(section('🔬 Devam Eden Araştırmalar', active));
  for (const [bid, br] of Object.entries(TECH_BRANCHES)) {
    const row = h('div', { class: 'tech-row' });
    for (const t of TECHS.filter((x) => x.branch === bid)) {
      const done = c.techs.includes(t.id);
      const inProg = c.research.find((r) => r.id === t.id);
      const avail = !done && !inProg && (t.level === 1 || c.techs.includes(`${bid.slice(0, 3)}${t.level - 1}`));
      const cls = done ? 'done' : inProg ? 'prog' : avail ? 'avail' : 'locked';
      row.appendChild(h('div', { class: `tech ${cls}`, title: `${t.name}\n${t.desc}\nMaliyet: ${eco.techCost(c, t)} AP`, onclick: () => {
        if (!avail) return;
        const r = eco.startResearch(g, tag, t.id);
        if (!r.ok) app.toast(r.why, 'war');
        app.renderLeft();
      } },
      h('div', { class: 'lv' }, `SV ${t.level}${done ? ' ✓' : ''}`),
      h('div', { class: 'nm' }, t.name),
      inProg ? progress(inProg.prog / eco.techCost(c, t)) : h('div', { class: 'tiny muted' }, done ? 'Tamamlandı' : `${eco.techCost(c, t)} AP`)));
    }
    body.appendChild(h('div', { class: 'tech-branch' }, h('h4', null, br.icon, br.name), row));
  }
}

// ---------------------------------------------------------------------------
// Politika ve ekonomi
// ---------------------------------------------------------------------------
function renderPolitics(app, body) {
  const g = app.game, tag = g.s.player, c = g.C(tag);
  const b = eco.budgetInfo(g, tag);
  const gr = eco.growthRate(g, tag);
  body.appendChild(section('🏛️ Hükümet', kv([
    ['Yönetim', GOVERNMENTS[c.gov].name],
    ['Lider', `${c.leader.name} (${c.leader.title})`],
    ['Blok', BLOC_NAMES[c.bloc] || '-'],
    ['İttifak', g.factionOf.get(tag) ? g.s.factions[g.factionOf.get(tag)].name : '—'],
  ]), h('div', { class: 'stack', style: { marginTop: '8px' } },
    meter('İstikrar', c.stability / 100, `%${fmtInt(c.stability)}`, c.stability < 35 ? 'red' : 'green'),
    meter('Savaş desteği', c.warSupport / 100, `%${fmtInt(c.warSupport)}`),
    meter('Savaş yorgunluğu', c.exhaustion / 100, `%${fmtInt(c.exhaustion)}`, 'red'),
    h('div', { class: 'tiny muted' }, `İstikrar hedefi: %${fmtInt(eco.stabilityTarget(g, tag))} (aylık en fazla 1,5 puan değişir)`))));

  // Bütçe
  const defVal = h('span', { class: 'num gold' }, `%${fmt1(c.defPct)}`);
  const def = h('input', { type: 'range', min: 0.5, max: 30, step: 0.1, value: c.defPct });
  def.addEventListener('input', () => { defVal.textContent = `%${fmt1(Number(def.value))}`; });
  def.addEventListener('change', () => { eco.setDefense(g, tag, Number(def.value)); app.renderLeft(); app.updateTopbar(); });
  const resVal = h('span', { class: 'num gold' }, `%${fmtInt(c.resShare * 100)}`);
  const res = h('input', { type: 'range', min: 0, max: 0.5, step: 0.01, value: c.resShare });
  res.addEventListener('input', () => { resVal.textContent = `%${fmtInt(Number(res.value) * 100)}`; });
  res.addEventListener('change', () => { eco.setResearchShare(g, tag, Number(res.value)); app.renderLeft(); app.updateTopbar(); });
  body.appendChild(section('💰 Bütçe',
    h('div', { class: 'stack' },
      h('div', { class: 'row between' }, h('span', null, 'Savunma bütçesi (GSYH payı)'), defVal), def,
      h('div', { class: 'tiny muted' }, 'Yüksek savunma bütçesi gelirinizi artırır ama barış zamanında istikrarı ve ekonomik büyümeyi düşürür (%3 üzeri).'),
      h('div', { class: 'row between' }, h('span', null, 'Ar-Ge payı (bütçeden)'), resVal), res,
      h('div', { class: 'tiny muted' }, 'Ar-Ge payı araştırma hızını belirler; artırmak ordu bütçesini azaltır.')),
    h('hr', { class: 'sep' }),
    kv([
      ['GSYH', fmtMoney(b.gdp)],
      ['Yıllık büyüme', `${gr >= 0 ? '+' : ''}${fmt1(gr)}%`, gr >= 0 ? 'green' : 'red'],
      ['Günlük gelir', `+${fmtMoney(b.income)}`, 'green'],
      ['Ar-Ge harcaması', `-${fmtMoney(b.research)}`],
      ['Kara kuvvetleri bakımı', `-${fmtMoney(b.armyCost)}`],
      ['Hava kuvvetleri bakımı', `-${fmtMoney(b.airCost)}`],
      ['Deniz kuvvetleri bakımı', `-${fmtMoney(b.navyCost)}`],
      ['Stratejik kuvvetler', `-${fmtMoney(b.stratCost)}`],
      b.interest ? ['Borç faizi', `-${fmtMoney(b.interest)}`, 'red'] : [null],
      ['Günlük net', `${b.net >= 0 ? '+' : ''}${fmtMoney(b.net)}`, b.net >= 0 ? 'green' : 'red'],
      ['Yıllık net (tahmini)', `${b.net >= 0 ? '+' : ''}${fmtMoney(b.net * 365)}`, b.net >= 0 ? 'green' : 'red'],
    ])));

  // Askerlik yasası
  const laws = h('div', { class: 'stack' });
  for (const l of CONSCRIPTION_LAWS) {
    const chk = eco.canSetLaw(g, tag, l.id);
    const cur = c.law === l.id;
    laws.appendChild(h('div', { class: `li ${cur ? 'active' : ''}`, title: chk.why || '', onclick: () => { if (cur) return; const r = eco.setLaw(g, tag, l.id); if (!r.ok) app.toast(r.why, 'war'); app.renderLeft(); app.updateTopbar(); }, style: { opacity: chk.ok || cur ? 1 : 0.5 } },
      h('div', { class: 'grow' }, h('div', { style: { fontWeight: 600 } }, `${cur ? '● ' : ''}${l.name}`), h('div', { class: 'tiny muted' }, `Nüfusun %${fmt1(l.mp * 100)}'i · ${l.desc}`))));
  }
  const mp = eco.manpowerInfo(g, tag);
  body.appendChild(section('🎖️ Askerlik Yasası', laws, h('div', { style: { marginTop: '8px' } }, kv([
    ['Azami insan gücü', fmtManpower(mp.max)],
    ['Sahadaki askerler', fmtManpower(mp.fielded)],
    ['Eğitimdeki', fmtManpower(mp.queued)],
    ['Telafi edilmemiş kayıplar', fmtManpower(mp.casualties)],
    ['Kullanılabilir', fmtManpower(mp.available), mp.available < 0 ? 'red' : 'green'],
  ]))));

  // Değiştiriciler
  const mods = c.mods.filter((m) => m.until === undefined || m.until > g.s.day);
  if (mods.length || c.sanctions.length) {
    body.appendChild(section('📋 Etkin Değiştiriciler', h('div', { class: 'stack' },
      mods.map((m) => h('div', { class: 'row between small' }, h('span', null, m.label || m.key), h('span', { class: `num ${m.v >= 0 ? 'green' : 'red'}` }, `${m.v > 0 ? '+' : ''}${fmt1(m.v)} ${m.key === 'growth' ? 'büyüme' : m.key}${m.until ? ` (${m.until - g.s.day} gün)` : ''}`))),
      c.sanctions.length ? h('div', { class: 'small red' }, `💼 ${c.sanctions.length} ülkenin ekonomik yaptırımı altındasınız (büyüme cezası).`) : null)));
  }
}

// ---------------------------------------------------------------------------
// Kararlar
// ---------------------------------------------------------------------------
function renderDecisions(app, body) {
  const g = app.game, tag = g.s.player;
  const list = h('div', { class: 'stack' });
  for (const d of DECISIONS) {
    const st = decisionStatus(g, tag, d.id);
    list.appendChild(h('div', { class: 'card' },
      h('div', { class: 'row' }, h('span', { style: { fontSize: '22px' } }, d.icon),
        h('div', { class: 'grow' }, h('div', { style: { fontWeight: 600 } }, d.name), h('div', { class: 'tiny muted' }, d.desc),
          h('div', { class: 'tiny', style: { marginTop: '3px' } }, `Maliyet: ${st.cost > 0 ? fmtMoney(st.cost) : 'yok'} · Bekleme: ${d.cooldown} gün`)),
        btn('Uygula', () => { const r = takeDecision(g, tag, d.id); if (!r.ok) app.toast(r.why, 'war'); else app.toast(`Karar uygulandı: ${d.name}`, 'peace'); app.renderLeft(); app.updateTopbar(); }, { cls: 'sm primary', disabled: !st.ok, why: st.why }))));
  }
  body.appendChild(list);
}

// ---------------------------------------------------------------------------
// Diplomasi özeti
// ---------------------------------------------------------------------------
function renderDiplomacy(app, body) {
  const g = app.game, me = g.s.player, c = g.C(me);
  const fid = g.factionOf.get(me);
  if (fid) {
    const f = g.s.factions[fid];
    body.appendChild(section(`🛡️ ${f.name}`, h('div', { class: 'tiny muted', style: { marginBottom: '6px' } }, `${f.full} · Lider: ${g.C(f.leader)?.name}`),
      h('div', { class: 'row wrap', style: { gap: '4px' } }, f.members.map((m) => h('span', { class: 'tag', style: { cursor: 'pointer' }, onclick: () => app.openCountry(m) }, flagImg(g.C(m), 'sm'), g.C(m).short))),
      h('div', { class: 'row', style: { marginTop: '8px' } }, btn('İttifaktan ayrıl', () => { dip.leaveFaction(g, me); app.renderLeft(); }, { cls: 'sm danger' }))));
  } else {
    body.appendChild(section('🛡️ Askeri İttifak', h('div', { class: 'tiny muted', style: { marginBottom: '6px' } }, 'Herhangi bir askeri ittifaka üye değilsiniz. Kendi ittifakınızı kurup dost ülkeleri davet edebilir ya da mevcut bir ittifakın liderine katılma başvurusu yapabilirsiniz.'),
      btn('Yeni ittifak kur…', () => promptModal(app, 'Yeni İttifak', 'İttifakın adı:', `${c.short} Paktı`, (name) => { const r = dip.createFaction(g, me, name); if (!r.ok) app.toast(r.why, 'war'); app.renderLeft(); }), { cls: 'sm' })));
  }
  // İlişkiler
  const others = Object.values(g.s.countries).filter((o) => o.alive && o.tag !== me);
  const sorted = others.map((o) => ({ o, r: g.rel(me, o.tag) })).sort((a, b) => b.r - a.r);
  const row = ({ o, r }) => h('div', { class: 'li', onclick: () => { app.openCountry(o.tag); app.renderer.centerOnCountry(o.tag); } }, flagImg(o, 'sm'), h('span', { class: 'grow ellipsis' }, o.name),
    g.atWar(me, o.tag) ? h('span', { class: 'tag red' }, 'Savaş') : g.isAlly(me, o.tag) ? h('span', { class: 'tag blue' }, 'Müttefik') : null,
    h('span', { class: `num ${r >= 30 ? 'green' : r <= -30 ? 'red' : ''}`, style: { minWidth: '36px', textAlign: 'right' } }, `${r > 0 ? '+' : ''}${fmtInt(r)}`));
  body.appendChild(section('💚 En İyi İlişkiler', h('div', { class: 'list' }, sorted.slice(0, 10).map(row))));
  body.appendChild(section('💢 En Kötü İlişkiler', h('div', { class: 'list' }, sorted.slice(-10).reverse().map(row))));
  // Antlaşmalar
  const tr = g.s.treaties.filter((t) => t.a === me || t.b === me);
  body.appendChild(section('📜 Antlaşmalarınız', tr.length ? h('div', { class: 'list' }, tr.map((t) => {
    const other = g.C(t.a === me ? t.b : t.a);
    const label = t.t === 'guarantee' ? (t.a === me ? 'Garanti veriyorsunuz' : 'Sizi garanti ediyor') : dip.TREATY_NAMES[t.t];
    return h('div', { class: 'li', onclick: () => app.openCountry(other.tag) }, flagImg(other, 'sm'), h('span', { class: 'grow' }, other.name), h('span', { class: 'tag' }, label));
  })) : h('div', { class: 'tiny muted' }, 'İkili antlaşmanız yok.')));
  if (c.sanctions.length) body.appendChild(section('💼 Size Yaptırım Uygulayanlar', h('div', { class: 'row wrap', style: { gap: '4px' } }, c.sanctions.map((t) => h('span', { class: 'tag', onclick: () => app.openCountry(t), style: { cursor: 'pointer' } }, flagImg(g.C(t), 'sm'), g.C(t).short)))));
}

// ---------------------------------------------------------------------------
// Savaşlar
// ---------------------------------------------------------------------------
function warCard(app, w, me) {
  const g = app.game;
  const sc = dip.warScore(g, w);
  const mySide = w.att.includes(me) ? 1 : w.def.includes(me) ? -1 : 0;
  const side = (list) => h('div', { class: 'row wrap', style: { gap: '3px' } }, list.map((t) => h('span', { title: g.C(t).name, style: { cursor: 'pointer' }, onclick: () => app.openCountry(t) }, flagImg(g.C(t), 'sm'))));
  const casA = w.att.reduce((a, t) => a + (w.cas[t] || 0), 0), casD = w.def.reduce((a, t) => a + (w.cas[t] || 0), 0);
  const card = h('div', { class: 'card' },
    h('div', { class: 'row between' }, h('b', null, w.name), h('span', { class: 'tiny muted' }, `${Math.max(0, g.s.day - w.start)} gün`)),
    h('div', { class: 'row between', style: { margin: '6px 0' } }, side(w.att), h('span', { class: 'muted tiny' }, 'vs'), side(w.def)),
    progress((sc + 100) / 200, 'blue'),
    h('div', { class: 'row between tiny muted', style: { marginTop: '4px' } }, h('span', null, `Kayıp: ${fmtManpower(casA)}`), h('span', null, `Skor ${sc > 0 ? '+' : ''}${fmtInt(sc)}`), h('span', null, `Kayıp: ${fmtManpower(casD)}`)));
  if (mySide) {
    const enemyLead = mySide === 1 ? w.leadD : w.leadA;
    card.appendChild(h('div', { class: 'row', style: { marginTop: '8px' } }, btn('🕊️ Barış teklif et', () => peaceModal(app, enemyLead), { cls: 'sm' }), btn('Düşman liderini göster', () => { app.openCountry(enemyLead); app.renderer.centerOnCountry(enemyLead); }, { cls: 'sm' })));
  }
  return card;
}
function renderWars(app, body) {
  const g = app.game, me = g.s.player;
  const mine = g.warsOf(me);
  body.appendChild(section('⚔️ Savaşlarınız', mine.length ? h('div', { class: 'stack' }, mine.map((w) => warCard(app, w, me))) : h('div', { class: 'tiny muted' }, 'Şu anda savaşta değilsiniz.')));
  const others = g.s.wars.filter((w) => !w.ended && !mine.includes(w));
  body.appendChild(section('🌍 Dünyadaki Savaşlar', others.length ? h('div', { class: 'stack' }, others.map((w) => warCard(app, w, me))) : h('div', { class: 'tiny muted' }, 'Dünyada başka bir savaş yok.')));
  const ended = g.s.wars.filter((w) => w.ended).slice(-8).reverse();
  if (ended.length) body.appendChild(section('📚 Sona Eren Savaşlar', h('div', { class: 'list' }, ended.map((w) => h('div', { class: 'li' }, h('span', { class: 'grow' }, w.name), h('span', { class: 'tiny muted' }, `${formatDate(Math.max(0, w.start))} – ${formatDate(w.endDay)}`))))));
  body.appendChild(section('📈 Dünya Gerginliği', meter('Gerginlik', g.s.worldTension / 100, `%${fmtInt(g.s.worldTension)}`, g.s.worldTension > 60 ? 'red' : ''), h('div', { class: 'tiny muted', style: { marginTop: '4px' } }, `Kullanılan nükleer silah: ${g.s.nukesUsed} · Toplam muharebe: ${g.s.stats.battles}`)));
}

// ---------------------------------------------------------------------------
// Dünya sıralaması
// ---------------------------------------------------------------------------
function renderWorld(app, body) {
  const g = app.game, me = g.s.player;
  const tab = app._worldTab || 'gdp';
  const tabs = h('div', { class: 'tabs' });
  const defs = [['gdp', 'GSYH'], ['mil', 'Askeri Güç'], ['pop', 'Nüfus'], ['tech', 'Teknoloji'], ['area', 'Toprak']];
  for (const [id, label] of defs) tabs.appendChild(h('button', { class: `tab ${tab === id ? 'active' : ''}`, onclick: () => { app._worldTab = id; app.renderLeft(); } }, label));
  body.appendChild(tabs);
  const alive = Object.values(g.s.countries).filter((c) => c.alive);
  const val = {
    gdp: (c) => eco.countryGdp(g, c.tag), mil: (c) => g.militaryPower(c.tag), pop: (c) => g.population(c.tag),
    tech: (c) => c.techs.length, area: (c) => (g.ownedProvs.get(c.tag) || []).reduce((a, p) => a + app.world.provinces[p].area, 0),
  }[tab];
  const fmt = { gdp: fmtMoney, mil: fmtInt, pop: people, tech: fmtInt, area: (v) => `${fmtInt(v / 1000)} B km²` }[tab];
  const rows = alive.map((c) => ({ c, v: val(c) })).sort((a, b) => b.v - a.v);
  const myRank = rows.findIndex((r) => r.c.tag === me) + 1;
  const tbl = h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', null, '#'), h('th', null, 'Ülke'), h('th', { class: 'r' }, defs.find((d) => d[0] === tab)[1]))));
  const tb = h('tbody');
  rows.slice(0, 40).forEach((r, i) => tb.appendChild(h('tr', { class: r.c.tag === me ? 'me' : '', style: { cursor: 'pointer' }, onclick: () => { app.openCountry(r.c.tag); app.renderer.centerOnCountry(r.c.tag); } },
    h('td', { class: 'num' }, i + 1), h('td', null, h('span', { class: 'row', style: { gap: '6px' } }, flagImg(r.c, 'sm'), r.c.short)), h('td', { class: 'r num' }, fmt(r.v)))));
  tbl.appendChild(tb);
  body.appendChild(h('div', { class: 'tiny muted', style: { marginBottom: '6px' } }, `Sıralamanız: ${myRank}. / ${rows.length}`));
  body.appendChild(tbl);
  body.appendChild(section('🛡️ Askeri İttifaklar', h('div', { class: 'stack' }, Object.values(g.s.factions).map((f) => h('div', { class: 'card' },
    h('div', { class: 'row between' }, h('b', null, f.name), h('span', { class: 'tiny muted' }, `${f.members.length} üye`)),
    h('div', { class: 'row wrap', style: { gap: '3px', marginTop: '6px' } }, f.members.map((m) => h('span', { title: g.C(m)?.name, style: { cursor: 'pointer' }, onclick: () => app.openCountry(m) }, flagImg(g.C(m), 'sm')))))))));
}

// ---------------------------------------------------------------------------
// Haber arşivi
// ---------------------------------------------------------------------------
function renderNewsMenu(app, body) {
  const g = app.game, me = g.s.player;
  const f = app._newsFilter || 'all';
  const tabs = h('div', { class: 'tabs' });
  for (const [id, label] of [['all', 'Tümü'], ['mine', 'Benimle ilgili'], ['war', 'Savaş'], ['diplo', 'Diplomasi'], ['world', 'Dünya']]) tabs.appendChild(h('button', { class: `tab ${f === id ? 'active' : ''}`, onclick: () => { app._newsFilter = id; app.renderLeft(); } }, label));
  body.appendChild(tabs);
  const items = g.s.news.filter((n) => f === 'all' || (f === 'mine' && n.tags.includes(me)) || (f === 'war' && ['war', 'battle', 'victory', 'defeat', 'nuke', 'strike', 'peace'].includes(n.type)) || (f === 'diplo' && ['diplo', 'politics'].includes(n.type)) || (f === 'world' && n.type === 'world')).slice(-150).reverse();
  body.appendChild(h('div', null, items.map((n) => h('div', { class: `news-item ${n.type}`, onclick: () => { if (n.pid !== null && n.pid !== undefined) { app.renderer.centerOn(n.pid, Math.max(app.renderer.cam.z, 3)); app.openProvince(n.pid); } } }, h('span', { class: 'when' }, formatDate(n.day)), n.text))));
}
