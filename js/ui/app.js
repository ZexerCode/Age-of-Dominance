// Uygulama çekirdeği: döngü, girdi, HUD, kayıt
import { h, mount, clear } from './dom.js';
import { flagImg } from './assets.js';
import { MapRenderer, MAP_MODES } from '../render/map.js';
import { Game } from '../engine/game.js';
import { createGame } from '../engine/setup.js';
import * as eco from '../engine/economy.js';
import * as mil from '../engine/military.js';
import { fmtMoney, fmtManpower, fmt1, fmtInt, formatDate } from '../engine/util.js';
import { UNIT_TYPES, TERRAINS } from '../data/rules.js';
import { renderProvincePanel, renderCountryPanel, renderUnitBar } from './panels.js';
import { MENUS } from './menus.js';
import { showStartMenu, showPending, showGameOver, showMenuModal, showHelp } from './screens.js';

const SPEEDS = [0, 1, 2, 4, 8, 20];
const SAVE_KEY = 'aod_save_';
const AUTOSAVE = 'aod_save_auto';

export class App {
  constructor(world) {
    this.world = world;
    this.canvas = document.getElementById('map');
    this.ui = document.getElementById('ui');
    this.renderer = new MapRenderer(this.canvas, world);
    this.game = null;
    this.speed = 0;
    this.lastSpeed = 2;
    this.accum = 0;
    this.selectedPid = -1;
    this.selectedCountry = null;
    this.selectedUnits = new Set();
    this.activeMenu = null;
    this.right = null; // 'province' | 'country'
    this.lastUiRefresh = 0;
    this.mode = 'menu'; // menu | select | play
    this.settings = loadSettings();
    this.bindInput();
    window.addEventListener('resize', () => { this.renderer.resize(); });
    requestAnimationFrame((t) => this.frame(t));
  }

  // ------------------------------------------------------------------ oyun
  startNewGame(tag, difficulty, aggression) {
    const state = createGame(this.world, { player: tag, difficulty, aiAggression: aggression });
    this.attachGame(new Game(this.world, state));
    this.renderer.centerOnCountry(tag);
    this.toast(`${this.game.C(tag).name} liderliğine hoş geldiniz. Oyun duraklatıldı — hazır olduğunuzda Boşluk tuşuyla başlatın.`, 'peace', 7000);
    if (!this.settings.seenHelp) { this.settings.seenHelp = true; saveSettings(this.settings); setTimeout(() => showHelp(this), 400); }
  }
  loadGame(json) {
    try {
      const g = Game.deserialize(this.world, json);
      this.attachGame(g);
      if (g.s.player) this.renderer.centerOnCountry(g.s.player);
      this.toast(`Kayıt yüklendi: ${g.dateStr()}`, 'diplo');
      return true;
    } catch (e) {
      console.error(e);
      this.toast('Kayıt dosyası okunamadı.', 'war');
      return false;
    }
  }
  attachGame(game) {
    this.game = game;
    this.mode = 'play';
    this.speed = 0;
    this.selectedUnits.clear();
    this.selectedPid = -1;
    this.selectedCountry = null;
    this.renderer.setGame(game);
    this.renderer.setMode('political');
    this.buildHud();
    game.on('news', (n) => this.onNews(n));
    game.on('pending', () => this.checkPending());
    game.on('control', () => { this.politicalDirty = true; });
    game.on('owner', () => { this.politicalDirty = true; });
    game.on('war', () => { this.politicalDirty = true; });
    game.on('strike', (e) => this.renderer.addEffect(e.kind, e.pid));
    game.on('gameover', () => { this.setSpeed(0); showGameOver(this); });
    this.refreshUi(true);
    this.checkPending();
  }
  exitToMenu() {
    this.game = null;
    this.mode = 'menu';
    clear(this.ui);
    this.renderer.setGame(null);
    showStartMenu(this);
  }

