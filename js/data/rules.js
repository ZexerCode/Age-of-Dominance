// Oyun kuralları: birimler, arazi, yasalar, teknolojiler, kararlar

// ---------------------------------------------------------------------------
// Kara birimleri (tümen)
//  atk: saldırı, def: savunma, hard: zırh oranı (0-1), ap: zırh delme (0-1)
//  speed: km/gün, org: azami moral/organizasyon, mp: insan gücü (bin)
//  cost: milyar $ (maliyet endeksiyle çarpılır), upkeep: milyar $/yıl, pp: üretim puanı
// ---------------------------------------------------------------------------
export const UNIT_TYPES = {
  infantry: { name: 'Piyade Tümeni', short: 'Piyade', icon: 'inf', atk: 12, def: 20, hard: 0.05, ap: 0.35, speed: 34, org: 60, mp: 15, cost: 1.0, upkeep: 0.45, pp: 450, cls: 'inf' },
  mechanized: { name: 'Mekanize Piyade Tümeni', short: 'Mekanize', icon: 'mech', atk: 20, def: 24, hard: 0.45, ap: 0.5, speed: 58, org: 60, mp: 14, cost: 2.4, upkeep: 0.9, pp: 900, cls: 'arm' },
  armor: { name: 'Zırhlı Tümen', short: 'Zırhlı', icon: 'arm', atk: 36, def: 20, hard: 0.8, ap: 0.9, speed: 54, org: 50, mp: 12, cost: 4.0, upkeep: 1.5, pp: 1300, cls: 'arm' },
  artillery: { name: 'Topçu ve Roket Tümeni', short: 'Topçu', icon: 'art', atk: 26, def: 10, hard: 0.15, ap: 0.3, speed: 30, org: 40, mp: 10, cost: 2.0, upkeep: 0.7, pp: 750, cls: 'art' },
  marines: { name: 'Deniz Piyade Tümeni', short: 'Deniz Pyd.', icon: 'mar', atk: 16, def: 18, hard: 0.1, ap: 0.4, speed: 34, org: 70, mp: 10, cost: 2.0, upkeep: 0.8, pp: 700, cls: 'inf', amphibious: true },
  special: { name: 'Özel Kuvvetler', short: 'Özel K.', icon: 'sof', atk: 22, def: 16, hard: 0.05, ap: 0.5, speed: 40, org: 80, mp: 5, cost: 2.2, upkeep: 1.0, pp: 650, cls: 'inf', terrainExpert: true },
  militia: { name: 'Milis / Yedek Tümen', short: 'Milis', icon: 'mil', atk: 6, def: 13, hard: 0, ap: 0.12, speed: 30, org: 40, mp: 12, cost: 0.3, upkeep: 0.12, pp: 160, cls: 'inf' },
};
export const UNIT_ORDER = ['infantry', 'mechanized', 'armor', 'artillery', 'marines', 'special', 'militia'];

// Hava, deniz ve stratejik üretim kalemleri
export const OTHER_PRODUCTION = {
  airwing: { name: 'Savaş Uçağı Filosu (12 uçak)', short: 'Hava Filosu', cost: 1.3, upkeep: 0.3, pp: 600, kind: 'air', amount: 1 },
  corvette: { name: 'Korvet', short: 'Korvet', cost: 0.4, upkeep: 0.03, pp: 500, kind: 'navy', amount: 1 },
  frigate: { name: 'Fırkateyn', short: 'Fırkateyn', cost: 0.9, upkeep: 0.06, pp: 900, kind: 'navy', amount: 2 },
  destroyer: { name: 'Muhrip', short: 'Muhrip', cost: 2.0, upkeep: 0.12, pp: 1400, kind: 'navy', amount: 3 },
  submarine: { name: 'Denizaltı', short: 'Denizaltı', cost: 1.6, upkeep: 0.1, pp: 1300, kind: 'navy', amount: 3 },
  carrier: { name: 'Uçak Gemisi', short: 'Uçak Gemisi', cost: 12, upkeep: 0.8, pp: 6000, kind: 'navy', amount: 12, req: 'nav4' },
  nuke: { name: 'Nükleer Savaş Başlığı', short: 'Nükleer Başlık', cost: 4, upkeep: 0.05, pp: 2200, kind: 'nuke', amount: 1, req: 'str3' },
  missiles: { name: 'Balistik Füze Stoku (10)', short: 'Füze Stoku', cost: 0.6, upkeep: 0, pp: 350, kind: 'missile', amount: 10, req: 'art3' },
  drones: { name: 'SİHA Filosu (24 adet)', short: 'SİHA Filosu', cost: 0.25, upkeep: 0.02, pp: 220, kind: 'drone', amount: 24, req: 'air3' },
};

