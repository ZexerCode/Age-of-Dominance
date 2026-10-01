// Sağ paneller: il, ülke; alt birlik çubuğu
import { h, mount, section, kv, stat, btn, meter, progress } from './dom.js';
import { flagImg, leaderPortrait, wikiAny } from './assets.js';
import { UNIT_TYPES, TERRAINS, GOVERNMENTS, BLOC_NAMES } from '../data/rules.js';
import { fmtMoney, fmtInt, fmt1, fmtManpower, formatDate } from '../engine/util.js';
import * as eco from '../engine/economy.js';
import * as mil from '../engine/military.js';
import * as dip from '../engine/diplomacy.js';
import { PROJECTS, canBuild, build } from '../engine/events.js';
import { drawUnitIcon } from '../render/map.js';
import { confirmModal, peaceModal, aidModal } from './screens.js';

const people = (n) => (n >= 1e9 ? `${fmt1(n / 1e9)} Mr` : n >= 1e6 ? `${fmt1(n / 1e6)} Mn` : n >= 1e3 ? `${fmtInt(n / 1e3)} B` : fmtInt(n));

function head(app, title, sub, flagC) {
  return h('div', { class: 'panel-head' },
    flagC ? flagImg(flagC, 'md') : null,
    h('div', { class: 'grow' }, h('h2', { class: 'ellipsis' }, title), sub ? h('div', { class: 'sub' }, sub) : null),
    h('button', { class: 'close', title: 'Kapat (Esc)', onclick: () => app.closeRight() }, '×'));
}
function countryLink(app, c, size = 'sm') {
  return h('span', { class: 'row', style: { cursor: 'pointer', gap: '6px' }, onclick: () => app.openCountry(c.tag) }, flagImg(c, size), h('span', { style: { textDecoration: 'underline dotted' } }, c.name));
}
export function unitIconCanvas(type, size = 16) {
  const c = h('canvas', { width: size * 2, height: size * 2, style: { width: `${size}px`, height: `${size}px` } });
  const x = c.getContext('2d');
  x.scale(2, 2);
  drawUnitIcon(x, type, 1, 2, size - 3, size - 5);
  return c;
}