  setSpeed(n) {
    if (n > 0) this.lastSpeed = n;
    this.speed = n;
    this.updateTopbar();
  }
  togglePause() { this.setSpeed(this.speed ? 0 : this.lastSpeed || 2); }

  // ------------------------------------------------------------------ döngü
  frame(t) {
    const dt = Math.min(0.25, (t - (this.lastT || t)) / 1000);
    this.lastT = t;
    if (this.mode === 'play' && this.game && this.speed > 0 && !this.modalOpen && !this.game.s.over) {
      this.accum += dt * SPEEDS[this.speed];
      let n = 0;
      while (this.accum >= 1 && n < 6) {
        this.accum -= 1; n++;
        this.game.tick();
        if (this.game.s.day % 30 === 0) this.autosave();
        if (this.modalOpen || this.speed === 0) { this.accum = 0; break; }
      }
      if (n) { this.renderer.dirty = true; this.dayChanged = true; }
    }
    if (this.politicalDirty && this.game) {
      this.politicalDirty = false;
      this.renderer.rebuildPolitical();
    }
    if (this.dayChanged && this.game) {
      this.dayChanged = false;
      if (this.renderer.mode !== 'political' && this.renderer.mode !== 'terrain') this.renderer.recolor();
      this.updateTopbar();
      if (t - this.lastUiRefresh > 350) { this.lastUiRefresh = t; this.refreshUi(); }
    }
    if (this.mode === 'menu' || this.mode === 'select') {
      if (this.mode === 'menu' && !this.dragging) { this.renderer.cam.x += dt * 6; this.renderer.clampCam(); this.renderer.dirty = true; }
    }
    if (this.renderer.dirty) this.renderer.render(t);
    requestAnimationFrame((tt) => this.frame(tt));
  }