// ---------------------------------------------------------------------------
// Arazi
// ---------------------------------------------------------------------------
export const TERRAINS = [
  { id: 'plains', name: 'Ova', atk: 1.0, armor: 1.1, def: 1.0, speed: 1.0, attrition: 0, color: '#b9c98f' },
  { id: 'forest', name: 'Orman', atk: 0.8, armor: 0.75, def: 1.1, speed: 0.8, attrition: 0, color: '#4e7a3a' },
  { id: 'hills', name: 'Tepelik', atk: 0.8, armor: 0.8, def: 1.15, speed: 0.8, attrition: 0, color: '#a98a62' },
  { id: 'mountain', name: 'Dağlık', atk: 0.55, armor: 0.5, def: 1.3, speed: 0.6, attrition: 0.002, color: '#7a6555' },
  { id: 'desert', name: 'Çöl', atk: 1.0, armor: 1.05, def: 0.95, speed: 0.9, attrition: 0.004, color: '#e3c27a' },
  { id: 'jungle', name: 'Tropik Orman', atk: 0.65, armor: 0.5, def: 1.2, speed: 0.6, attrition: 0.003, color: '#2f6a46' },
  { id: 'marsh', name: 'Bataklık', atk: 0.6, armor: 0.4, def: 1.15, speed: 0.6, attrition: 0.002, color: '#6f8f86' },
  { id: 'urban', name: 'Kentsel', atk: 0.6, armor: 0.6, def: 1.35, speed: 0.9, attrition: 0, color: '#9a9aa5' },
  { id: 'arctic', name: 'Kutup / Tundra', atk: 0.7, armor: 0.7, def: 1.1, speed: 0.6, attrition: 0.004, color: '#dfeaf0' },
];

// ---------------------------------------------------------------------------
// Yönetim biçimleri ve bloklar
// ---------------------------------------------------------------------------
export const GOVERNMENTS = {
  dem: { name: 'Demokrasi', stability: 62, aggression: 0.4, warDeclStab: -15 },
  hyb: { name: 'Hibrit Rejim', stability: 55, aggression: 0.8, warDeclStab: -8 },
  aut: { name: 'Otoriter Rejim', stability: 60, aggression: 1.2, warDeclStab: -5 },
  com: { name: 'Komünist Parti Devleti', stability: 66, aggression: 1.0, warDeclStab: -4 },
  mon: { name: 'Monarşi', stability: 68, aggression: 0.7, warDeclStab: -6 },
  the: { name: 'Teokrasi', stability: 55, aggression: 1.2, warDeclStab: -4 },
  jun: { name: 'Askeri Yönetim', stability: 45, aggression: 1.4, warDeclStab: -3 },
};
export const BLOC_NAMES = {
  W: 'Batı Bloku', R: 'Rusya Ekseni', C: 'Çin Ekseni', I: 'Direniş Ekseni', N: 'Bağlantısız', G: 'Körfez', S: 'Sahel İttifakı', L: 'ALBA (Bolivarcı)',
};

// ---------------------------------------------------------------------------
// Yasalar
// ---------------------------------------------------------------------------
export const CONSCRIPTION_LAWS = [
  { id: 'volunteer', name: 'Profesyonel Ordu', mp: 0.015, growth: 0, stability: 5, org: 0.05, desc: 'Küçük ama nitelikli ordu. Birlik organizasyonu +%5.' },
  { id: 'limited', name: 'Sınırlı Zorunlu Askerlik', mp: 0.03, growth: 0, stability: 0, org: 0, desc: 'Dengeli insan gücü havuzu.' },
  { id: 'conscription', name: 'Zorunlu Askerlik', mp: 0.05, growth: -0.2, stability: 0, org: 0, desc: 'Geniş insan gücü. Büyüme -0,2 puan.' },
  { id: 'mobilization', name: 'Kısmi Seferberlik', mp: 0.09, growth: -1.0, stability: -5, org: -0.03, reqWarSupport: 50, desc: 'Savaş ya da %50 savaş desteği gerekir. Büyüme -1 puan.' },
  { id: 'total', name: 'Genel Seferberlik', mp: 0.16, growth: -3.0, stability: -10, org: -0.08, reqWar: true, reqWarSupport: 70, desc: 'Savaşta ve %70 savaş desteğiyle. Büyüme -3 puan.' },
];