// ---------------------------------------------------------------------------
// İl paneli
// ---------------------------------------------------------------------------
export function renderProvincePanel(app, el, pid) {
  const g = app.game, P = g.s.prov, W = app.world;
  const p = W.provinces[pid];
  const me = g.s.player;
  const owner = g.C(P.owner[pid]), ctrl = g.C(P.ctrl[pid]);
  const terr = TERRAINS[p.terrain];
  const body = h('div', { class: 'panel-body' });
  mount(el, head(app, p.name, `${terr.name}${p.city && p.city !== p.name ? ` · ${p.city}` : ''}`, owner), body);

  // Wikipedia görseli
  const wikiBox = h('div');
  body.appendChild(wikiBox);
  wikiAny([[p.name, 'tr'], [p.city, 'tr'], [p.name, 'en']]).then((d) => {
    if (!d || !d.thumb || !wikiBox.isConnected) return;
    mount(wikiBox, h('a', { href: d.url, target: '_blank', rel: 'noopener', title: 'Wikipedia’da aç' },
      h('img', { src: d.thumb, referrerpolicy: 'no-referrer', style: { width: '100%', maxHeight: '150px', objectFit: 'cover', borderRadius: '6px', marginBottom: '10px', border: '1px solid var(--line)' } })));
  });

  if (owner.tag !== me) body.appendChild(btn(`🏳️ ${owner.short}: ülke bilgisi ve diplomasi`, () => app.openCountry(owner.tag), { cls: 'block', title: 'Ülke paneli' }));
  body.appendChild(h('div', { class: 'stack', style: { marginBottom: '12px', marginTop: owner.tag !== me ? '8px' : 0 } },
    h('div', { class: 'row between' }, h('span', { class: 'muted' }, 'Sahibi'), countryLink(app, owner)),
    ctrl !== owner ? h('div', { class: 'row between' }, h('span', { class: 'red' }, 'İşgal eden'), countryLink(app, ctrl)) : null,
    P.core[pid] !== P.owner[pid] ? h('div', { class: 'row between' }, h('span', { class: 'muted' }, 'Asıl sahibi (çekirdek)'), countryLink(app, g.C(P.core[pid]))) : null));

  body.appendChild(h('div', { class: 'stat-grid', style: { marginBottom: '12px' } },
    stat('Nüfus', people(P.pop[pid])),
    stat('GSYH', fmtMoney(P.gdp[pid] * (1 - P.dev[pid]))),
    stat('Fabrika', fmtInt(P.fac[pid])),
    stat('Tahkimat', `${P.fort[pid]}/5`),
    stat('Altyapı', `${P.infra[pid]}/5`),
    stat('Garnizon', `%${fmtInt((P.garr[pid] ?? 1) * 100)}`),
  ));
  body.appendChild(kv([
    ['Arazi', `${terr.name} (saldırı ×${terr.atk}, savunma ×${terr.def})`],
    ['Muharebe genişliği', `${mil.combatWidth(g, pid)} tümen`],
    ['Kıyı', p.coastal ? 'Var (liman)' : 'Yok'],
    P.dev[pid] > 0.01 ? ['Savaş hasarı', `%${fmtInt(P.dev[pid] * 100)}`, 'red'] : [null],
    ['Alan', `${fmtInt(p.area)} km²`],
  ]));

  // Muharebe
  const b = g.battleByProv.get(pid);
  if (b) {
    const tot = b.ap + b.dp || 1;
    body.appendChild(section('⚔️ Muharebe',
      h('div', { class: 'card' },
        h('div', { class: 'row between' }, countryLink(app, g.C(b.attTag)), h('span', { class: 'muted' }, 'vs'), countryLink(app, g.C(b.defTag))),
        h('div', { style: { margin: '8px 0 4px' } }, progress(b.ap / tot, 'blue')),
        h('div', { class: 'row between tiny muted' }, h('span', null, `Saldırı gücü ${fmtInt(b.ap)}`), h('span', null, `${b.days}. gün`), h('span', null, `Savunma ${fmtInt(b.dp)}`)),
        h('div', { class: 'tiny muted', style: { marginTop: '4px' } }, `Cephede: ${b.fa || 0} saldıran / ${b.fd || 0} savunan tümen (genişlik ${b.width || '-'})`))));
  }

  // Birlikler
  const units = g.unitsAt(pid);
  if (units.length) {
    const byOwner = new Map();
    for (const u of units) { if (!byOwner.has(u.o)) byOwner.set(u.o, []); byOwner.get(u.o).push(u); }
    const list = h('div', { class: 'stack' });
    for (const [o, us] of byOwner) {
      const counts = {};
      for (const u of us) counts[u.t] = (counts[u.t] || 0) + 1;
      list.appendChild(h('div', { class: 'card' },
        h('div', { class: 'row between' }, countryLink(app, g.C(o)), o === me ? btn('Seç', () => app.selectUnits(us.map((u) => u.id)), { cls: 'sm' }) : h('span', { class: 'num' }, `${us.length} tümen`)),
        h('div', { class: 'row wrap', style: { marginTop: '6px' } }, Object.entries(counts).map(([t, n]) => h('span', { class: 'tag' }, unitIconCanvas(t, 13), `${n} ${UNIT_TYPES[t].short}`)))));
    }
    body.appendChild(section('🪖 Birlikler', list));
  }

  // Eylemler
  const actions = h('div', { class: 'stack' });
  if (app.selectedUnits.size) actions.appendChild(btn(`➜ Seçili ${app.selectedUnits.size} tümeni buraya gönder`, () => app.orderSelectedTo(pid), { cls: 'primary block' }));
  const myC = g.C(me);
  if (P.owner[pid] === me && P.ctrl[pid] === me) {
    const builds = h('div', { class: 'stack' });
    for (const [kind, pr] of Object.entries(PROJECTS)) {
      const chk = canBuild(g, me, pid, kind);
      builds.appendChild(h('div', { class: 'row' },
        h('div', { class: 'grow' }, h('div', { style: { fontWeight: 600 } }, pr.name), h('div', { class: 'tiny muted' }, `${pr.desc} · ${fmtMoney(chk.cost ?? 0)}`)),
        btn('İnşa et', () => { const r = build(g, me, pid, kind); if (!r.ok) app.toast(r.why, 'war'); app.renderRight(); app.updateTopbar(); }, { cls: 'sm', disabled: !chk.ok, why: chk.why })));
    }
    const timers = (myC.timers || []).filter((t) => t.pid === pid);
    for (const t of timers) builds.appendChild(h('div', { class: 'meter tiny' }, h('span', { class: 'muted', style: { minWidth: '92px' } }, `🏗️ ${PROJECTS[t.kind]?.name}`), progress((g.s.day - t.start) / (t.day - t.start)), h('span', null, `${t.day - g.s.day} gün`)));
    actions.appendChild(section('🏗️ İnşaat', builds));
    actions.appendChild(btn(myC.deploy === pid ? '✓ Yeni birlikler burada konuşlanıyor' : '📍 Yeni birlikleri burada konuşlandır', () => { myC.deploy = pid; app.renderRight(); }, { cls: 'block', disabled: myC.deploy === pid }));
  }
  if (g.atWar(me, P.ctrl[pid])) {
    const strikes = h('div', { class: 'stack' });
    const m = mil.canStrike(g, me, pid, 'missile');
    strikes.appendChild(btn(`🚀 Balistik füze saldırısı (10 füze, stok ${myC.missiles})`, () => { const r = mil.missileStrike(g, me, pid); if (!r.ok) app.toast(r.why, 'war'); app.refreshUi(true); app.updateTopbar(); }, { cls: 'block', disabled: !m.ok, why: m.why }));
    const d = mil.canStrike(g, me, pid, 'drone');
    strikes.appendChild(btn(`🛩️ SİHA saldırısı (stok ${myC.drones})`, () => { const r = mil.droneStrike(g, me, pid); if (!r.ok) app.toast(r.why, 'war'); app.refreshUi(true); app.updateTopbar(); }, { cls: 'block', disabled: !d.ok, why: d.why }));
    if (myC.nukes > 0) {
      const n = mil.canStrike(g, me, pid, 'nuke');
      strikes.appendChild(btn(`☢️ NÜKLEER SALDIRI (${fmtInt(myC.nukes)} başlık)`, () => confirmModal(app, '☢️ Nükleer saldırı', `${p.name} bölgesine nükleer saldırı düzenlemek üzeresiniz. Milyonlarca insan ölebilir, tüm dünya size karşı dönecek ve düşman nükleer misilleme yapabilir. Emin misiniz?`, 'Ateşle', () => { mil.nuclearStrike(g, me, pid); app.refreshUi(true); app.updateTopbar(); }, true), { cls: 'danger block', disabled: !n.ok, why: n.why }));
    }
    actions.appendChild(section('🎯 Stratejik Saldırı', strikes));
  }
  if (actions.children.length) body.appendChild(section('Eylemler', actions));
}

