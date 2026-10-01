// Modern Dünya senaryosu — 1 Ocak 2026
// Değerler kamuya açık kaynaklardaki (IMF, SIPRI, IISS) 2025 tahminlerine yaklaşık değerlerdir.
//
// Alanlar:
//  n: Türkçe ad, s: harita etiketi (kısa ad), l: lider, lt: unvan, lw: Wikipedia başlığı (lider, farklıysa)
//  g: yönetim (dem, hyb, aut, com, mon, the, jun), b: blok (W batı, R Rusya, C Çin, I İran ekseni,
//     N bağlantısız, G Körfez, S Sahel, L ALBA)
//  pop: nüfus (milyon), gdp: GSYH (milyar $), gr: yıllık büyüme %, def: savunma harcaması (% GSYH)
//  act: aktif asker (bin), tk: tank, air: muharip uçak, nav: büyük savaş gemisi+denizaltı, nuk: nükleer başlık
//  tech: teknoloji kademesi (1-5), ind: sanayi çarpanı, col: harita rengi
//  en: İngilizce ad (bayrak/Wikipedia yedeği)

export const COUNTRY_DATA = {
  // ---------------- Kuzey Amerika ----------------
  USA: { n: 'Amerika Birleşik Devletleri', s: 'ABD', en: 'United States', l: 'Donald Trump', lt: 'Başkan', g: 'dem', b: 'W', pop: 341, gdp: 30500, gr: 2.0, def: 3.2, act: 1330, tk: 2640, air: 2700, nav: 290, nuk: 5044, tech: 5, ind: 0.8, col: '#3d6db5' },
  CAN: { n: 'Kanada', en: 'Canada', l: 'Mark Carney', lt: 'Başbakan', g: 'dem', b: 'W', pop: 41.5, gdp: 2230, gr: 1.2, def: 2.0, act: 68, tk: 80, air: 85, nav: 15, tech: 4, ind: 0.6, col: '#b5523b' },
  MEX: { n: 'Meksika', en: 'Mexico', l: 'Claudia Sheinbaum', lt: 'Devlet Başkanı', g: 'dem', b: 'N', pop: 132, gdp: 1860, gr: 0.6, def: 0.7, act: 280, tk: 0, air: 30, nav: 20, tech: 2, ind: 0.6, col: '#5c9a4a' },
  CUB: { n: 'Küba', en: 'Cuba', l: 'Miguel Díaz-Canel', lt: 'Devlet Başkanı', g: 'com', b: 'L', pop: 10.9, gdp: 48, gr: -1.0, def: 3.0, act: 49, tk: 300, air: 20, nav: 2, tech: 1, col: '#c0504d' },
  GTM: { n: 'Guatemala', en: 'Guatemala', l: 'Bernardo Arévalo', lt: 'Devlet Başkanı', g: 'dem', b: 'N', pop: 18.7, gdp: 115, gr: 3.5, def: 0.4, act: 18, air: 0, nav: 0, tech: 1 },
  HND: { n: 'Honduras', en: 'Honduras', l: 'Xiomara Castro', lt: 'Devlet Başkanı', g: 'hyb', b: 'N', pop: 10.9, gdp: 37, gr: 3.5, def: 1.5, act: 15, tech: 1 },
  SLV: { n: 'El Salvador', en: 'El Salvador', l: 'Nayib Bukele', lt: 'Devlet Başkanı', g: 'hyb', b: 'W', pop: 6.3, gdp: 37, gr: 2.7, def: 1.3, act: 25, tech: 1 },
  NIC: { n: 'Nikaragua', en: 'Nicaragua', l: 'Daniel Ortega', lt: 'Devlet Başkanı', g: 'aut', b: 'L', pop: 7.0, gdp: 20, gr: 3.5, def: 0.6, act: 12, tech: 1 },
  CRI: { n: 'Kosta Rika', en: 'Costa Rica', l: 'Rodrigo Chaves', lt: 'Devlet Başkanı', g: 'dem', b: 'W', pop: 5.2, gdp: 100, gr: 4.0, def: 0.0, act: 0, tech: 2 },
  PAN: { n: 'Panama', en: 'Panama', l: 'José Raúl Mulino', lt: 'Devlet Başkanı', g: 'dem', b: 'W', pop: 4.6, gdp: 90, gr: 3.5, def: 0.0, act: 0, tech: 2 },
  BLZ: { n: 'Belize', en: 'Belize', l: 'Johnny Briceño', lt: 'Başbakan', g: 'dem', b: 'W', pop: 0.42, gdp: 3.5, act: 1.5, tech: 1 },
  DOM: { n: 'Dominik Cumhuriyeti', s: 'Dominik C.', en: 'Dominican Republic', l: 'Luis Abinader', lt: 'Devlet Başkanı', g: 'dem', b: 'W', pop: 11.4, gdp: 130, gr: 4.5, def: 0.7, act: 56, tech: 2 },
  HTI: { n: 'Haiti', en: 'Haiti', l: 'Alix Didier Fils-Aimé', lt: 'Başbakan', g: 'hyb', b: 'N', pop: 11.9, gdp: 25, gr: -2.0, def: 0.1, act: 1, tech: 1 },
  JAM: { n: 'Jamaika', en: 'Jamaica', l: 'Andrew Holness', lt: 'Başbakan', g: 'dem', b: 'W', pop: 2.8, gdp: 22, act: 6, tech: 2 },
  BHS: { n: 'Bahamalar', en: 'The Bahamas', l: 'Philip Davis', lt: 'Başbakan', lw: 'Philip Davis (Bahamian politician)', g: 'dem', b: 'W', pop: 0.4, gdp: 15, act: 1.5, tech: 2 },
  TTO: { n: 'Trinidad ve Tobago', s: 'Trinidad', en: 'Trinidad and Tobago', l: 'Kamla Persad-Bissessar', lt: 'Başbakan', g: 'dem', b: 'W', pop: 1.5, gdp: 28, act: 4, tech: 2 },
  BRB: { n: 'Barbados', en: 'Barbados', l: 'Mia Mottley', lt: 'Başbakan', g: 'dem', b: 'N', pop: 0.28, gdp: 7, act: 0.6, tech: 2 },
  LCA: { n: 'Saint Lucia', en: 'Saint Lucia', l: 'Philip J. Pierre', lt: 'Başbakan', g: 'dem', b: 'N', pop: 0.18, gdp: 2.6, act: 0.1, tech: 1 },
  ATG: { n: 'Antigua ve Barbuda', s: 'Antigua', en: 'Antigua and Barbuda', l: 'Gaston Browne', lt: 'Başbakan', g: 'dem', b: 'N', pop: 0.09, gdp: 2.3, act: 0.2, tech: 1 },
  GRD: { n: 'Grenada', en: 'Grenada', l: 'Dickon Mitchell', lt: 'Başbakan', g: 'dem', b: 'N', pop: 0.12, gdp: 1.4, act: 0.1, tech: 1 },
  KNA: { n: 'Saint Kitts ve Nevis', s: 'St. Kitts', en: 'Saint Kitts and Nevis', l: 'Terrance Drew', lt: 'Başbakan', g: 'dem', b: 'N', pop: 0.05, gdp: 1.1, act: 0.1, tech: 1 },
  VCT: { n: 'Saint Vincent ve Grenadinler', s: 'St. Vincent', en: 'Saint Vincent and the Grenadines', l: 'Godwin Friday', lt: 'Başbakan', g: 'dem', b: 'N', pop: 0.1, gdp: 1.2, act: 0.1, tech: 1 },
  DMA: { n: 'Dominika', en: 'Dominica', l: 'Roosevelt Skerrit', lt: 'Başbakan', g: 'dem', b: 'N', pop: 0.07, gdp: 0.7, act: 0.1, tech: 1 },

  // ---------------- Güney Amerika ----------------
  BRA: { n: 'Brezilya', en: 'Brazil', l: 'Luiz Inácio Lula da Silva', lt: 'Devlet Başkanı', g: 'dem', b: 'N', pop: 213, gdp: 2130, gr: 2.2, def: 1.1, act: 366, tk: 300, air: 100, nav: 20, tech: 3, ind: 0.65, col: '#3f9b55' },
  ARG: { n: 'Arjantin', en: 'Argentina', l: 'Javier Milei', lt: 'Devlet Başkanı', g: 'dem', b: 'W', pop: 46, gdp: 680, gr: 4.5, def: 0.6, act: 75, tk: 230, air: 25, nav: 10, tech: 2, ind: 0.6, col: '#86b8de' },
  COL: { n: 'Kolombiya', en: 'Colombia', l: 'Gustavo Petro', lt: 'Devlet Başkanı', g: 'dem', b: 'N', pop: 53, gdp: 430, gr: 2.5, def: 3.0, act: 230, tk: 0, air: 40, nav: 10, tech: 2, col: '#d9b440' },
  VEN: { n: 'Venezuela', en: 'Venezuela', l: 'Nicolás Maduro', lt: 'Devlet Başkanı', g: 'aut', b: 'L', pop: 28.5, gdp: 85, gr: 1.0, def: 1.2, act: 125, tk: 170, air: 40, nav: 6, tech: 2, col: '#a05a6a' },
  PER: { n: 'Peru', en: 'Peru', l: 'José Jerí', lt: 'Devlet Başkanı', g: 'dem', b: 'N', pop: 34.5, gdp: 300, gr: 3.0, def: 1.1, act: 81, tk: 160, air: 40, nav: 12, tech: 2, col: '#c96a6a' },
  CHL: { n: 'Şili', en: 'Chile', l: 'Gabriel Boric', lt: 'Devlet Başkanı', g: 'dem', b: 'W', pop: 19.8, gdp: 345, gr: 2.5, def: 1.8, act: 69, tk: 250, air: 45, nav: 12, tech: 3, col: '#9e6ab0' },
  ECU: { n: 'Ekvador', en: 'Ecuador', l: 'Daniel Noboa', lt: 'Devlet Başkanı', g: 'dem', b: 'W', pop: 18, gdp: 130, gr: 1.5, def: 2.0, act: 40, tech: 2 },
  BOL: { n: 'Bolivya', en: 'Bolivia', l: 'Rodrigo Paz', lt: 'Devlet Başkanı', lw: 'Rodrigo Paz Pereira', g: 'dem', b: 'N', pop: 12.5, gdp: 55, gr: 1.0, def: 1.3, act: 34, tech: 1 },
  PRY: { n: 'Paraguay', en: 'Paraguay', l: 'Santiago Peña', lt: 'Devlet Başkanı', g: 'dem', b: 'W', pop: 6.9, gdp: 45, gr: 4.0, def: 1.0, act: 14, tech: 1 },
  URY: { n: 'Uruguay', en: 'Uruguay', l: 'Yamandú Orsi', lt: 'Devlet Başkanı', g: 'dem', b: 'N', pop: 3.4, gdp: 85, gr: 2.5, def: 2.0, act: 21, tech: 2 },
  GUY: { n: 'Guyana', en: 'Guyana', l: 'Irfaan Ali', lt: 'Devlet Başkanı', g: 'dem', b: 'W', pop: 0.83, gdp: 25, gr: 12.0, def: 1.0, act: 3.4, tech: 1 },
  SUR: { n: 'Surinam', en: 'Suriname', l: 'Jennifer Geerlings-Simons', lt: 'Devlet Başkanı', g: 'dem', b: 'N', pop: 0.64, gdp: 4, act: 1.8, tech: 1 },

  // ---------------- Batı Avrupa ----------------
  GBR: { n: 'Birleşik Krallık', s: 'Birleşik Krallık', en: 'United Kingdom', l: 'Keir Starmer', lt: 'Başbakan', g: 'dem', b: 'W', pop: 69, gdp: 3840, gr: 1.1, def: 2.4, act: 140, tk: 150, air: 160, nav: 35, nuk: 225, tech: 4, ind: 0.6, col: '#b5303c' },
  FRA: { n: 'Fransa', en: 'France', l: 'Emmanuel Macron', lt: 'Cumhurbaşkanı', g: 'dem', b: 'W', pop: 68, gdp: 3210, gr: 0.8, def: 2.1, act: 200, tk: 200, air: 220, nav: 50, nuk: 290, tech: 4, ind: 0.8, col: '#3e5ba9' },
  DEU: { n: 'Almanya', en: 'Germany', l: 'Friedrich Merz', lt: 'Şansölye', g: 'dem', b: 'W', pop: 84, gdp: 4750, gr: 0.4, def: 2.4, act: 182, tk: 300, air: 220, nav: 25, tech: 4, ind: 0.85, col: '#5f6266' },
  ITA: { n: 'İtalya', en: 'Italy', l: 'Giorgia Meloni', lt: 'Başbakan', g: 'dem', b: 'W', pop: 59, gdp: 2420, gr: 0.6, def: 1.6, act: 165, tk: 200, air: 220, nav: 40, tech: 4, ind: 0.7, col: '#4f9a5a' },
  ESP: { n: 'İspanya', en: 'Spain', l: 'Pedro Sánchez', lt: 'Başbakan', g: 'dem', b: 'W', pop: 48.5, gdp: 1800, gr: 2.5, def: 2.0, act: 120, tk: 330, air: 160, nav: 30, tech: 3, ind: 0.65, col: '#d8a23b' },
  PRT: { n: 'Portekiz', en: 'Portugal', l: 'Luís Montenegro', lt: 'Başbakan', g: 'dem', b: 'W', pop: 10.7, gdp: 320, gr: 1.9, def: 1.6, act: 27, tk: 40, air: 25, nav: 10, tech: 3, col: '#2f7f5f' },
  NLD: { n: 'Hollanda', en: 'Netherlands', l: 'Dick Schoof', lt: 'Başbakan', g: 'dem', b: 'W', pop: 18, gdp: 1270, gr: 1.4, def: 2.2, act: 40, tk: 18, air: 40, nav: 12, tech: 4, ind: 0.65, col: '#e07b39' },
  BEL: { n: 'Belçika', en: 'Belgium', l: 'Bart De Wever', lt: 'Başbakan', g: 'dem', b: 'W', pop: 11.8, gdp: 690, gr: 1.0, def: 2.0, act: 23, air: 40, nav: 2, tech: 3, col: '#c9a33c' },
  LUX: { n: 'Lüksemburg', en: 'Luxembourg', l: 'Luc Frieden', lt: 'Başbakan', g: 'dem', b: 'W', pop: 0.68, gdp: 95, act: 1, tech: 3 },
  IRL: { n: 'İrlanda', en: 'Ireland', l: 'Micheál Martin', lt: 'Başbakan', g: 'dem', b: 'W', pop: 5.4, gdp: 600, gr: 3.0, def: 0.3, act: 7.5, tech: 3, col: '#5aa86a' },
  CHE: { n: 'İsviçre', en: 'Switzerland', l: 'Guy Parmelin', lt: 'Konfederasyon Başkanı', g: 'dem', b: 'N', pop: 9.0, gdp: 1000, gr: 1.2, def: 0.7, act: 20, tk: 134, air: 30, nav: 0, tech: 4, ind: 0.6, col: '#c25454' },
  AUT: { n: 'Avusturya', en: 'Austria', l: 'Christian Stocker', lt: 'Şansölye', g: 'dem', b: 'W', pop: 9.2, gdp: 535, gr: 0.5, def: 1.0, act: 23, tk: 56, air: 15, tech: 3, col: '#d97a7a' },
  ISL: { n: 'İzlanda', en: 'Iceland', l: 'Kristrún Frostadóttir', lt: 'Başbakan', g: 'dem', b: 'W', pop: 0.39, gdp: 34, act: 0.3, tech: 3 },
  MLT: { n: 'Malta', en: 'Malta', l: 'Robert Abela', lt: 'Başbakan', g: 'dem', b: 'W', pop: 0.56, gdp: 25, act: 1.7, tech: 3 },
  MCO: { n: 'Monako', en: 'Monaco', l: 'II. Albert', lt: 'Prens', lw: 'Albert II, Prince of Monaco', g: 'mon', b: 'W', pop: 0.04, gdp: 9, act: 0.3, tech: 3 },
  LIE: { n: 'Lihtenştayn', en: 'Liechtenstein', l: 'II. Hans-Adam', lt: 'Prens', lw: 'Hans-Adam II', g: 'mon', b: 'W', pop: 0.04, gdp: 8, act: 0, tech: 3 },
  AND: { n: 'Andorra', en: 'Andorra', l: 'Xavier Espot Zamora', lt: 'Başbakan', g: 'dem', b: 'W', pop: 0.08, gdp: 4, act: 0, tech: 3 },
  SMR: { n: 'San Marino', en: 'San Marino', l: 'Kaptan Naipler', lt: 'Devlet Başkanlığı', lw: 'Captains Regent', g: 'dem', b: 'W', pop: 0.034, gdp: 2, act: 0.1, tech: 3 },
  VAT: { n: 'Vatikan', en: 'Vatican City', l: 'Papa XIV. Leo', lt: 'Papa', lw: 'Pope Leo XIV', g: 'the', b: 'N', pop: 0.0008, gdp: 0.02, act: 0.1, tech: 2 },

  // ---------------- Kuzey Avrupa ----------------
  SWE: { n: 'İsveç', en: 'Sweden', l: 'Ulf Kristersson', lt: 'Başbakan', g: 'dem', b: 'W', pop: 10.6, gdp: 620, gr: 1.2, def: 2.4, act: 25, tk: 110, air: 90, nav: 12, tech: 4, ind: 0.9, col: '#4a7fc1' },
  NOR: { n: 'Norveç', en: 'Norway', l: 'Jonas Gahr Støre', lt: 'Başbakan', g: 'dem', b: 'W', pop: 5.6, gdp: 500, gr: 1.5, def: 2.2, act: 25, tk: 36, air: 52, nav: 10, tech: 4, col: '#c07a4a' },
  DNK: { n: 'Danimarka', en: 'Denmark', l: 'Mette Frederiksen', lt: 'Başbakan', g: 'dem', b: 'W', pop: 6.0, gdp: 450, gr: 2.5, def: 2.8, act: 20, tk: 44, air: 30, nav: 9, tech: 4, col: '#a63d40' },
  FIN: { n: 'Finlandiya', en: 'Finland', l: 'Alexander Stubb', lt: 'Cumhurbaşkanı', g: 'dem', b: 'W', pop: 5.6, gdp: 310, gr: 0.8, def: 2.4, act: 24, tk: 200, air: 60, nav: 8, tech: 4, ind: 0.8, col: '#f0f0f0' },
  EST: { n: 'Estonya', en: 'Estonia', l: 'Kristen Michal', lt: 'Başbakan', g: 'dem', b: 'W', pop: 1.37, gdp: 45, gr: 1.0, def: 3.4, act: 7.7, tech: 3, col: '#5a8fc9' },
  LVA: { n: 'Letonya', en: 'Latvia', l: 'Evika Siliņa', lt: 'Başbakan', g: 'dem', b: 'W', pop: 1.85, gdp: 45, gr: 1.5, def: 3.4, act: 7, tech: 3, col: '#9a4a5a' },
  LTU: { n: 'Litvanya', en: 'Lithuania', l: 'Gitanas Nausėda', lt: 'Cumhurbaşkanı', g: 'dem', b: 'W', pop: 2.9, gdp: 85, gr: 2.5, def: 3.6, act: 23, tech: 3, col: '#c9b85a' },

  // ---------------- Orta ve Doğu Avrupa ----------------
  POL: { n: 'Polonya', en: 'Poland', l: 'Donald Tusk', lt: 'Başbakan', g: 'dem', b: 'W', pop: 37, gdp: 980, gr: 3.2, def: 4.5, act: 216, tk: 800, air: 100, nav: 6, tech: 3, ind: 1.0, col: '#c45a72' },
  CZE: { n: 'Çekya', en: 'Czech Republic', l: 'Andrej Babiš', lt: 'Başbakan', g: 'dem', b: 'W', pop: 10.9, gdp: 360, gr: 1.5, def: 2.1, act: 27, tk: 44, air: 14, tech: 3, col: '#5a9ec9' },
  SVK: { n: 'Slovakya', en: 'Slovakia', l: 'Robert Fico', lt: 'Başbakan', g: 'dem', b: 'W', pop: 5.4, gdp: 150, gr: 1.5, def: 2.0, act: 13, tk: 30, air: 10, tech: 3, col: '#7a6ab5' },
  HUN: { n: 'Macaristan', en: 'Hungary', l: 'Viktor Orbán', lt: 'Başbakan', g: 'hyb', b: 'W', pop: 9.5, gdp: 240, gr: 1.0, def: 2.1, act: 32, tk: 50, air: 14, tech: 3, col: '#5e8c4a' },
  ROU: { n: 'Romanya', en: 'Romania', l: 'Nicușor Dan', lt: 'Cumhurbaşkanı', g: 'dem', b: 'W', pop: 19, gdp: 420, gr: 1.5, def: 2.3, act: 70, tk: 400, air: 30, nav: 6, tech: 3, col: '#d6b53a' },
  BGR: { n: 'Bulgaristan', en: 'Bulgaria', l: 'Rumen Radev', lt: 'Cumhurbaşkanı', g: 'dem', b: 'W', pop: 6.4, gdp: 115, gr: 2.5, def: 2.2, act: 37, tk: 90, air: 15, nav: 4, tech: 2, col: '#4f8a5f' },
  GRC: { n: 'Yunanistan', en: 'Greece', l: 'Kyriakos Mitsotakis', lt: 'Başbakan', g: 'dem', b: 'W', pop: 10.3, gdp: 260, gr: 2.0, def: 3.0, act: 132, tk: 1300, air: 220, nav: 25, tech: 3, ind: 0.6, col: '#6aa6d9' },
  CYP: { n: 'Kıbrıs Rum Yönetimi', s: 'GKRY', en: 'Cyprus', l: 'Nikos Christodoulides', lt: 'Cumhurbaşkanı', g: 'dem', b: 'W', pop: 0.95, gdp: 38, gr: 3.0, def: 1.8, act: 12, tk: 80, tech: 2, col: '#d0a06a' },
  CYN: { n: 'Kuzey Kıbrıs Türk Cumhuriyeti', s: 'KKTC', en: 'Northern Cyprus', l: 'Tufan Erhürman', lt: 'Cumhurbaşkanı', g: 'dem', b: 'W', pop: 0.39, gdp: 5, gr: 3.0, def: 1.5, act: 3, tech: 2, col: '#d45a5a', flag: 'Flag_of_the_Turkish_Republic_of_Northern_Cyprus.svg' },
  SRB: { n: 'Sırbistan', en: 'Serbia', l: 'Aleksandar Vučić', lt: 'Cumhurbaşkanı', g: 'hyb', b: 'N', pop: 6.6, gdp: 95, gr: 3.0, def: 2.5, act: 28, tk: 230, air: 20, tech: 2, col: '#a65b5b' },
  HRV: { n: 'Hırvatistan', en: 'Croatia', l: 'Andrej Plenković', lt: 'Başbakan', g: 'dem', b: 'W', pop: 3.85, gdp: 95, gr: 3.0, def: 1.8, act: 15, tk: 30, air: 12, nav: 3, tech: 3, col: '#5a6fb5' },
  SVN: { n: 'Slovenya', en: 'Slovenia', l: 'Robert Golob', lt: 'Başbakan', g: 'dem', b: 'W', pop: 2.1, gdp: 75, gr: 2.0, def: 1.3, act: 7, tech: 3, col: '#6ab58a' },
  BIH: { n: 'Bosna-Hersek', en: 'Bosnia and Herzegovina', l: 'Denis Bećirović', lt: 'Devlet Başkanlığı Konseyi', g: 'hyb', b: 'N', pop: 3.1, gdp: 30, gr: 2.5, def: 0.8, act: 10, tech: 2, col: '#3f7fb0' },
  MNE: { n: 'Karadağ', en: 'Montenegro', l: 'Milojko Spajić', lt: 'Başbakan', g: 'dem', b: 'W', pop: 0.62, gdp: 9, act: 2, tech: 2 },
  ALB: { n: 'Arnavutluk', en: 'Albania', l: 'Edi Rama', lt: 'Başbakan', g: 'dem', b: 'W', pop: 2.7, gdp: 30, gr: 3.5, def: 2.0, act: 8, tech: 2, col: '#b04a4a' },
  MKD: { n: 'Kuzey Makedonya', s: 'K. Makedonya', en: 'North Macedonia', l: 'Hristijan Mickoski', lt: 'Başbakan', g: 'dem', b: 'W', pop: 1.8, gdp: 17, act: 8, tech: 2 },
  KOS: { n: 'Kosova', en: 'Kosovo', l: 'Albin Kurti', lt: 'Başbakan', g: 'dem', b: 'W', pop: 1.6, gdp: 11, act: 4, tech: 2, iso2: 'xk' },
  MDA: { n: 'Moldova', en: 'Moldova', l: 'Maia Sandu', lt: 'Cumhurbaşkanı', g: 'dem', b: 'W', pop: 2.4, gdp: 20, gr: 2.0, def: 0.6, act: 5, tech: 2, col: '#d1a85a' },
  UKR: { n: 'Ukrayna', en: 'Ukraine', l: 'Volodimir Zelenski', lt: 'Devlet Başkanı', lw: 'Volodymyr Zelenskyy', g: 'dem', b: 'W', pop: 33, gdp: 200, gr: 2.0, def: 28, act: 900, tk: 1000, air: 80, nav: 2, tech: 3, ind: 1.7, col: '#d9be3a' },
  BLR: { n: 'Belarus', en: 'Belarus', l: 'Aleksandr Lukaşenko', lt: 'Devlet Başkanı', lw: 'Alexander Lukashenko', g: 'aut', b: 'R', pop: 9.1, gdp: 75, gr: 2.5, def: 1.5, act: 48, tk: 500, air: 50, tech: 2, ind: 1.0, col: '#7a9a5a' },
  RUS: { n: 'Rusya Federasyonu', s: 'Rusya', en: 'Russia', l: 'Vladimir Putin', lt: 'Devlet Başkanı', g: 'aut', b: 'R', pop: 146, gdp: 2080, gr: 1.6, def: 6.5, act: 1320, tk: 2000, air: 1200, nav: 80, nuk: 5580, tech: 4, ind: 1.9, col: '#4e7d4a' },

  // ---------------- Türkiye, Kafkasya ve Orta Asya ----------------
  TUR: { n: 'Türkiye', en: 'Turkey', l: 'Recep Tayyip Erdoğan', lt: 'Cumhurbaşkanı', g: 'hyb', b: 'W', pop: 86, gdp: 1440, gr: 3.2, def: 2.2, act: 355, tk: 2200, air: 290, nav: 50, tech: 3, ind: 1.15, col: '#c8102e', wiki: 'Türkiye' },
  AZE: { n: 'Azerbaycan', en: 'Azerbaijan', l: 'İlham Aliyev', lt: 'Cumhurbaşkanı', lw: 'Ilham Aliyev', g: 'aut', b: 'N', pop: 10.2, gdp: 75, gr: 3.0, def: 5.0, act: 65, tk: 500, air: 25, nav: 2, tech: 2, ind: 0.8, col: '#3a8fb0' },
  ARM: { n: 'Ermenistan', en: 'Armenia', l: 'Nikol Paşinyan', lt: 'Başbakan', lw: 'Nikol Pashinyan', g: 'dem', b: 'N', pop: 3.0, gdp: 28, gr: 5.0, def: 5.5, act: 42, tk: 100, air: 10, tech: 2, col: '#d07a3a' },
  GEO: { n: 'Gürcistan', en: 'Georgia', l: 'İrakli Kobahidze', lt: 'Başbakan', lw: 'Irakli Kobakhidze', g: 'hyb', b: 'N', pop: 3.7, gdp: 35, gr: 7.0, def: 1.8, act: 20, tk: 120, tech: 2, col: '#b5555a' },
  KAZ: { n: 'Kazakistan', en: 'Kazakhstan', l: 'Kasım-Jomart Tokayev', lt: 'Cumhurbaşkanı', lw: 'Kassym-Jomart Tokayev', g: 'aut', b: 'R', pop: 20.5, gdp: 290, gr: 5.0, def: 1.0, act: 39, tk: 300, air: 100, nav: 2, tech: 2, ind: 0.7, col: '#4fb0b5' },
  UZB: { n: 'Özbekistan', en: 'Uzbekistan', l: 'Şevket Mirziyoyev', lt: 'Cumhurbaşkanı', lw: 'Shavkat Mirziyoyev', g: 'aut', b: 'N', pop: 37, gdp: 115, gr: 6.0, def: 3.0, act: 48, tk: 340, air: 40, tech: 2, col: '#5ab57a' },
  TKM: { n: 'Türkmenistan', en: 'Turkmenistan', l: 'Serdar Berdimuhamedov', lt: 'Devlet Başkanı', lw: 'Serdar Berdimuhamedow', g: 'aut', b: 'N', pop: 7.4, gdp: 80, gr: 6.0, def: 1.5, act: 37, tk: 650, air: 50, tech: 1, col: '#3fa07a' },
  KGZ: { n: 'Kırgızistan', en: 'Kyrgyzstan', l: 'Sadır Caparov', lt: 'Cumhurbaşkanı', lw: 'Sadyr Japarov', g: 'aut', b: 'R', pop: 7.2, gdp: 18, gr: 7.0, def: 1.5, act: 11, tk: 150, tech: 1, col: '#d46a5a' },
  TJK: { n: 'Tacikistan', en: 'Tajikistan', l: 'İmamali Rahman', lt: 'Cumhurbaşkanı', lw: 'Emomali Rahmon', g: 'aut', b: 'R', pop: 10.6, gdp: 15, gr: 8.0, def: 1.2, act: 9, tk: 40, tech: 1, col: '#a0b55a' },

  // ---------------- Orta Doğu ----------------
  ISR: { n: 'İsrail', en: 'Israel', l: 'Binyamin Netanyahu', lt: 'Başbakan', lw: 'Benjamin Netanyahu', g: 'dem', b: 'W', pop: 10, gdp: 610, gr: 1.5, def: 8.0, act: 170, tk: 1300, air: 340, nav: 20, nuk: 90, tech: 4, ind: 1.1, col: '#5c8fd6' },
  PSE: { n: 'Filistin', en: 'Palestine', l: 'Mahmud Abbas', lt: 'Devlet Başkanı', lw: 'Mahmoud Abbas', g: 'hyb', b: 'N', pop: 5.4, gdp: 13, gr: -10, def: 0, act: 5, tech: 1, iso2: 'ps', col: '#3d8f4a' },
  LBN: { n: 'Lübnan', en: 'Lebanon', l: 'Joseph Aoun', lt: 'Cumhurbaşkanı', g: 'hyb', b: 'N', pop: 5.8, gdp: 30, gr: 2.0, def: 3.0, act: 60, tk: 200, tech: 2, col: '#4fa05a' },
  SYR: { n: 'Suriye', en: 'Syria', l: 'Ahmed eş-Şara', lt: 'Cumhurbaşkanı', lw: 'Ahmed al-Sharaa', g: 'aut', b: 'N', pop: 25, gdp: 25, gr: 1.0, def: 3.0, act: 80, tk: 100, air: 0, nav: 0, tech: 1, col: '#8d6ea0' },
  JOR: { n: 'Ürdün', en: 'Jordan', l: 'II. Abdullah', lt: 'Kral', lw: 'Abdullah II of Jordan', g: 'mon', b: 'W', pop: 11.5, gdp: 55, gr: 2.5, def: 4.5, act: 100, tk: 300, air: 50, tech: 2, col: '#b59a6a' },
  IRQ: { n: 'Irak', en: 'Iraq', l: 'Muhammed Şiya es-Sudani', lt: 'Başbakan', lw: 'Mohammed Shia al-Sudani', g: 'hyb', b: 'N', pop: 46, gdp: 260, gr: 1.5, def: 2.5, act: 190, tk: 200, air: 40, nav: 2, tech: 2, col: '#7f8f4f' },
  IRN: { n: 'İran', en: 'Iran', l: 'Ali Hamaney', lt: 'Dini Lider', lw: 'Ali Khamenei', g: 'the', b: 'I', pop: 92, gdp: 400, gr: 0.5, def: 2.0, act: 610, tk: 1500, air: 150, nav: 25, tech: 3, ind: 1.3, col: '#55a06a' },
  SAU: { n: 'Suudi Arabistan', s: 'Suudi Arabistan', en: 'Saudi Arabia', l: 'Muhammed bin Selman', lt: 'Veliaht Prens ve Başbakan', lw: 'Mohammed bin Salman', g: 'mon', b: 'G', pop: 34, gdp: 1080, gr: 3.5, def: 7.0, act: 257, tk: 1000, air: 300, nav: 20, tech: 3, ind: 0.35, col: '#6f9e4a' },
  ARE: { n: 'Birleşik Arap Emirlikleri', s: 'BAE', en: 'United Arab Emirates', l: 'Muhammed bin Zayed', lt: 'Devlet Başkanı', lw: 'Mohamed bin Zayed Al Nahyan', g: 'mon', b: 'G', pop: 11, gdp: 570, gr: 4.5, def: 4.5, act: 63, tk: 340, air: 140, nav: 15, tech: 3, ind: 0.4, col: '#8a8a5a' },
  QAT: { n: 'Katar', en: 'Qatar', l: 'Temim bin Hamad Al Sani', lt: 'Emir', lw: 'Tamim bin Hamad Al Thani', g: 'mon', b: 'G', pop: 3.1, gdp: 220, gr: 2.5, def: 4.0, act: 16.5, tk: 60, air: 90, nav: 6, tech: 3, ind: 0.25, col: '#8a2a4a' },
  KWT: { n: 'Kuveyt', en: 'Kuwait', l: 'Meşal el-Ahmed el-Cabir es-Sabah', lt: 'Emir', lw: 'Mishal Al-Ahmad Al-Jaber Al-Sabah', g: 'mon', b: 'G', pop: 5.0, gdp: 160, gr: 2.0, def: 5.0, act: 17, tk: 290, air: 40, nav: 2, tech: 3, ind: 0.25, col: '#5a9a7a' },
  BHR: { n: 'Bahreyn', en: 'Bahrain', l: 'Hamad bin İsa Al Halife', lt: 'Kral', lw: 'Hamad bin Isa Al Khalifa', g: 'mon', b: 'G', pop: 1.6, gdp: 48, act: 8, air: 30, nav: 2, tech: 3, ind: 0.25 },
  OMN: { n: 'Umman', en: 'Oman', l: 'Heysem bin Tarık', lt: 'Sultan', lw: 'Haitham bin Tariq', g: 'mon', b: 'G', pop: 5.3, gdp: 105, gr: 2.5, def: 6.0, act: 42, tk: 117, air: 40, nav: 6, tech: 2, ind: 0.3, col: '#a85a4a' },
  YEM: { n: 'Yemen', en: 'Yemen', l: 'Raşad el-Alimi', lt: 'Başkanlık Konseyi Başkanı', lw: 'Rashad al-Alimi', g: 'hyb', b: 'N', pop: 41, gdp: 17, gr: -1.0, def: 5.0, act: 40, tk: 100, tech: 1, col: '#9a7a5a' },
  EGY: { n: 'Mısır', en: 'Egypt', l: 'Abdulfettah es-Sisi', lt: 'Cumhurbaşkanı', lw: 'Abdel Fattah el-Sisi', g: 'aut', b: 'N', pop: 118, gdp: 350, gr: 4.0, def: 1.2, act: 440, tk: 2700, air: 450, nav: 45, tech: 3, ind: 0.8, col: '#d8c07a' },

  // ---------------- Kuzey Afrika ----------------
  LBY: { n: 'Libya', en: 'Libya', l: 'Abdulhamid Dibeybe', lt: 'Başbakan', lw: 'Abdul Hamid Dbeibeh', g: 'hyb', b: 'N', pop: 7.4, gdp: 50, gr: 3.0, def: 3.0, act: 30, tk: 200, air: 15, tech: 1, col: '#5a8a6a' },
  TUN: { n: 'Tunus', en: 'Tunisia', l: 'Kays Said', lt: 'Cumhurbaşkanı', lw: 'Kais Saied', g: 'aut', b: 'N', pop: 12.3, gdp: 55, gr: 1.5, def: 2.0, act: 36, tk: 80, air: 15, nav: 4, tech: 2, col: '#c96a4a' },
  DZA: { n: 'Cezayir', en: 'Algeria', l: 'Abdulmecid Tebbun', lt: 'Cumhurbaşkanı', lw: 'Abdelmadjid Tebboune', g: 'aut', b: 'N', pop: 47, gdp: 270, gr: 3.5, def: 8.0, act: 140, tk: 1500, air: 200, nav: 20, tech: 2, ind: 0.6, col: '#3f8a5a' },
  MAR: { n: 'Fas', en: 'Morocco', l: 'VI. Muhammed', lt: 'Kral', lw: 'Mohammed VI of Morocco', g: 'mon', b: 'W', pop: 38, gdp: 165, gr: 3.5, def: 4.0, act: 195, tk: 900, air: 80, nav: 10, tech: 2, ind: 0.6, col: '#b5524a' },
  SDN: { n: 'Sudan', en: 'Sudan', l: 'Abdulfettah el-Burhan', lt: 'Egemenlik Konseyi Başkanı', lw: 'Abdel Fattah al-Burhan', g: 'jun', b: 'N', pop: 51, gdp: 35, gr: -5.0, def: 5.0, act: 100, tk: 200, air: 30, tech: 1, col: '#b58a5a' },
  SDS: { n: 'Güney Sudan', en: 'South Sudan', l: 'Salva Kiir', lt: 'Devlet Başkanı', lw: 'Salva Kiir Mayardit', g: 'aut', b: 'N', pop: 12, gdp: 5, gr: -2.0, def: 3.0, act: 50, tech: 1 },
  MRT: { n: 'Moritanya', en: 'Mauritania', l: 'Muhammed Veled Gazvani', lt: 'Cumhurbaşkanı', lw: 'Mohamed Ould Ghazouani', g: 'hyb', b: 'N', pop: 5.2, gdp: 11, act: 16, tech: 1 },

  // ---------------- Sahra Altı Afrika ----------------
  NGA: { n: 'Nijerya', en: 'Nigeria', l: 'Bola Tinubu', lt: 'Devlet Başkanı', g: 'hyb', b: 'N', pop: 233, gdp: 190, gr: 3.5, def: 0.6, act: 230, tk: 100, air: 40, nav: 10, tech: 2, ind: 0.5, col: '#4a9a5a' },
  ETH: { n: 'Etiyopya', en: 'Ethiopia', l: 'Abiy Ahmed', lt: 'Başbakan', g: 'aut', b: 'N', pop: 132, gdp: 125, gr: 7.0, def: 1.5, act: 160, tk: 300, air: 25, tech: 1, ind: 0.5, col: '#c9a54a' },
  KEN: { n: 'Kenya', en: 'Kenya', l: 'William Ruto', lt: 'Devlet Başkanı', g: 'dem', b: 'W', pop: 57, gdp: 130, gr: 5.0, def: 1.1, act: 24, tk: 70, air: 15, nav: 2, tech: 2, col: '#8a5a4a' },
  ZAF: { n: 'Güney Afrika', en: 'South Africa', l: 'Cyril Ramaphosa', lt: 'Devlet Başkanı', g: 'dem', b: 'N', pop: 64, gdp: 425, gr: 1.0, def: 0.7, act: 73, tk: 30, air: 25, nav: 7, tech: 3, ind: 0.6, col: '#5a8f6a' },
  COD: { n: 'Demokratik Kongo Cumhuriyeti', s: 'Kongo DC', en: 'Democratic Republic of the Congo', l: 'Félix Tshisekedi', lt: 'Devlet Başkanı', g: 'hyb', b: 'N', pop: 112, gdp: 75, gr: 5.0, def: 1.0, act: 135, tk: 100, tech: 1, col: '#5a7fb0' },
  AGO: { n: 'Angola', en: 'Angola', l: 'João Lourenço', lt: 'Devlet Başkanı', g: 'aut', b: 'N', pop: 39, gdp: 110, gr: 2.5, def: 1.5, act: 107, tk: 300, air: 30, tech: 2, col: '#b5524a' },
  TZA: { n: 'Tanzanya', en: 'Tanzania', l: 'Samia Suluhu Hassan', lt: 'Devlet Başkanı', g: 'hyb', b: 'N', pop: 70, gdp: 85, gr: 6.0, def: 1.0, act: 27, tk: 45, tech: 1, col: '#6aa0a0' },
  UGA: { n: 'Uganda', en: 'Uganda', l: 'Yoweri Museveni', lt: 'Devlet Başkanı', g: 'aut', b: 'N', pop: 51, gdp: 60, gr: 6.0, def: 2.0, act: 45, tk: 200, tech: 1, col: '#c9a07a' },
  GHA: { n: 'Gana', en: 'Ghana', l: 'John Mahama', lt: 'Devlet Başkanı', g: 'dem', b: 'N', pop: 35, gdp: 85, gr: 4.0, def: 0.4, act: 16, tech: 2 },
  CIV: { n: 'Fildişi Sahili', en: "Côte d'Ivoire", l: 'Alassane Ouattara', lt: 'Cumhurbaşkanı', g: 'hyb', b: 'W', pop: 32, gdp: 95, gr: 6.0, def: 1.0, act: 27, tech: 2 },
  SEN: { n: 'Senegal', en: 'Senegal', l: 'Bassirou Diomaye Faye', lt: 'Cumhurbaşkanı', g: 'dem', b: 'N', pop: 18.9, gdp: 35, gr: 8.0, def: 1.5, act: 19, tech: 1 },
  CMR: { n: 'Kamerun', en: 'Cameroon', l: 'Paul Biya', lt: 'Cumhurbaşkanı', g: 'aut', b: 'N', pop: 30, gdp: 55, gr: 4.0, def: 1.0, act: 40, tech: 1 },
  MLI: { n: 'Mali', en: 'Mali', l: 'Assimi Goïta', lt: 'Geçiş Dönemi Devlet Başkanı', g: 'jun', b: 'S', pop: 25, gdp: 25, gr: 4.0, def: 3.5, act: 40, tech: 1, col: '#8a6a3a' },
  BFA: { n: 'Burkina Faso', en: 'Burkina Faso', l: 'İbrahim Traoré', lt: 'Devlet Başkanı', lw: 'Ibrahim Traoré', g: 'jun', b: 'S', pop: 24, gdp: 23, gr: 4.0, def: 4.0, act: 40, tech: 1, col: '#a05a4a' },
  NER: { n: 'Nijer', en: 'Niger', l: 'Abdurrahman Çiyani', lt: 'Devlet Başkanı', lw: 'Abdourahamane Tchiani', g: 'jun', b: 'S', pop: 28, gdp: 21, gr: 6.0, def: 3.0, act: 33, tech: 1, col: '#c98a4a' },
  TCD: { n: 'Çad', en: 'Chad', l: 'Mahamat Déby', lt: 'Devlet Başkanı', lw: 'Mahamat Déby', g: 'aut', b: 'N', pop: 21, gdp: 20, gr: 3.0, def: 2.5, act: 33, tk: 60, tech: 1, col: '#c9b07a' },
  SOM: { n: 'Somali', en: 'Somalia', l: 'Hasan Şeyh Mahmud', lt: 'Cumhurbaşkanı', lw: 'Hassan Sheikh Mohamud', g: 'hyb', b: 'W', pop: 19.6, gdp: 13, gr: 3.5, def: 2.0, act: 30, tech: 1, col: '#5a9ad0' },
  ERI: { n: 'Eritre', en: 'Eritrea', l: 'İsaias Afeverki', lt: 'Devlet Başkanı', lw: 'Isaias Afwerki', g: 'aut', b: 'N', pop: 3.6, gdp: 3, act: 200, tk: 120, tech: 1 },
  DJI: { n: 'Cibuti', en: 'Djibouti', l: 'İsmail Ömer Guelleh', lt: 'Cumhurbaşkanı', lw: 'Ismaïl Omar Guelleh', g: 'aut', b: 'N', pop: 1.2, gdp: 4.5, act: 10, tech: 1 },
  RWA: { n: 'Ruanda', en: 'Rwanda', l: 'Paul Kagame', lt: 'Cumhurbaşkanı', g: 'aut', b: 'N', pop: 14.4, gdp: 14, gr: 7.0, def: 1.5, act: 33, tech: 2 },
  BDI: { n: 'Burundi', en: 'Burundi', l: 'Évariste Ndayishimiye', lt: 'Cumhurbaşkanı', g: 'aut', b: 'N', pop: 14, gdp: 3, act: 30, tech: 1 },
  MOZ: { n: 'Mozambik', en: 'Mozambique', l: 'Daniel Chapo', lt: 'Cumhurbaşkanı', g: 'hyb', b: 'N', pop: 35, gdp: 23, gr: 3.0, def: 1.0, act: 11, tech: 1 },
  ZMB: { n: 'Zambiya', en: 'Zambia', l: 'Hakainde Hichilema', lt: 'Cumhurbaşkanı', g: 'dem', b: 'N', pop: 21.5, gdp: 30, act: 15, tech: 1 },
  ZWE: { n: 'Zimbabve', en: 'Zimbabwe', l: 'Emmerson Mnangagwa', lt: 'Devlet Başkanı', g: 'aut', b: 'N', pop: 17, gdp: 45, act: 30, tk: 40, tech: 1 },
  MWI: { n: 'Malavi', en: 'Malawi', l: 'Peter Mutharika', lt: 'Devlet Başkanı', g: 'dem', b: 'N', pop: 22, gdp: 11, act: 11, tech: 1 },
  MDG: { n: 'Madagaskar', en: 'Madagascar', l: 'Michael Randrianirina', lt: 'Devlet Başkanı', g: 'jun', b: 'N', pop: 32, gdp: 18, act: 13, tech: 1 },
  BWA: { n: 'Botsvana', en: 'Botswana', l: 'Duma Boko', lt: 'Devlet Başkanı', g: 'dem', b: 'W', pop: 2.6, gdp: 20, act: 9, tech: 2 },
  NAM: { n: 'Namibya', en: 'Namibia', l: 'Netumbo Nandi-Ndaitwah', lt: 'Devlet Başkanı', g: 'dem', b: 'N', pop: 3.0, gdp: 13, act: 10, tech: 1 },
  GAB: { n: 'Gabon', en: 'Gabon', l: 'Brice Oligui Nguema', lt: 'Devlet Başkanı', g: 'jun', b: 'N', pop: 2.5, gdp: 21, act: 5, tech: 1 },
  COG: { n: 'Kongo Cumhuriyeti', s: 'Kongo', en: 'Republic of the Congo', l: 'Denis Sassou Nguesso', lt: 'Devlet Başkanı', g: 'aut', b: 'N', pop: 6.3, gdp: 15, act: 10, tech: 1 },
  CAF: { n: 'Orta Afrika Cumhuriyeti', s: 'Orta Afrika C.', en: 'Central African Republic', l: 'Faustin-Archange Touadéra', lt: 'Devlet Başkanı', g: 'aut', b: 'R', pop: 5.5, gdp: 3, act: 9, tech: 1 },
  GIN: { n: 'Gine', en: 'Guinea', l: 'Mamadi Dumbuya', lt: 'Devlet Başkanı', lw: 'Mamady Doumbouya', g: 'jun', b: 'N', pop: 15, gdp: 25, act: 10, tech: 1 },
  SLE: { n: 'Sierra Leone', en: 'Sierra Leone', l: 'Julius Maada Bio', lt: 'Devlet Başkanı', g: 'dem', b: 'N', pop: 8.9, gdp: 7, act: 8.5, tech: 1 },
  LBR: { n: 'Liberya', en: 'Liberia', l: 'Joseph Boakai', lt: 'Devlet Başkanı', g: 'dem', b: 'W', pop: 5.6, gdp: 5, act: 2, tech: 1 },
  TGO: { n: 'Togo', en: 'Togo', l: 'Faure Gnassingbé', lt: 'Bakanlar Kurulu Başkanı', g: 'aut', b: 'N', pop: 9.5, gdp: 11, act: 9, tech: 1 },
  BEN: { n: 'Benin', en: 'Benin', l: 'Patrice Talon', lt: 'Cumhurbaşkanı', g: 'hyb', b: 'N', pop: 14.8, gdp: 23, act: 12, tech: 1 },
  GMB: { n: 'Gambiya', en: 'The Gambia', l: 'Adama Barrow', lt: 'Devlet Başkanı', g: 'dem', b: 'N', pop: 2.8, gdp: 2.6, act: 2.5, tech: 1 },
  GNB: { n: 'Gine-Bissau', en: 'Guinea-Bissau', l: 'Horta N\'Tam', lt: 'Geçiş Dönemi Devlet Başkanı', lw: "Horta N'Tam", g: 'jun', b: 'N', pop: 2.2, gdp: 2.2, act: 4.5, tech: 1 },
  GNQ: { n: 'Ekvator Ginesi', en: 'Equatorial Guinea', l: 'Teodoro Obiang', lt: 'Devlet Başkanı', lw: 'Teodoro Obiang Nguema Mbasogo', g: 'aut', b: 'N', pop: 1.9, gdp: 13, act: 1.5, tech: 1 },
  LSO: { n: 'Lesotho', en: 'Lesotho', l: 'Sam Matekane', lt: 'Başbakan', g: 'dem', b: 'N', pop: 2.3, gdp: 2.3, act: 2, tech: 1 },
  SWZ: { n: 'Esvatini', en: 'Eswatini', l: 'III. Mswati', lt: 'Kral', lw: 'Mswati III', g: 'mon', b: 'W', pop: 1.25, gdp: 5, act: 3, tech: 1 },
  COM: { n: 'Komorlar', en: 'Comoros', l: 'Azali Assoumani', lt: 'Cumhurbaşkanı', g: 'aut', b: 'N', pop: 0.88, gdp: 1.5, act: 0.5, tech: 1 },
  CPV: { n: 'Yeşil Burun Adaları', s: 'Yeşil Burun', en: 'Cape Verde', l: 'Ulisses Correia e Silva', lt: 'Başbakan', g: 'dem', b: 'W', pop: 0.53, gdp: 3, act: 1, tech: 1 },
  STP: { n: 'São Tomé ve Príncipe', s: 'São Tomé', en: 'São Tomé and Príncipe', l: 'Carlos Vila Nova', lt: 'Cumhurbaşkanı', g: 'dem', b: 'N', pop: 0.23, gdp: 0.8, act: 0.3, tech: 1 },
  MUS: { n: 'Mauritius', en: 'Mauritius', l: 'Navin Ramgoolam', lt: 'Başbakan', g: 'dem', b: 'N', pop: 1.26, gdp: 16, act: 0, tech: 2 },
  SYC: { n: 'Seyşeller', en: 'Seychelles', l: 'Patrick Herminie', lt: 'Cumhurbaşkanı', g: 'dem', b: 'N', pop: 0.13, gdp: 2.2, act: 0.4, tech: 2 },

  // ---------------- Güney Asya ----------------
  IND: { n: 'Hindistan', en: 'India', l: 'Narendra Modi', lt: 'Başbakan', g: 'dem', b: 'N', pop: 1460, gdp: 4190, gr: 6.5, def: 2.3, act: 1475, tk: 3700, air: 600, nav: 70, nuk: 180, tech: 3, ind: 1.0, col: '#e0883a' },
  PAK: { n: 'Pakistan', en: 'Pakistan', l: 'Şahbaz Şerif', lt: 'Başbakan', lw: 'Shehbaz Sharif', g: 'hyb', b: 'C', pop: 255, gdp: 410, gr: 3.0, def: 2.7, act: 660, tk: 2500, air: 400, nav: 20, nuk: 170, tech: 3, ind: 1.0, col: '#2f6b3d' },
  BGD: { n: 'Bangladeş', en: 'Bangladesh', l: 'Muhammed Yunus', lt: 'Geçici Hükümet Başdanışmanı', lw: 'Muhammad Yunus', g: 'hyb', b: 'N', pop: 175, gdp: 470, gr: 4.5, def: 1.0, act: 165, tk: 320, air: 45, nav: 10, tech: 2, ind: 0.6, col: '#3f8a6a' },
  AFG: { n: 'Afganistan', en: 'Afghanistan', l: 'Hibetullah Ahundzade', lt: 'Yüce Lider', lw: 'Hibatullah Akhundzada', g: 'the', b: 'N', pop: 43, gdp: 17, gr: 2.5, def: 5.0, act: 170, tk: 50, tech: 1, col: '#7a7a6a' },
  NPL: { n: 'Nepal', en: 'Nepal', l: 'Sushila Karki', lt: 'Geçici Başbakan', g: 'dem', b: 'N', pop: 30, gdp: 45, gr: 4.0, def: 1.0, act: 95, tech: 1 },
  LKA: { n: 'Sri Lanka', en: 'Sri Lanka', l: 'Anura Kumara Dissanayake', lt: 'Devlet Başkanı', g: 'dem', b: 'N', pop: 22, gdp: 100, gr: 4.0, def: 1.5, act: 260, tech: 2 },
  BTN: { n: 'Butan', en: 'Bhutan', l: 'Tshering Tobgay', lt: 'Başbakan', g: 'mon', b: 'N', pop: 0.79, gdp: 3.4, act: 8, tech: 1 },
  MDV: { n: 'Maldivler', en: 'Maldives', l: 'Muhammed Muizzu', lt: 'Cumhurbaşkanı', lw: 'Mohamed Muizzu', g: 'hyb', b: 'N', pop: 0.53, gdp: 7, act: 4, tech: 1 },

  // ---------------- Doğu Asya ----------------
  CHN: { n: 'Çin Halk Cumhuriyeti', s: 'Çin', en: "People's Republic of China", l: 'Şi Cinping', lt: 'Devlet Başkanı', lw: 'Xi Jinping', g: 'com', b: 'C', pop: 1408, gdp: 19200, gr: 4.5, def: 1.7, act: 2035, tk: 5000, air: 2000, nav: 200, nuk: 600, tech: 4, ind: 1.45, col: '#c9a33a', wiki: 'Çin' },
  JPN: { n: 'Japonya', en: 'Japan', l: 'Sanae Takaiçi', lt: 'Başbakan', lw: 'Sanae Takaichi', g: 'dem', b: 'W', pop: 123, gdp: 4190, gr: 0.7, def: 1.8, act: 247, tk: 400, air: 330, nav: 70, tech: 4, ind: 0.85, col: '#e8dccb' },
  KOR: { n: 'Güney Kore', en: 'South Korea', l: 'Lee Jae-myung', lt: 'Devlet Başkanı', g: 'dem', b: 'W', pop: 51.7, gdp: 1790, gr: 1.0, def: 2.6, act: 500, tk: 2200, air: 410, nav: 50, tech: 4, ind: 1.25, col: '#6a8fca' },
  PRK: { n: 'Kuzey Kore', en: 'North Korea', l: 'Kim Jong-un', lt: 'Yüce Lider', lw: 'Kim Jong Un', g: 'com', b: 'R', pop: 26.5, gdp: 28, gr: 2.0, def: 25, act: 1280, tk: 4000, air: 400, nav: 70, nuk: 50, tech: 2, ind: 1.6, col: '#8b3a3a' },
  TWN: { n: 'Tayvan', en: 'Taiwan', l: 'William Lai', lt: 'Devlet Başkanı', lw: 'Lai Ching-te', g: 'dem', b: 'W', pop: 23.4, gdp: 885, gr: 3.5, def: 2.5, act: 170, tk: 1000, air: 400, nav: 30, tech: 4, ind: 1.0, col: '#3fa3a3', flag: 'Flag_of_the_Republic_of_China.svg' },
  MNG: { n: 'Moğolistan', en: 'Mongolia', l: 'Ukhnaagiin Khürelsükh', lt: 'Cumhurbaşkanı', g: 'dem', b: 'N', pop: 3.5, gdp: 24, gr: 5.0, def: 0.8, act: 10, tk: 400, tech: 1, col: '#5a8ad0' },

  // ---------------- Güneydoğu Asya ----------------
  IDN: { n: 'Endonezya', en: 'Indonesia', l: 'Prabowo Subianto', lt: 'Devlet Başkanı', g: 'dem', b: 'N', pop: 284, gdp: 1430, gr: 5.0, def: 0.8, act: 400, tk: 300, air: 100, nav: 40, tech: 2, ind: 0.7, col: '#b5524f' },
  PHL: { n: 'Filipinler', en: 'Philippines', l: 'Ferdinand Marcos Jr.', lt: 'Devlet Başkanı', lw: 'Bongbong Marcos', g: 'dem', b: 'W', pop: 116, gdp: 495, gr: 5.8, def: 1.4, act: 150, tk: 0, air: 25, nav: 10, tech: 2, col: '#5a7ac9' },
  VNM: { n: 'Vietnam', en: 'Vietnam', l: 'Tô Lâm', lt: 'Genel Sekreter', lw: 'Tô Lâm', g: 'com', b: 'N', pop: 101, gdp: 490, gr: 6.5, def: 2.3, act: 450, tk: 1300, air: 70, nav: 30, tech: 2, ind: 0.8, col: '#b0504a' },
  THA: { n: 'Tayland', en: 'Thailand', l: 'Anutin Charnvirakul', lt: 'Başbakan', g: 'hyb', b: 'W', pop: 72, gdp: 545, gr: 2.5, def: 1.3, act: 360, tk: 400, air: 120, nav: 25, tech: 2, ind: 0.7, col: '#7a5aa5' },
  MYS: { n: 'Malezya', en: 'Malaysia', l: 'Enver İbrahim', lt: 'Başbakan', lw: 'Anwar Ibrahim', g: 'dem', b: 'N', pop: 35.5, gdp: 470, gr: 4.5, def: 1.0, act: 113, tk: 48, air: 40, nav: 15, tech: 2, col: '#4a8fb5' },
  SGP: { n: 'Singapur', en: 'Singapore', l: 'Lawrence Wong', lt: 'Başbakan', g: 'hyb', b: 'W', pop: 6.0, gdp: 565, gr: 2.5, def: 3.0, act: 51, tk: 170, air: 100, nav: 12, tech: 4, ind: 0.6, col: '#c95a6a' },
  MMR: { n: 'Myanmar', en: 'Myanmar', l: 'Min Aung Hlaing', lt: 'Devlet Başkanı', g: 'jun', b: 'C', pop: 55, gdp: 65, gr: -1.0, def: 4.0, act: 150, tk: 200, air: 100, nav: 10, tech: 1, col: '#9aa05a' },
  KHM: { n: 'Kamboçya', en: 'Cambodia', l: 'Hun Manet', lt: 'Başbakan', g: 'aut', b: 'C', pop: 17.8, gdp: 50, gr: 6.0, def: 2.0, act: 124, tk: 200, tech: 1, col: '#4a6ab0' },
  LAO: { n: 'Laos', en: 'Laos', l: 'Thongloun Sisoulith', lt: 'Genel Sekreter', g: 'com', b: 'C', pop: 7.8, gdp: 16, act: 29, tech: 1 },
  BRN: { n: 'Brunei', en: 'Brunei', l: 'Hassanal Bolkiah', lt: 'Sultan', g: 'mon', b: 'N', pop: 0.46, gdp: 15, act: 7, tech: 2 },
  TLS: { n: 'Doğu Timor', en: 'East Timor', l: 'Xanana Gusmão', lt: 'Başbakan', g: 'dem', b: 'N', pop: 1.4, gdp: 2, act: 2, tech: 1 },

  // ---------------- Okyanusya ----------------
  AUS: { n: 'Avustralya', en: 'Australia', l: 'Anthony Albanese', lt: 'Başbakan', g: 'dem', b: 'W', pop: 27.5, gdp: 1770, gr: 1.8, def: 2.0, act: 60, tk: 75, air: 110, nav: 15, tech: 4, ind: 0.6, col: '#d08a4a' },
  NZL: { n: 'Yeni Zelanda', en: 'New Zealand', l: 'Christopher Luxon', lt: 'Başbakan', g: 'dem', b: 'W', pop: 5.3, gdp: 260, gr: 1.0, def: 1.3, act: 9, nav: 4, tech: 3, col: '#4a4a4a' },
  PNG: { n: 'Papua Yeni Gine', s: 'Papua Y.G.', en: 'Papua New Guinea', l: 'James Marape', lt: 'Başbakan', g: 'dem', b: 'W', pop: 10.6, gdp: 32, act: 3.6, tech: 1 },
  FJI: { n: 'Fiji', en: 'Fiji', l: 'Sitiveni Rabuka', lt: 'Başbakan', g: 'dem', b: 'W', pop: 0.93, gdp: 6, act: 4, tech: 1 },
  SLB: { n: 'Solomon Adaları', en: 'Solomon Islands', l: 'Jeremiah Manele', lt: 'Başbakan', g: 'dem', b: 'C', pop: 0.83, gdp: 1.7, act: 0, tech: 1 },
  VUT: { n: 'Vanuatu', en: 'Vanuatu', l: 'Jotham Napat', lt: 'Başbakan', g: 'dem', b: 'N', pop: 0.34, gdp: 1.2, act: 0.3, tech: 1 },
  WSM: { n: 'Samoa', en: 'Samoa', l: 'La\'auli Leuatea Schmidt', lt: 'Başbakan', g: 'dem', b: 'N', pop: 0.22, gdp: 1.0, act: 0, tech: 1 },
  TON: { n: 'Tonga', en: 'Tonga', l: 'Aisake Eke', lt: 'Başbakan', g: 'mon', b: 'N', pop: 0.1, gdp: 0.6, act: 0.6, tech: 1 },
  KIR: { n: 'Kiribati', en: 'Kiribati', l: 'Taneti Maamau', lt: 'Devlet Başkanı', g: 'dem', b: 'C', pop: 0.13, gdp: 0.3, act: 0, tech: 1 },
  FSM: { n: 'Mikronezya', en: 'Federated States of Micronesia', l: 'Wesley Simina', lt: 'Devlet Başkanı', g: 'dem', b: 'W', pop: 0.11, gdp: 0.5, act: 0, tech: 1 },
  MHL: { n: 'Marshall Adaları', en: 'Marshall Islands', l: 'Hilda Heine', lt: 'Devlet Başkanı', g: 'dem', b: 'W', pop: 0.04, gdp: 0.3, act: 0, tech: 1 },
  PLW: { n: 'Palau', en: 'Palau', l: 'Surangel Whipps Jr.', lt: 'Devlet Başkanı', g: 'dem', b: 'W', pop: 0.018, gdp: 0.3, act: 0, tech: 1 },
  NRU: { n: 'Nauru', en: 'Nauru', l: 'David Adeang', lt: 'Devlet Başkanı', g: 'dem', b: 'W', pop: 0.012, gdp: 0.2, act: 0, tech: 1 },
  TUV: { n: 'Tuvalu', en: 'Tuvalu', l: 'Feleti Teo', lt: 'Başbakan', g: 'dem', b: 'W', pop: 0.01, gdp: 0.07, act: 0, tech: 1 },
};