// ---------------------------------------------------------------------------
// Teknolojiler
// ---------------------------------------------------------------------------
export const TECH_BRANCHES = {
  land: { name: 'Kara Kuvvetleri', icon: '🪖' },
  armor: { name: 'Zırhlı Birlikler', icon: '🛡️' },
  artillery: { name: 'Topçu ve Füze', icon: '🚀' },
  air: { name: 'Hava Kuvvetleri', icon: '✈️' },
  naval: { name: 'Deniz Kuvvetleri', icon: '⚓' },
  industry: { name: 'Sanayi ve Ekonomi', icon: '🏭' },
  cyber: { name: 'Elektronik ve Siber', icon: '📡' },
  doctrine: { name: 'Askeri Doktrin', icon: '📜' },
  strategic: { name: 'Stratejik Sistemler', icon: '☢️' },
};
const LVL_COST = [0, 300, 520, 820, 1250, 1850, 2700];
const T = (branch, level, name, desc, effects) => ({ id: `${branch.slice(0, 3)}${level}`, branch, level, name, desc, effects, cost: LVL_COST[level] });
export const TECHS = [
  T('land', 1, 'Modern Piyade Teçhizatı', 'Piyade saldırı ve savunması +%10', { inf_atk: 0.1, inf_def: 0.1 }),
  T('land', 2, 'Gece Görüş Sistemleri', 'Piyade saldırısı +%10, organizasyon +%5', { inf_atk: 0.1, org: 0.05 }),
  T('land', 3, 'Tanksavar Güdümlü Füzeler', 'Piyade savunması +%15, zırh delme +0,2', { inf_def: 0.15, inf_ap: 0.2 }),
  T('land', 4, 'Ağ Merkezli Harp', 'Piyade saldırı/savunma +%10, organizasyon +%10', { inf_atk: 0.1, inf_def: 0.1, org: 0.1 }),
  T('land', 5, 'Gelecek Asker Sistemi', 'Piyade saldırısı +%15, savunması +%10', { inf_atk: 0.15, inf_def: 0.1 }),
  T('land', 6, 'Robotik Piyade Destek Sistemleri', 'Piyade saldırı/savunma +%15', { inf_atk: 0.15, inf_def: 0.15 }),

  T('armor', 1, '3. Nesil Ana Muharebe Tankı', 'Zırhlı saldırı +%10', { arm_atk: 0.1 }),
  T('armor', 2, 'Reaktif Zırh', 'Zırhlı savunma +%15', { arm_def: 0.15 }),
  T('armor', 3, 'Gelişmiş Atış Kontrol Sistemi', 'Zırhlı saldırı +%15', { arm_atk: 0.15 }),
  T('armor', 4, 'Aktif Koruma Sistemi', 'Zırhlı savunma +%20, saldırı +%5', { arm_def: 0.2, arm_atk: 0.05 }),
  T('armor', 5, '4. Nesil Ana Muharebe Tankı', 'Zırhlı saldırı +%20, savunma +%10', { arm_atk: 0.2, arm_def: 0.1 }),
  T('armor', 6, 'İnsansız Kara Araçları', 'Zırhlı saldırı/savunma +%15', { arm_atk: 0.15, arm_def: 0.15 }),

  T('artillery', 1, 'Kundağı Motorlu Obüs', 'Topçu saldırısı +%15', { art_atk: 0.15 }),
  T('artillery', 2, 'Çok Namlulu Roketatar', 'Topçu saldırısı +%20', { art_atk: 0.2 }),
  T('artillery', 3, 'Hassas Güdümlü Mühimmat', 'Topçu +%20, füze saldırısı açılır (600 km)', { art_atk: 0.2, missile_range: 600 }),
  T('artillery', 4, 'Taktik Balistik Füzeler', 'Füze menzili 1500 km, füze gücü +%50', { missile_range: 1500, missile_power: 0.5 }),
  T('artillery', 5, 'Seyir Füzeleri', 'Füze menzili 3000 km, füze gücü +%50', { missile_range: 3000, missile_power: 0.5 }),
  T('artillery', 6, 'Hipersonik Füzeler', 'Füze menzili 6000 km, gücü +%100, savunmayı aşar', { missile_range: 6000, missile_power: 1.0, missile_pen: 0.5 }),

  T('air', 1, '4. Nesil Savaş Uçağı', 'Hava gücü +%15', { air_power: 0.15 }),
  T('air', 2, '4,5. Nesil Savaş Uçağı', 'Hava gücü +%20', { air_power: 0.2 }),
  T('air', 3, 'Silahlı İnsansız Hava Aracı (SİHA)', 'SİHA saldırıları açılır, hava gücü +%10', { air_power: 0.1, drone: 1 }),
  T('air', 4, '5. Nesil Gizli Savaş Uçağı', 'Hava gücü +%35', { air_power: 0.35 }),
  T('air', 5, 'Sürü İHA Teknolojisi', 'SİHA etkinliği +%100, hava gücü +%10', { air_power: 0.1, drone_power: 1.0 }),
  T('air', 6, '6. Nesil Hava Hakimiyeti', 'Hava gücü +%40', { air_power: 0.4 }),

  T('naval', 1, 'Modern Fırkateyn', 'Deniz gücü +%15', { naval_power: 0.15 }),
  T('naval', 2, 'Hava Savunma Destroyeri', 'Deniz gücü +%20', { naval_power: 0.2 }),
  T('naval', 3, 'Nükleer Taarruz Denizaltısı', 'Deniz gücü +%25', { naval_power: 0.25 }),
  T('naval', 4, 'Uçak Gemisi Görev Grubu', 'Deniz gücü +%30, çıkarma harekâtı +%25, uçak gemisi üretimi', { naval_power: 0.3, amphib: 0.25 }),
  T('naval', 5, 'İnsansız Deniz Araçları', 'Deniz gücü +%20', { naval_power: 0.2 }),

  T('industry', 1, 'Endüstriyel Otomasyon', 'Üretim +%10', { pp: 0.1 }),
  T('industry', 2, 'Endüstri 4.0', 'Üretim +%10, büyüme +0,2', { pp: 0.1, growth: 0.2 }),
  T('industry', 3, 'Yarı İletken Üretimi', 'Üretim +%10, araştırma +%10', { pp: 0.1, research: 0.1 }),
  T('industry', 4, 'Yapay Zekâ Destekli Üretim', 'Üretim +%15, büyüme +0,3', { pp: 0.15, growth: 0.3 }),
  T('industry', 5, 'Nanoteknoloji', 'Üretim +%15, araştırma +%10', { pp: 0.15, research: 0.1 }),
  T('industry', 6, 'Kuantum Bilişim', 'Araştırma +%25, büyüme +0,3', { research: 0.25, growth: 0.3 }),

  T('cyber', 1, 'Elektronik Harp', 'Muharebe etkinliği +%5', { combat: 0.05 }),
  T('cyber', 2, 'Siber Savunma', 'Siber saldırılara direnç', { cyber_def: 0.5 }),
  T('cyber', 3, 'Siber Saldırı Kabiliyeti', 'Siber saldırı operasyonu açılır', { cyber: 1 }),
  T('cyber', 4, 'Askeri Uydu Ağı', 'Muharebe +%5, hareket hızı +%5', { combat: 0.05, speed: 0.05 }),
  T('cyber', 5, 'Yapay Zekâ Komuta Sistemleri', 'Muharebe +%10, organizasyon +%10', { combat: 0.1, org: 0.1 }),

  T('doctrine', 1, 'Manevra Harbi', 'Hareket hızı +%10, toparlanma +%10', { speed: 0.1, recovery: 0.1 }),
  T('doctrine', 2, 'Derinlemesine Savunma', 'Mevzilenme +%25', { entrench: 0.25 }),
  T('doctrine', 3, 'Hibrit Harp', 'Muharebe +%5, toparlanma +%15', { combat: 0.05, recovery: 0.15 }),
  T('doctrine', 4, 'Müşterek Harekât', 'Muharebe +%10, hava desteği +%20', { combat: 0.1, air_support: 0.2 }),
  T('doctrine', 5, 'Çok Alanlı Harekât', 'Muharebe +%10, organizasyon +%10', { combat: 0.1, org: 0.1 }),

  T('strategic', 1, 'Nükleer Enerji', 'Ekonomik büyüme +0,3', { growth: 0.3 }),
  T('strategic', 2, 'Balistik Füze Savunması', 'Füze ve nükleer önleme +%15', { missile_def: 0.15 }),
  T('strategic', 3, 'Nükleer Silah Programı', 'Nükleer savaş başlığı üretimi. Batı ile ilişkiler kötüleşir!', { nuke_program: 1 }),
  T('strategic', 4, 'Katmanlı Füze Kalkanı', 'Füze ve nükleer önleme +%20', { missile_def: 0.2 }),
  T('strategic', 5, 'Uzay Tabanlı Erken Uyarı', 'Füze ve nükleer önleme +%15', { missile_def: 0.15 }),
];
export const TECH_BY_ID = Object.fromEntries(TECHS.map((t) => [t.id, t]));