// ---------------------------------------------------------------------------
// Ülke paneli
// ---------------------------------------------------------------------------
export function renderCountryPanel(app, el, tag) {
  const g = app.game, me = g.s.player;
  const c = g.C(tag);
  const isMe = tag === me;
  const body = h('div', { class: 'panel-body' });
  mount(el, head(app, c.name, `${GOVERNMENTS[c.gov].name} · ${BLOC_NAMES[c.bloc] || ''}`, c), body);
  if (!c.alive) { body.appendChild(h('div', { class: 'card red' }, 'Bu ülke artık mevcut değil.')); return; }
  const fid = g.factionOf.get(tag);
  body.appendChild(h('div', { class: 'row', style: { alignItems: 'flex-start', gap: '12px', marginBottom: '12px' } },
    leaderPortrait(c),
    h('div', { class: 'stack grow', style: { gap: '4px' } },
      h('div', { class: 'tiny muted' }, c.leader.title),
      h('div', { style: { fontWeight: 700, fontSize: '16px' } }, c.leader.name),
      h('div', { class: 'row wrap', style: { gap: '4px', marginTop: '4px' } },
        isMe ? h('span', { class: 'tag gold' }, '★ Sizin ülkeniz') : null,
        fid ? h('span', { class: 'tag blue' }, `🛡️ ${g.s.factions[fid].name}`) : null,
        c.puppetOf ? h('span', { class: 'tag' }, `Kukla: ${g.C(c.puppetOf).short}`) : null,
        g.isAtWar(tag) ? h('span', { class: 'tag red' }, '⚔️ Savaşta') : null,
        c.nukes > 0 ? h('span', { class: 'tag red' }, '☢️ Nükleer güç') : null,
        c.sanctions.length ? h('span', { class: 'tag' }, `💼 ${c.sanctions.length} yaptırım`) : null))));

  const b = eco.budgetInfo(g, tag);
  body.appendChild(h('div', { class: 'stat-grid', style: { marginBottom: '12px' } },
    stat('GSYH', fmtMoney(b.gdp)),
    stat('Nüfus', people(g.population(tag))),
    stat('Tümen', fmtInt(g.unitsOf(tag).length)),
    stat('Uçak', fmtInt(c.air * 12)),
    stat('Deniz', fmtInt(c.navy)),
    stat('Teknoloji', `${c.techs.length}`),
    stat('İstikrar', `%${fmtInt(c.stability)}`, c.stability < 35 ? 'red' : ''),
    stat('Savaş Desteği', `%${fmtInt(c.warSupport)}`),
    stat('Askeri Güç', fmtInt(g.militaryPower(tag))),
  ));

  if (!isMe && me) {
    const r = g.rel(me, tag);
    const rel = h('div', { class: 'stack' },
      meter('İlişkiler', (r + 100) / 200, `${r > 0 ? '+' : ''}${fmtInt(r)}`, r >= 30 ? 'green' : r <= -30 ? 'red' : ''),
      h('div', { class: 'row wrap', style: { gap: '4px' } },
        g.atWar(me, tag) ? h('span', { class: 'tag red' }, '⚔️ Savaştasınız') : null,
        g.isAlly(me, tag) ? h('span', { class: 'tag blue' }, '🤝 Müttefik') : null,
        g.hasTreaty('nap', me, tag) ? h('span', { class: 'tag' }, '🕊️ Saldırmazlık paktı') : null,
        g.hasTreaty('access', me, tag) ? h('span', { class: 'tag' }, '🚪 Geçiş izni') : null,
        g.guarantees(me, tag) ? h('span', { class: 'tag green' }, '🛡️ Garanti ediyorsunuz') : null,
        g.guarantees(tag, me) ? h('span', { class: 'tag green' }, '🛡️ Sizi garanti ediyor') : null,
        c.sanctions.includes(me) ? h('span', { class: 'tag' }, '💼 Yaptırım uyguluyorsunuz') : null,
        g.C(me).claims[tag] > g.s.day ? h('span', { class: 'tag gold' }, '📜 Savaş gerekçeniz var') : null,
        g.C(me).justify?.target === tag ? h('span', { class: 'tag gold' }, `🕵️ Gerekçe hazırlanıyor (${g.C(me).justify.until - g.s.day} gün)`) : null,
        g.C(me).improving[tag] ? h('span', { class: 'tag green' }, '📈 İlişki geliştiriliyor') : null));
    body.appendChild(section('Diplomatik Durum', rel));
    body.appendChild(section('Diplomatik Eylemler', diplomacyActions(app, tag)));
  }

  // Savaşlar
  const wars = g.warsOf(tag);
  if (wars.length) {
    body.appendChild(section('⚔️ Savaşlar', h('div', { class: 'stack' }, wars.map((w) => {
      const sc = dip.warScore(g, w) * (w.att.includes(tag) ? 1 : -1);
      return h('div', { class: 'card' }, h('div', { style: { fontWeight: 600 } }, w.name),
        h('div', { class: 'tiny muted' }, `${formatDate(Math.max(0, w.start))}'den beri · Skor ${sc > 0 ? '+' : ''}${fmtInt(sc)}`));
    }))));
  }
  // Antlaşmalar
  const tr = g.s.treaties.filter((t) => t.a === tag || t.b === tag);
  if (tr.length || fid) {
    const NAMES = dip.TREATY_NAMES;
    body.appendChild(section('📜 Antlaşmalar', h('div', { class: 'row wrap', style: { gap: '4px' } },
      fid ? h('span', { class: 'tag blue' }, `${g.s.factions[fid].name} (${g.s.factions[fid].members.length} üye)`) : null,
      tr.slice(0, 24).map((t) => {
        const other = g.C(t.a === tag ? t.b : t.a);
        const label = t.t === 'guarantee' ? (t.a === tag ? `${other.short}'yı garanti eder` : `${other.short} tarafından garanti`) : `${NAMES[t.t]}: ${other.short}`;
        return h('span', { class: 'tag', style: { cursor: 'pointer' }, onclick: () => app.openCountry(other.tag) }, label);
      }))));
  }
  // Wikipedia
  const about = h('div', { class: 'wiki-text muted' }, 'Wikipedia özeti yükleniyor…');
  body.appendChild(section('📖 Hakkında', about));
  wikiAny([[c.wiki, 'tr'], [c.name, 'tr'], [c.en, 'en']]).then((d) => {
    if (!about.isConnected) return;
    if (!d) { about.textContent = 'Özet bulunamadı.'; return; }
    mount(about, h('div', null, d.extract.length > 600 ? `${d.extract.slice(0, 600)}…` : d.extract), h('a', { class: 'src', href: d.url, target: '_blank', rel: 'noopener' }, `Kaynak: Wikipedia (${d.lang})`));
  });
}