// Askeri ittifaklar ve kuruluşlar
export const FACTIONS = {
  NATO: {
    name: 'NATO', full: 'Kuzey Atlantik Antlaşması Örgütü', leader: 'USA', defensive: true, color: '#2c5aa0',
    members: ['USA', 'CAN', 'GBR', 'FRA', 'DEU', 'ITA', 'ESP', 'PRT', 'NLD', 'BEL', 'LUX', 'DNK', 'NOR', 'ISL', 'TUR', 'GRC', 'POL', 'CZE', 'SVK', 'HUN', 'ROU', 'BGR', 'HRV', 'SVN', 'ALB', 'MNE', 'MKD', 'EST', 'LVA', 'LTU', 'FIN', 'SWE'],
  },
  CSTO: {
    name: 'KGAÖ', full: 'Kolektif Güvenlik Antlaşması Örgütü', leader: 'RUS', defensive: true, color: '#8a2a2a',
    members: ['RUS', 'BLR', 'KAZ', 'KGZ', 'TJK'],
  },
  AES: {
    name: 'Sahel Devletleri İttifakı', full: 'Sahel Devletleri Konfederasyonu', leader: 'MLI', defensive: true, color: '#8a6a3a',
    members: ['MLI', 'BFA', 'NER'],
  },
};