// Başlangıç teknoloji seviyeleri (kademe → dal seviyesi)
export const TIER_LEVELS = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4 };
// Özel başlangıç teknolojileri (dal: seviye)
export const TECH_OVERRIDES = {
  TUR: { air: 3, artillery: 4, naval: 2, cyber: 2, industry: 2 },
  USA: { air: 5, naval: 5, strategic: 5, artillery: 5, cyber: 5 },
  RUS: { artillery: 5, strategic: 4, air: 3, cyber: 3 },
  CHN: { artillery: 5, strategic: 4, air: 4, naval: 4, cyber: 4, industry: 4 },
  ISR: { air: 4, artillery: 4, strategic: 4, cyber: 4, land: 4 },
  IRN: { air: 3, artillery: 4, cyber: 3, strategic: 2 },
  UKR: { air: 3, artillery: 3, doctrine: 3, land: 3 },
  PRK: { artillery: 4, strategic: 3, cyber: 3 },
  PAK: { artillery: 4, strategic: 3 },
  IND: { artillery: 4, strategic: 3, naval: 3 },
  FRA: { strategic: 4, naval: 4, artillery: 4 },
  GBR: { strategic: 4, naval: 4, artillery: 4 },
  KOR: { artillery: 4, industry: 4, armor: 4 },
  JPN: { industry: 4, naval: 4 },
  DEU: { armor: 4, industry: 4 },
  TWN: { industry: 5, artillery: 3 },
  SAU: { artillery: 3, air: 3 },
  ARE: { air: 3 },
  AZE: { air: 3 },
  POL: { armor: 3, artillery: 3 },
  GRC: { air: 3 },
};