function diplomacyActions(app, tag) {
  const g = app.game, me = g.s.player;
  const my = g.C(me), c = g.C(tag);
  const refresh = () => { app.renderer.recolor(); app.politicalDirty = true; app.renderRight(); app.updateTopbar(); };
  const res = (r) => { if (r && r.ok === false) app.toast(r.why, 'war'); else if (r?.pending) app.toast('Teklif iletildi.', 'diplo'); refresh(); };
  const out = h('div', { class: 'stack' });
  const atWar = g.atWar(me, tag);
  if (atWar) {
    out.appendChild(btn('🕊️ Barış teklif et…', () => peaceModal(app, tag), { cls: 'primary block' }));
  }
  const grid = h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' } });
  const add = (label, fn, chk, cls = '') => grid.appendChild(btn(label, fn, { cls: `sm wrap ${cls}`, disabled: chk && !chk.ok, why: chk?.why }));
  if (!atWar) {
    add(my.improving[tag] ? '📈 Geliştiriliyor…' : '📈 İlişkileri geliştir', () => res(dip.improveRelations(g, me, tag)), my.improving[tag] ? { ok: false, why: 'Devam ediyor' } : null);
    add('🗯️ Sert diplomatik nota', () => res(dip.insult(g, me, tag)));
    add(c.sanctions.includes(me) ? '💼 Yaptırımı kaldır' : '💼 Yaptırım uygula', () => res(dip.toggleSanction(g, me, tag)));
    add('💰 Yardım gönder…', () => aidModal(app, tag));
    const ally = g.isAlly(me, tag);
    if (g.hasTreaty('alliance', me, tag)) add('✂️ İttifakı feshet', () => res(dip.cancelTreaty(g, me, tag, 'alliance')));
    else add('🤝 İttifak teklif et', () => res(dip.proposeTreaty(g, me, tag, 'alliance')), ally ? { ok: false, why: 'Zaten müttefiksiniz' } : dip.wouldAccept(g, me, tag, 'alliance'));
    if (g.hasTreaty('nap', me, tag)) add('✂️ Paktı boz', () => res(dip.cancelTreaty(g, me, tag, 'nap')));
    else add('🕊️ Saldırmazlık paktı', () => res(dip.proposeTreaty(g, me, tag, 'nap')), dip.wouldAccept(g, me, tag, 'nap'));
    if (g.hasTreaty('access', me, tag)) add('✂️ Geçiş iznini iptal et', () => res(dip.cancelTreaty(g, me, tag, 'access')));
    else add('🚪 Askeri geçiş izni iste', () => res(dip.proposeTreaty(g, me, tag, 'access')), dip.wouldAccept(g, me, tag, 'access'));
    if (g.guarantees(me, tag)) add('✂️ Garantiyi kaldır', () => res(dip.cancelTreaty(g, me, tag, 'guarantee')));
    else add('🛡️ Bağımsızlığını garanti et', () => res(dip.proposeTreaty(g, me, tag, 'guarantee')));
    const fid = g.factionOf.get(me);
    if (fid && g.s.factions[fid].leader === me && !g.factionOf.get(tag)) add(`➕ ${g.s.factions[fid].name}’na davet et`, () => res(dip.inviteToFaction(g, me, tag)));
    if (g.factionOf.get(tag) && !g.factionOf.get(me) && g.s.factions[g.factionOf.get(tag)].leader === tag) {
      const f = g.factionOf.get(tag);
      add(`🛡️ ${g.s.factions[f].name}’na katılmak iste`, () => res(dip.joinFaction(g, me, f)), dip.canJoinFaction(g, me, f));
    }
  }
  out.appendChild(grid);
  if (!atWar) {
    const just = my.justify?.target === tag ? { ok: false, why: 'Hazırlanıyor' } : my.claims[tag] > g.s.day ? { ok: false, why: 'Gerekçe hazır' } : my.justify ? { ok: false, why: 'Başka bir gerekçe hazırlanıyor' } : { ok: true };
    out.appendChild(btn('🕵️ Savaş gerekçesi hazırla (45 gün)', () => res(dip.justifyWar(g, me, tag)), { cls: 'block', disabled: !just.ok, why: just.why }));
    const chk = dip.canDeclareWar(g, me, tag);
    const cost = dip.warDeclarationCost(g, me, tag);
    const allies = [...g.alliesOf(tag)].filter((t) => g.C(t)?.alive).map((t) => g.C(t).short);
    const guarantors = g.s.treaties.filter((t) => t.t === 'guarantee' && t.b === tag).map((t) => g.C(t.a).short);
    const warn = [allies.length ? `Müttefikleri: ${allies.slice(0, 8).join(', ')}${allies.length > 8 ? '…' : ''}` : '', guarantors.length ? `Garantörleri: ${guarantors.join(', ')}` : ''].filter(Boolean).join('. ');
    out.appendChild(btn('🔥 SAVAŞ İLAN ET', () => confirmModal(app, 'Savaş İlanı', `${c.name}'na savaş ilan etmek üzeresiniz.${cost.hasCB ? '' : ' Haklı bir gerekçeniz yok: istikrar ' + cost.stability + ' puan düşecek ve dünya kamuoyu tepki gösterecek.'}${cost.nap ? ' Saldırmazlık paktını bozacaksınız!' : ''} ${warn}`, 'Savaş ilan et', () => res(dip.declareWar(g, me, tag)), true), { cls: 'danger block', disabled: !chk.ok, why: chk.why }));
    if (warn) out.appendChild(h('div', { class: 'tiny muted' }, `⚠️ ${warn}`));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Birlik çubuğu
// ---------------------------------------------------------------------------
export function renderUnitBar(app, el) {
  const g = app.game;
  const units = [...app.selectedUnits].map((id) => g.unitById.get(id)).filter(Boolean);
  const counts = {};
  let str = 0, org = 0, moving = 0, fighting = 0, unsup = 0;
  for (const u of units) {
    counts[u.t] = (counts[u.t] || 0) + 1;
    str += u.s; org += u.g / (UNIT_TYPES[u.t].org / 100);
    if (u.path.length) moving++;
    if (u.b) fighting++;
    if (!u.sup) unsup++;
  }
  const n = units.length || 1;
  const cards = h('div', { class: 'ucards' }, units.slice(0, 40).map((u) => {
    const ut = UNIT_TYPES[u.t];
    const status = u.b ? '⚔️ Saldırıyor' : u.path.length ? `➜ ${app.world.provinces[u.path[u.path.length - 1]].name}` : u.ent >= 5 ? '🧱 Mevzide' : '⏸ Beklemede';
    return h('div', { class: 'ucard', title: `${ut.name}\nSaldırı ${ut.atk} · Savunma ${ut.def} · Hız ${ut.speed} km/gün\nTecrübe %${fmtInt(u.x * 100)}`, onclick: (e) => { if (e.shiftKey) { app.selectedUnits.delete(u.id); app.renderUnitBar(); app.renderer.dirty = true; } else { app.renderer.centerOn(u.p); } } },
      h('div', { class: 't' }, unitIconCanvas(u.t, 14), ut.short),
      h('div', { class: 's ellipsis' }, `${app.world.provinces[u.p].name} · ${status}`),
      h('div', { class: 'bars' }, progress(u.s, u.s > 0.6 ? 'green' : 'red'), progress(u.g / (ut.org / 100))),
      !u.sup ? h('div', { class: 'tiny red' }, '⚠ İkmal yok') : null);
  }));
  mount(el,
    h('div', { class: 'row between', style: { marginBottom: '8px' } },
      h('div', { class: 'row' }, h('b', { class: 'num', style: { fontSize: '18px' } }, `${units.length} tümen seçili`),
        h('span', { class: 'tiny muted' }, Object.entries(counts).map(([t, k]) => `${k} ${UNIT_TYPES[t].short}`).join(' · '))),
      h('div', { class: 'row' },
        btn('⏹ Durdur', () => { mil.stopUnits(g, g.s.player, units.map((u) => u.id)); app.renderUnitBar(); app.renderer.dirty = true; }, { cls: 'sm' }),
        btn('🗑 Dağıt', () => confirmModal(app, 'Birlikleri dağıt', `${units.length} tümeni terhis etmek istediğinize emin misiniz? Bu işlem geri alınamaz.`, 'Dağıt', () => { mil.disbandUnits(g, g.s.player, units.map((u) => u.id)); app.clearUnitSelection(); }, true), { cls: 'sm' }),
        btn('✖', () => app.clearUnitSelection(), { cls: 'sm', title: 'Seçimi temizle (Esc)' }))),
    h('div', { class: 'row', style: { gap: '14px', marginBottom: '8px' } },
      h('div', { class: 'grow' }, meter('Güç', str / n, `%${fmtInt(str / n * 100)}`, 'green')),
      h('div', { class: 'grow' }, meter('Organizasyon', Math.min(1, org / n), `%${fmtInt(Math.min(1, org / n) * 100)}`))),
    cards,
    h('div', { class: 'tiny muted', style: { marginTop: '6px' } },
      `🖱️ Sağ tık: hareket/saldırı · Shift+sürükle: kutu seçimi · Çift tık: ildeki tüm birlikler${moving ? ` · ${moving} hareket halinde` : ''}${fighting ? ` · ${fighting} saldırıda` : ''}${unsup ? ` · ⚠ ${unsup} ikmalsiz` : ''}`));
  void fmtManpower;
}