// Siyasi/ekonomik kuruluşlar (ilişkileri etkiler)
export const BLOCS = {
  EU: { name: 'Avrupa Birliği', members: ['AUT', 'BEL', 'BGR', 'HRV', 'CYP', 'CZE', 'DNK', 'EST', 'FIN', 'FRA', 'DEU', 'GRC', 'HUN', 'IRL', 'ITA', 'LVA', 'LTU', 'LUX', 'MLT', 'NLD', 'POL', 'PRT', 'ROU', 'SVK', 'SVN', 'ESP', 'SWE'] },
  GCC: { name: 'Körfez İşbirliği Konseyi', members: ['SAU', 'ARE', 'QAT', 'KWT', 'BHR', 'OMN'] },
  BRICS: { name: 'BRICS', members: ['BRA', 'RUS', 'IND', 'CHN', 'ZAF', 'EGY', 'ETH', 'IRN', 'ARE', 'IDN'] },
  SCO: { name: 'Şanghay İşbirliği Örgütü', members: ['CHN', 'RUS', 'IND', 'PAK', 'IRN', 'KAZ', 'KGZ', 'TJK', 'UZB', 'BLR'] },
  OTS: { name: 'Türk Devletleri Teşkilatı', members: ['TUR', 'AZE', 'KAZ', 'UZB', 'KGZ'] },
  ASEAN: { name: 'ASEAN', members: ['IDN', 'PHL', 'VNM', 'THA', 'MYS', 'SGP', 'MMR', 'KHM', 'LAO', 'BRN', 'TLS'] },
  AU: { name: 'Afrika Birliği', members: [] },
};