  autosave() {
    try { localStorage.setItem(AUTOSAVE, this.game.serialize()); } catch (e) { console.warn('Otomatik kayıt başarısız', e); }
  }
  saveSlot(slot) {
    try {
      const json = this.game.serialize();
      localStorage.setItem(SAVE_KEY + slot, json);
      localStorage.setItem(SAVE_KEY + slot + '_meta', JSON.stringify({ tag: this.game.s.player, name: this.game.C(this.game.s.player)?.name, day: this.game.s.day, saved: Date.now() }));
      this.toast(`Oyun kaydedildi (Yuva ${slot}).`, 'peace');
      return true;
    } catch (e) {
      this.toast('Kayıt başarısız: tarayıcı depolama alanı dolu olabilir.', 'war');
      return false;
    }
  }
  static slotMeta(slot) {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY + slot + '_meta') || 'null'); } catch { return null; }
  }
  static hasAutosave() { try { return !!localStorage.getItem(AUTOSAVE); } catch { return false; } }
  loadSlot(slot) {
    const json = localStorage.getItem(slot === 'auto' ? AUTOSAVE : SAVE_KEY + slot);
    if (!json) { this.toast('Bu yuvada kayıt yok.', 'war'); return false; }
    return this.loadGame(json);
  }
  exportSave() {
    const blob = new Blob([this.game.serialize()], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `aod-${this.game.s.player}-${this.game.s.day}.json` });
    document.body.appendChild(a); a.click(); a.remove();
  }

  // ------------------------------------------------------------------ HUD
  buildHud() {
    clear(this.ui);
    this.el = {};
    const top = h('header', { id: 'topbar' });
    this.el.topbar = top;
    const nav = h('nav', { id: 'sidenav' });
    for (const m of MENUS) {
      const b = h('button', { class: 'nav', title: `${m.name} (${m.key})`, onclick: () => this.toggleMenu(m.id) }, m.icon, h('span', null, m.short));
      b.dataset.menu = m.id;
      nav.appendChild(b);
    }
    this.el.nav = nav;
    this.el.left = h('aside', { id: 'leftpanel', class: 'panel', hidden: true });
    this.el.right = h('aside', { id: 'rightpanel', class: 'panel', hidden: true });
    const modes = h('div', { id: 'mapmodes' });
    for (const m of MAP_MODES) {
      const b = h('button', { class: `btn sm ${m.id === this.renderer.mode ? 'active' : ''}`, title: `${m.name} (${m.key})`, onclick: () => this.setMapMode(m.id) }, m.name);
      b.dataset.mode = m.id;
      modes.appendChild(b);
    }
    this.el.modes = modes;
    this.el.unitbar = h('div', { id: 'unitbar', hidden: true });
    this.el.news = h('div', { id: 'newsfeed' },
      h('div', { class: 'news-head', onclick: () => this.el.news.classList.toggle('collapsed') }, 'HABERLER', h('span', { class: 'tiny muted' }, '▾')),
      h('div', { class: 'news-list' }));
    this.el.tooltip = h('div', { id: 'tooltip', hidden: true });
    this.el.toasts = h('div', { id: 'toasts' });
    mount(this.ui, top, nav, this.el.left, this.el.right, modes, this.el.unitbar, this.el.news, this.el.tooltip, this.el.toasts);
    this.buildTopbar();
    this.renderNews();
  }
  buildTopbar() {
    const g = this.game, c = g.C(g.s.player);
    const top = this.el.topbar;
    clear(top);
    const nation = h('div', { class: 'nation', onclick: () => this.openCountry(g.s.player) },
      flagImg(c, 'md'),
      h('div', null, h('div', { class: 'name' }, c.short), h('div', { class: 'leader' }, `${c.leader.title}: ${c.leader.name}`)));
    const res = h('div', { class: 'res' });
    this.el.chips = {};
    const chip = (id, k, title) => {
      const v = h('div', { class: 'v num' }), d = h('div', { class: 'd' });
      const el = h('div', { class: 'chip', title }, h('div', { class: 'k' }, k), v, d);
      this.el.chips[id] = { el, v, d };
      res.appendChild(el);
    };
    chip('treasury', '💰 Hazine', 'Hazine ve günlük net bakiye');
    chip('gdp', '📈 GSYH', 'Gayri safi yurt içi hasıla ve yıllık büyüme');
    chip('factories', '🏭 Sanayi', 'Askeri fabrika ve günlük üretim puanı');
    chip('manpower', '👥 İnsan Gücü', 'Kullanılabilir insan gücü');
    chip('army', '🪖 Ordu', 'Tümen sayısı');
    chip('air', '✈️ Hava', 'Savaş uçağı filoları');
    chip('navy', '⚓ Deniz', 'Deniz gücü');
    chip('stab', '⚖️ İstikrar', 'İstikrar');
    chip('ws', '🔥 Destek', 'Halkın savaş desteği');
    chip('special', '🎯 Stratejik', 'Nükleer başlık / balistik füze / SİHA');
    chip('tension', '🌍 Gerginlik', 'Dünya gerginliği');
    const dateEl = h('div', { class: 'date num' });
    const speeds = h('div', { class: 'speeds' });
    this.el.speedBtns = [];
    const labels = ['⏸', '1', '2', '3', '4', '5'];
    labels.forEach((l, i) => {
      const b = h('button', { class: 'btn', title: i ? `Hız ${i}` : 'Duraklat (Boşluk)', onclick: () => this.setSpeed(i) }, l);
      this.el.speedBtns.push(b);
      speeds.appendChild(b);
    });
    this.el.date = dateEl;
    const timebox = h('div', { class: 'timebox' }, dateEl, speeds);
    const menu = h('div', { class: 'menu-btn' }, h('button', { class: 'btn icon', title: 'Menü (Esc)', onclick: () => showMenuModal(this) }, '☰'));
    top.append(nation, res, timebox, menu);
    this.updateTopbar();
  }
  updateTopbar() {
    if (!this.game || !this.el?.chips) return;
    const g = this.game, tag = g.s.player, c = g.C(tag);
    const b = eco.budgetInfo(g, tag);
    const ch = this.el.chips;
    const set = (id, v, d, cls) => { ch[id].v.textContent = v; ch[id].d.textContent = d || ''; ch[id].d.className = `d ${cls || ''}`; };
    set('treasury', fmtMoney(c.treasury), `${b.net >= 0 ? '+' : ''}${fmtMoney(b.net)}/gün`, b.net >= 0 ? 'green' : 'red');
    ch.treasury.v.className = `v num ${c.treasury < 0 ? 'red' : ''}`;
    const gr = eco.growthRate(g, tag);
    set('gdp', fmtMoney(b.gdp), `${gr >= 0 ? '+' : ''}${fmt1(gr)}%/yıl`, gr >= 0 ? 'green' : 'red');
    set('factories', fmtInt(eco.countryFactories(g, tag)), `${fmt1(eco.productionPoints(g, tag))} ÜP/gün`, 'muted');
    const mp = eco.manpowerInfo(g, tag);
    set('manpower', fmtManpower(Math.max(0, mp.available)), `/${fmtManpower(mp.max)}`, mp.available < 50 ? 'red' : 'muted');
    const units = g.unitsOf(tag);
    set('army', `${units.length} tümen`, `${c.queue.length} üretimde`, 'muted');
    set('air', fmtInt(c.air * 12), `${fmt1(c.air)} filo`, 'muted');
    set('navy', fmtInt(c.navy), 'gemi gücü', 'muted');
    set('stab', `%${fmtInt(c.stability)}`, '', '');
    ch.stab.v.className = `v num ${c.stability < 35 ? 'red' : c.stability > 65 ? 'green' : ''}`;
    set('ws', `%${fmtInt(c.warSupport)}`, '', '');
    set('special', `☢${fmtInt(c.nukes)} 🚀${fmtInt(c.missiles)} 🛩${fmtInt(c.drones)}`, '', '');
    set('tension', `%${fmtInt(g.s.worldTension)}`, '', '');
    ch.tension.v.className = `v num ${g.s.worldTension > 60 ? 'red' : ''}`;
    this.el.date.textContent = formatDate(g.s.day);
    this.el.date.classList.toggle('paused', this.speed === 0);
    this.el.speedBtns.forEach((b2, i) => b2.classList.toggle('active', i === this.speed));
    // savaş rozetleri
    const warBtn = this.el.nav.querySelector('[data-menu="wars"]');
    if (warBtn) {
      let badge = warBtn.querySelector('.badge');
      const n = g.warsOf(tag).length;
      if (n && !badge) { badge = h('span', { class: 'badge' }); warBtn.appendChild(badge); }
      if (badge) { if (n) badge.textContent = n; else badge.remove(); }
    }
  }

  setMapMode(id) {
    this.renderer.setMode(id);
    for (const b of this.el.modes.querySelectorAll('button')) b.classList.toggle('active', b.dataset.mode === id);
  }

  toggleMenu(id) {
    if (this.activeMenu === id) { this.activeMenu = null; this.el.left.hidden = true; }
    else { this.activeMenu = id; this.el.left.hidden = false; }
    for (const b of this.el.nav.querySelectorAll('.nav')) b.classList.toggle('active', b.dataset.menu === this.activeMenu);
    this.renderLeft();
  }
  renderLeft() {
    if (!this.activeMenu || !this.game) return;
    const m = MENUS.find((x) => x.id === this.activeMenu);
    const body = h('div', { class: 'panel-body' });
    mount(this.el.left,
      h('div', { class: 'panel-head' }, h('span', { style: { fontSize: '20px' } }, m.icon), h('h2', null, m.name), h('button', { class: 'close', onclick: () => this.toggleMenu(m.id) }, '×')),
      body);
    m.render(this, body);
  }
  openProvince(pid) {
    this.selectedPid = pid;
    this.renderer.selectedPid = pid;
    this.selectedCountry = null;
    this.renderer.selectedCountry = null;
    this.right = 'province';
    this.renderRight();
    this.renderer.dirty = true;
  }
  openCountry(tag) {
    this.selectedCountry = tag;
    this.renderer.selectedCountry = tag;
    this.selectedPid = -1;
    this.renderer.selectedPid = -1;
    this.right = 'country';
    if (this.renderer.mode === 'diplomacy') this.renderer.recolor();
    this.renderRight();
    this.renderer.dirty = true;
  }
  closeRight() {
    this.right = null;
    this.selectedPid = -1; this.renderer.selectedPid = -1;
    this.selectedCountry = null; this.renderer.selectedCountry = null;
    this.el.right.hidden = true;
    if (this.renderer.mode === 'diplomacy') this.renderer.recolor();
    this.renderer.dirty = true;
  }
  renderRight() {
    if (!this.game) return;
    if (!this.right) { this.el.right.hidden = true; return; }
    this.el.right.hidden = false;
    if (this.right === 'province' && this.selectedPid >= 0) renderProvincePanel(this, this.el.right, this.selectedPid);
    else if (this.right === 'country' && this.selectedCountry) renderCountryPanel(this, this.el.right, this.selectedCountry);
  }
  refreshUi(force = false) {
    if (!this.game || !this.el) return;
    const busy = (el) => !force && (el.matches(':hover') && this.pointerDownInUi);
    if (this.activeMenu && !busy(this.el.left)) {
      const scroll = this.el.left.querySelector('.panel-body')?.scrollTop || 0;
      this.renderLeft();
      const body = this.el.left.querySelector('.panel-body'); if (body) body.scrollTop = scroll;
    }
    if (this.right && !busy(this.el.right)) {
      const scroll = this.el.right.querySelector('.panel-body')?.scrollTop || 0;
      this.renderRight();
      const body = this.el.right.querySelector('.panel-body'); if (body) body.scrollTop = scroll;
    }
    this.renderUnitBar();
  }

  // ------------------------------------------------------------------ birlik seçimi
  selectUnits(ids, add = false) {
    if (!add) this.selectedUnits.clear();
    for (const id of ids) this.selectedUnits.add(id);
    this.renderer.selectedUnits = this.selectedUnits;
    this.renderer.dirty = true;
    this.renderUnitBar();
  }
  clearUnitSelection() {
    this.selectedUnits.clear();
    this.renderer.previewPath = null;
    this.renderer.dirty = true;
    this.renderUnitBar();
  }
  renderUnitBar() {
    if (!this.game || !this.el) return;
    // ölen birlikleri temizle
    for (const id of [...this.selectedUnits]) if (!this.game.unitById.has(id)) this.selectedUnits.delete(id);
    if (!this.selectedUnits.size) { this.el.unitbar.hidden = true; return; }
    this.el.unitbar.hidden = false;
    renderUnitBar(this, this.el.unitbar);
  }
  orderSelectedTo(pid) {
    const g = this.game;
    const ids = [...this.selectedUnits];
    if (!ids.length) return;
    const res = mil.orderMove(g, g.s.player, ids, pid);
    if (res.fail && !res.ok) this.toast(`${this.world.provinces[pid].name} bölgesine ulaşılabilecek bir yol yok (geçiş izni, deniz kuvveti ya da kara bağlantısı gerekli).`, 'war');
    else if (res.fail) this.toast(`${res.fail} birlik hedefe ulaşamıyor.`, 'war');
    this.renderer.previewPath = null;
    this.renderer.dirty = true;
    this.renderUnitBar();
  }

  // ------------------------------------------------------------------ haberler & bildirimler
  onNews(n) {
    const g = this.game;
    const mine = n.tags.includes(g.s.player);
    if (n.important && (mine || n.type === 'war' || n.type === 'nuke' || n.type === 'peace')) this.toast(n.text, n.type, mine ? 6500 : 4500, n.pid);
    this.newsDirty = true;
    if (!this.newsTimer) this.newsTimer = setTimeout(() => { this.newsTimer = null; this.renderNews(); }, 250);
    if (n.type === 'nuke' && this.settings.pauseOnNuke !== false) this.setSpeed(0);
    if (mine && n.important && n.type === 'war' && this.settings.pauseOnWar !== false) this.setSpeed(0);
  }
  renderNews() {
    if (!this.game || !this.el?.news) return;
    const list = this.el.news.querySelector('.news-list');
    const g = this.game, me = g.s.player;
    const items = g.s.news.filter((n) => n.tags.includes(me) || n.important || n.type === 'world').slice(-40).reverse();
    mount(list, items.map((n) => h('div', { class: `news-item ${n.type}`, onclick: () => { if (n.pid !== null && n.pid !== undefined) { this.renderer.centerOn(n.pid, Math.max(this.renderer.cam.z, 3)); this.openProvince(n.pid); } } },
      h('span', { class: 'when' }, formatDate(n.day)), n.text)));
  }
  toast(text, type = 'info', ms = 4500, pid = null) {
    if (!this.el?.toasts) return;
    const t = h('div', { class: `toast ${type}`, onclick: () => { if (pid !== null && pid !== undefined) { this.renderer.centerOn(pid, Math.max(this.renderer.cam.z, 3)); this.openProvince(pid); } t.remove(); } }, text);
    this.el.toasts.appendChild(t);
    while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, ms);
  }
  checkPending() {
    const g = this.game;
    if (!g || this.modalOpen) return;
    const p = g.s.pending[0];
    if (!p) return;
    this.setSpeed(0);
    showPending(this, p);
  }

  // ------------------------------------------------------------------ girdi
  bindInput() {
    const cv = this.canvas;
    let down = null, moved = false, pinch = null;
    const pointers = new Map();
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
        down = null;
        return;
      }
      down = { x: e.clientX, y: e.clientY, button: e.button, shift: e.shiftKey, t: performance.now() };
      moved = false;
      if (e.button === 0 && e.shiftKey && this.mode === 'play') this.boxStart = { x: e.clientX, y: e.clientY };
    });
    cv.addEventListener('pointermove', (e) => {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        this.renderer.zoomAt(mx, my, d / pinch.d);
        this.renderer.panBy(mx - pinch.mx, my - pinch.my);
        pinch = { d, mx, my };
        return;
      }
      if (down) {
        const dx = e.clientX - down.x, dy = e.clientY - down.y;
        if (!moved && Math.hypot(dx, dy) > 5) moved = true;
        if (moved && this.boxStart) { this.drawBox(this.boxStart, { x: e.clientX, y: e.clientY }); return; }
        if (moved && (down.button === 0 || down.button === 1)) {
          this.dragging = true;
          cv.classList.add('panning');
          this.renderer.panBy(e.movementX || dx - (down.lx || 0), e.movementY || dy - (down.ly || 0));
          down.lx = dx; down.ly = dy;
          return;
        }
      }
      this.onHover(e.clientX, e.clientY);
    });
    const end = (e) => {
      pointers.delete(e.pointerId);
      if (pinch) { if (pointers.size < 2) pinch = null; return; }
      if (!down) return;
      cv.classList.remove('panning');
      this.dragging = false;
      if (this.boxStart) {
        if (moved) this.finishBox(this.boxStart, { x: e.clientX, y: e.clientY });
        this.boxStart = null;
        this.drawBox(null);
        down = null;
        return;
      }
      if (!moved) {
        if (down.button === 2) this.onRightClick(e.clientX, e.clientY);
        else if (down.button === 0) this.onClick(e.clientX, e.clientY, down.shift, e.pointerType === 'touch' && performance.now() - down.t > 550);
      }
      down = null;
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('pointerleave', () => { if (this.el?.tooltip) this.el.tooltip.hidden = true; this.renderer.hover = -1; this.renderer.dirty = true; });
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018));
      this.renderer.zoomAt(e.clientX, e.clientY, f);
    }, { passive: false });
    cv.addEventListener('dblclick', (e) => {
      if (this.mode !== 'play') return;
      const pid = this.renderer.pickProvince(e.clientX, e.clientY);
      if (pid < 0) return;
      const own = this.game.unitsAt(pid).filter((u) => u.o === this.game.s.player);
      if (own.length) this.selectUnits(own.map((u) => u.id), e.shiftKey);
    });
    this.ui.addEventListener('pointerdown', () => { this.pointerDownInUi = true; });
    window.addEventListener('pointerup', () => { this.pointerDownInUi = false; });
    window.addEventListener('keydown', (e) => this.onKey(e));
  }
  drawBox(a, b) {
    if (!this._box) { this._box = h('div', { style: { position: 'fixed', border: '1px dashed #ffd24a', background: 'rgba(255,210,74,0.08)', pointerEvents: 'none', zIndex: 30 } }); document.body.appendChild(this._box); }
    if (!a) { this._box.style.display = 'none'; return; }
    Object.assign(this._box.style, { display: 'block', left: `${Math.min(a.x, b.x)}px`, top: `${Math.min(a.y, b.y)}px`, width: `${Math.abs(a.x - b.x)}px`, height: `${Math.abs(a.y - b.y)}px` });
  }
  finishBox(a, b) {
    const g = this.game;
    const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
    const ids = [];
    for (const u of g.unitsOf(g.s.player)) {
      const p = this.world.provinces[u.p];
      const [sx, sy] = this.renderer.worldToScreen(p.label[0], p.label[1]);
      if (sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1) ids.push(u.id);
    }
    this.selectUnits(ids, true);
  }
  onHover(x, y) {
    if (!this.game) return;
    const pid = this.renderer.pickProvince(x, y);
    if (pid !== this.renderer.hover) { this.renderer.hover = pid; this.renderer.dirty = true; this.hoverChanged = performance.now(); }
    const tt = this.el?.tooltip;
    if (!tt) return;
    if (pid < 0) { tt.hidden = true; this.renderer.previewPath = null; return; }
    const g = this.game, P = g.s.prov, p = this.world.provinces[pid];
    const owner = g.C(P.owner[pid]), ctrl = g.C(P.ctrl[pid]);
    const units = g.unitsAt(pid);
    const byOwner = {};
    for (const u of units) byOwner[u.o] = (byOwner[u.o] || 0) + 1;
    const lines = [
      h('div', null, h('b', null, p.name), ' ', h('span', { class: 'muted' }, `· ${owner.short}`)),
      ctrl !== owner ? h('div', { class: 'red' }, `İşgalci: ${ctrl.name}`) : null,
      h('div', { class: 'muted' }, `${TERRAINS[p.terrain].name} · Nüfus ${fmtPeople2(P.pop[pid])} · GSYH ${fmtMoney(P.gdp[pid])}`),
      P.fort[pid] ? h('div', null, `🧱 Tahkimat ${P.fort[pid]}`) : null,
      Object.keys(byOwner).length ? h('div', null, '🪖 ', Object.entries(byOwner).map(([t, n]) => `${g.C(t).short}: ${n}`).join(', ')) : null,
    ];
    // Rota önizleme
    if (this.selectedUnits.size) {
      const first = g.unitById.get([...this.selectedUnits][0]);
      if (first && first.p !== pid) {
        if (this._prevKey !== `${first.p}>${pid}`) {
          this._prevKey = `${first.p}>${pid}`;
          const path = mil.findPath(g, g.s.player, first.p, pid);
          this._prevPath = path;
          this._prevDays = path ? Math.ceil(mil.pathDays(g, g.s.player, first.p, path) / (UNIT_TYPES[first.t].speed / 36)) : null;
        }
        this.renderer.previewPath = this._prevPath ? [first.p, ...this._prevPath] : null;
        this.renderer.dirty = true;
        lines.push(h('div', { class: this._prevPath ? 'gold' : 'red' }, this._prevPath ? `➜ Sağ tık: hareket (~${this._prevDays} gün)` : '✖ Ulaşılamaz'));
      }
    }
    mount(tt, lines);
    tt.hidden = false;
    const w = tt.offsetWidth, hh = tt.offsetHeight;
    tt.style.left = `${Math.min(window.innerWidth - w - 8, x + 16)}px`;
    tt.style.top = `${Math.min(window.innerHeight - hh - 8, y + 16)}px`;
  }
  onClick(x, y, shift, longPress) {
    if (this.mode === 'select') { this.selectHandler?.(this.renderer.pickProvince(x, y)); return; }
    if (this.mode !== 'play') return;
    const g = this.game;
    const hit = this.renderer.pickCounter(x, y);
    if (hit && hit.owner === g.s.player) {
      const ids = g.unitsAt(hit.pid).filter((u) => u.o === g.s.player).map((u) => u.id);
      this.selectUnits(ids, shift);
      return;
    }
    const pid = this.renderer.pickProvince(x, y);
    if (longPress && this.selectedUnits.size && pid >= 0) { this.orderSelectedTo(pid); return; }
    if (pid < 0) { this.closeRight(); this.clearUnitSelection(); return; }
    if (!shift) this.clearUnitSelection();
    if (hit) { this.openCountry(hit.owner); return; }
    this.openProvince(pid);
  }
  onRightClick(x, y) {
    if (this.mode !== 'play') return;
    const pid = this.renderer.pickProvince(x, y);
    if (pid < 0) return;
    if (this.selectedUnits.size) this.orderSelectedTo(pid);
  }
  onKey(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
    if (this.mode !== 'play' || !this.game) return;
    const k = e.key;
    if (k === ' ') { e.preventDefault(); if (!this.modalOpen) this.togglePause(); return; }
    if (k >= '1' && k <= '5') { this.setSpeed(Number(k)); return; }
    if (k === '+' || k === '=') { this.setSpeed(Math.min(5, this.speed + 1)); return; }
    if (k === '-') { this.setSpeed(Math.max(0, this.speed - 1)); return; }
    if (k === 'Escape') {
      if (this.modalOpen) return;
      if (this.selectedUnits.size) this.clearUnitSelection();
      else if (this.right) this.closeRight();
      else if (this.activeMenu) this.toggleMenu(this.activeMenu);
      else showMenuModal(this);
      return;
    }
    if (k === 'F1' || k === '?') { e.preventDefault(); showHelp(this); return; }
    if (k === 'Delete' && this.selectedUnits.size) return;
    const up = k.toUpperCase();
    const menu = MENUS.find((m) => m.key === up);
    if (menu && !e.ctrlKey && !e.metaKey) { this.toggleMenu(menu.id); return; }
    const mm = MAP_MODES.find((m) => m.key === up);
    if (mm && !e.ctrlKey && !e.metaKey) { this.setMapMode(mm.id); return; }
    const pan = 80;
    if (k === 'ArrowLeft') this.renderer.panBy(pan, 0);
    if (k === 'ArrowRight') this.renderer.panBy(-pan, 0);
    if (k === 'ArrowUp') this.renderer.panBy(0, pan);
    if (k === 'ArrowDown') this.renderer.panBy(0, -pan);
    if (k === 'Home' || k === 'h' || k === 'H') this.renderer.centerOnCountry(this.game.s.player);
  }
}

function fmtPeople2(n) {
  if (n >= 1e6) return `${fmt1(n / 1e6)} Mn`;
  if (n >= 1e3) return `${fmtInt(n / 1e3)} B`;
  return fmtInt(n);
}
function loadSettings() { try { return JSON.parse(localStorage.getItem('aod_settings') || '{}'); } catch { return {}; } }
export function saveSettings(s) { try { localStorage.setItem('aod_settings', JSON.stringify(s)); } catch { /* yoksay */ } }