// ---------------------------------------------------------------------------
// Ulusal kararlar
//  cost: GSYH'nin oranı (milyar $ = gdp * cost), cooldown: gün
// ---------------------------------------------------------------------------
export const DECISIONS = [
  { id: 'defense_industry', name: 'Yerli Savunma Sanayii Hamlesi', desc: '120 gün sonra +2 askeri fabrika.', cost: 0.0025, cooldown: 365, icon: '🏭' },
  { id: 'stimulus', name: 'Ekonomik Teşvik Paketi', desc: '1 yıl boyunca büyüme +1,2 puan.', cost: 0.004, cooldown: 365, icon: '📈' },
  { id: 'propaganda', name: 'Propaganda Kampanyası', desc: 'Savaş desteği +12.', cost: 0.0004, cooldown: 120, icon: '📣' },
  { id: 'national_unity', name: 'Ulusal Birlik Çağrısı', desc: 'İstikrar +10, savaş desteği -3.', cost: 0.0008, cooldown: 180, icon: '🤝' },
  { id: 'austerity', name: 'Kemer Sıkma Programı', desc: 'Hazineye GSYH’nin %0,6’sı kadar gelir, istikrar -8, 1 yıl büyüme -0,5.', cost: 0, cooldown: 365, icon: '✂️' },
  { id: 'reserves', name: 'Yedekleri Silah Altına Çağır', desc: 'Savaşta: başkent çevresinde hemen 3 yedek tümen kurulur.', cost: 0.0006, cooldown: 120, reqWar: true, icon: '🎖️' },
  { id: 'fortify', name: 'Sınır Tahkimatı', desc: 'Düşman sınırındaki illerde tahkimat +1 (en fazla 5).', cost: 0.0012, cooldown: 120, icon: '🧱' },
  { id: 'intl_aid', name: 'Uluslararası Yardım Çağrısı', desc: 'Savaşta: dost ülkelerden askeri ve mali yardım iste.', cost: 0, cooldown: 90, reqWar: true, icon: '🆘' },
  { id: 'arms_import', name: 'Acil Silah İthalatı', desc: 'Dost ülkelerden 2 zırhlı tümenlik teçhizat satın al (60 günde teslim).', cost: 0.003, cooldown: 180, icon: '📦' },
];

export const DIFFICULTIES = {
  easy: { name: 'Kolay', playerIncome: 1.25, playerCombat: 1.15, aiAggression: 0.6 },
  normal: { name: 'Normal', playerIncome: 1.0, playerCombat: 1.0, aiAggression: 1.0 },
  hard: { name: 'Zor', playerIncome: 0.85, playerCombat: 0.92, aiAggression: 1.4 },
};