// İkili savunma antlaşmaları (karşılıklı)
export const DEFENSE_PACTS = [
  ['USA', 'JPN'], ['USA', 'KOR'], ['USA', 'PHL'], ['USA', 'AUS'],
  ['CHN', 'PRK'], ['RUS', 'PRK'], ['TUR', 'AZE'], ['TUR', 'CYN'],
  ['FRA', 'GRC'], ['SAU', 'PAK'], ['AUS', 'NZL'], ['GRC', 'CYP'],
];
// Tek taraflı bağımsızlık garantileri [garantör, garanti edilen]
export const GUARANTEES = [
  ['USA', 'ISR'], ['USA', 'TWN'], ['GBR', 'UKR'], ['RUS', 'ARM'], ['TUR', 'QAT'], ['FRA', 'ARE'], ['IND', 'BTN'],
];

// Blok tabanlı başlangıç ilişkileri
export const BLOC_RELATIONS = {
  W: { W: 50, R: -50, C: -20, I: -60, N: 10, G: 30, S: -20, L: -40 },
  R: { R: 60, C: 50, I: 40, N: 10, G: 15, S: 40, L: 50 },
  C: { C: 60, I: 30, N: 15, G: 20, S: 20, L: 40 },
  I: { I: 60, N: 0, G: -20, S: 10, L: 30 },
  N: { N: 15, G: 15, S: 0, L: 5 },
  G: { G: 50, S: 0, L: 0 },
  S: { S: 80, L: 10 },
  L: { L: 70 },
};

// Özel ikili ilişkiler (-100..100)
export const RELATION_OVERRIDES = [
  ['RUS', 'UKR', -100], ['USA', 'RUS', -45], ['USA', 'CHN', -30], ['USA', 'IRN', -85], ['USA', 'PRK', -80],
  ['USA', 'VEN', -75], ['USA', 'CUB', -60], ['ISR', 'IRN', -95], ['SAU', 'IRN', -15], ['CHN', 'TWN', -85],
  ['KOR', 'PRK', -80], ['JPN', 'PRK', -70], ['JPN', 'CHN', -35], ['IND', 'PAK', -85], ['IND', 'CHN', -15],
  ['ARM', 'AZE', -30], ['TUR', 'GRC', -10], ['TUR', 'CYP', -60], ['TUR', 'CYN', 100], ['TUR', 'AZE', 100],
  ['TUR', 'ISR', -65], ['TUR', 'SYR', 60], ['TUR', 'QAT', 85], ['TUR', 'PAK', 80], ['TUR', 'ARM', -25],
  ['TUR', 'KAZ', 60], ['TUR', 'UZB', 60], ['TUR', 'KGZ', 55], ['TUR', 'TKM', 55], ['TUR', 'LBY', 50],
  ['TUR', 'SOM', 75], ['TUR', 'UKR', 45], ['TUR', 'RUS', 15], ['TUR', 'USA', 35], ['TUR', 'IRN', 5],
  ['TUR', 'BIH', 70], ['TUR', 'ALB', 55], ['TUR', 'KOS', 55], ['TUR', 'HUN', 50], ['TUR', 'IRQ', 25],
  ['GRC', 'CYP', 100], ['CYP', 'CYN', -70], ['GRC', 'CYN', -60], ['MAR', 'DZA', -70], ['ETH', 'ERI', -60],
  ['SRB', 'KOS', -80], ['VEN', 'GUY', -55], ['ISR', 'PSE', -90], ['ISR', 'LBN', -60], ['ISR', 'SYR', -30],
  ['SDN', 'ARE', -45], ['RUS', 'BLR', 100], ['RUS', 'PRK', 85], ['RUS', 'IRN', 55], ['CHN', 'PRK', 60],
  ['CHN', 'PAK', 85], ['CHN', 'RUS', 70], ['USA', 'ISR', 90], ['USA', 'GBR', 90], ['USA', 'JPN', 85],
  ['USA', 'KOR', 80], ['IND', 'RUS', 45], ['IND', 'USA', 25], ['AFG', 'PAK', -55], ['EGY', 'ETH', -40],
  ['RWA', 'COD', -60], ['SOM', 'ETH', -15], ['KAZ', 'RUS', 50], ['MLI', 'DZA', -35], ['RUS', 'POL', -75],
  ['RUS', 'EST', -70], ['RUS', 'LVA', -70], ['RUS', 'LTU', -70], ['RUS', 'FIN', -60], ['RUS', 'GBR', -70],
  ['BLR', 'POL', -55], ['BLR', 'LTU', -50], ['GEO', 'RUS', -35], ['MDA', 'RUS', -50], ['KOR', 'JPN', 25],
  ['PHL', 'CHN', -55], ['VNM', 'CHN', -20], ['UKR', 'BLR', -60], ['UKR', 'HUN', -20], ['IRN', 'SYR', -20],
  ['ISR', 'ARE', 35], ['ISR', 'EGY', 15], ['ISR', 'JOR', 10], ['THA', 'KHM', -45], ['AZE', 'IRN', -15],
  ['PAK', 'AFG', -55], ['DZA', 'FRA', -30], ['CHN', 'IND', -15], ['USA', 'MEX', 20], ['USA', 'CAN', 45],
  ['USA', 'DNK', 10], ['USA', 'COL', -10], ['QAT', 'ARE', 10], ['IRN', 'IRQ', 50], ['IRN', 'ARM', 40],
  ['FRA', 'MLI', -60], ['FRA', 'BFA', -55], ['FRA', 'NER', -55], ['RUS', 'MLI', 60], ['RUS', 'CAF', 70],
];

// Senaryo: başlangıçtaki savaşlar ve işgaller
export const SCENARIO = {
  startDate: { y: 2026, m: 1, d: 1 },
  wars: [
    {
      name: 'Rusya-Ukrayna Savaşı', attackers: ['RUS'], defenders: ['UKR'], startedYear: 2022,
      // Rus kontrolündeki Ukrayna illeri (sahibi Ukrayna)
      occupied: [{ by: 'RUS', provinceNames: ['Donetsk', "Luhans'k", 'Luhansk', 'Donetsk Oblastı', 'Luhansk Oblastı'] }],
    },
  ],
};
