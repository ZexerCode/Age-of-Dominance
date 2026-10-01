# Age of Dominance — Modern Dünya

Tarayıcıda çalışan, **Hearts of Iron** ve **Age of History** tarzında bir büyük strateji oyunu. 1 Ocak 2026 tarihli gerçekçi bir dünya senaryosunda bir ülkeyi seçip ekonomisini, ordusunu, diplomasisini ve savaşlarını yönetirsiniz.

Hiçbir kurulum ya da derleme adımı gerektirmez: saf JavaScript (ES modülleri) + Canvas 2D.

## Öne çıkanlar

- **2.739 il, 198 ülke** — Natural Earth verisinden üretilmiş il/eyalet düzeyinde dünya haritası. Türkiye'nin 81 ili, ABD eyaletleri, Rusya oblastları, Almanya eyaletleri… Sibirya, Alaska, Sahra gibi devasa bölgeler şehir adlı alt bölgelere ayrılmıştır.
- **Gerçekçi 2026 senaryosu** — güncel liderler, GSYH, nüfus, aktif asker, tank, uçak, donanma ve nükleer başlık sayıları (IMF / SIPRI / IISS tahminleri); NATO, KGAÖ, AB, ŞİÖ, BRICS, Türk Devletleri Teşkilatı; ikili savunma paktları ve garantiler; süren **Rusya–Ukrayna savaşı** (Donetsk/Luhansk işgal altında, cephe tahkimatlı).
- **Muharebe sistemi** — saldırı/savunma, zırh–zırh delme, arazi, tahkimat, mevzilenme, hava üstünlüğü, teknoloji, tecrübe, ikmal; **muharebe genişliği**, çok yönlü saldırı bonusu, yerel garnizon direnci, kuşatma ve teslim olma, deniz yoluyla çıkarma.
- **7 kara birliği türü** (piyade, mekanize, zırhlı, topçu, deniz piyadesi, özel kuvvetler, milis) + savaş uçağı filoları, korvetten uçak gemisine donanma, **balistik füze, SİHA ve nükleer saldırılar** (misilleme ve nükleer kış dahil).
- **Ekonomi** — GSYH büyümesi, savunma bütçesi kaydırıcısı, Ar-Ge payı, askeri fabrikalar, insan gücü ve askerlik yasaları, yaptırımlar, borç ve faiz, il bazlı inşaat (fabrika, tahkimat, altyapı).
- **50 teknoloji**, 9 dal (Kara, Zırh, Topçu ve Füze, Hava, Deniz, Sanayi, Siber, Doktrin, Stratejik).
- **Diplomasi** — ilişkiler, ittifak, saldırmazlık paktı, geçiş izni, bağımsızlık garantisi, yaptırım, yardım, savaş gerekçesi, ittifak kurma/katılma, beyaz barış / toprak talebi / barış konferansı (ilhak ya da kukla devlet).
- **Yaşayan dünya** — yapay zekâ ülkeleri cephe kurar, taarruz planlar, üretim ve araştırma yapar, yedeklerini seferber eder, müttefiklerine silah ve para yardımı gönderir. Tayvan Boğazı, Keşmir, İsrail–İran, Kore, Esequibo, Afrika Boynuzu, Baltık gibi kriz senaryoları; seçimler (Macaristan, Brezilya, İsrail, ABD ara seçimleri…), depremler, ekonomik krizler, darbeler, protestolar; NATO Ankara Zirvesi, COP31 Antalya, 2026 Dünya Kupası gibi tarihli haberler.
- **Wikipedia entegrasyonu** — ülke özetleri (Türkçe), lider portreleri ve il fotoğrafları çalışırken Wikipedia/Wikimedia'dan çekilir; bayraklar flagcdn (Wikimedia kaynaklı) üzerinden.
- **8 harita modu** (Siyasi, Arazi, İttifaklar, Diplomasi, Ekonomi, Nüfus, Sanayi, Cephe ve İkmal), işgal şeritleri, kırmızı cephe hatları, ülke adları ana eksen boyunca yazılır, dünya yatay olarak sarar.
- Kayıt/yükleme (3 yuva + otomatik kayıt + dosyaya aktarma), zorluk seviyeleri, yapay zekâ saldırganlığı, ordu/üretim/araştırmayı yapay zekâya devretme.

## Oynamak

### Yerelde çalıştırma

```bash
npm start            # http://localhost:8080
# ya da
python3 -m http.server 8080
```

> `index.html` dosyasını doğrudan açmak (`file://`) çalışmaz; ES modülleri ve harita verisi için bir HTTP sunucusu gerekir.

### GitHub Pages ile yayınlama

1. Depoda **Settings → Pages → Build and deployment → Source: GitHub Actions** seçin.
2. `main` dalına gönderilen her değişiklik `.github/workflows/pages.yml` ile otomatik yayınlanır (önce testler çalışır).
3. Oyun `https://<kullanıcı>.github.io/<depo>/` adresinde açılır.

### Kontroller

| Girdi | İşlev |
|---|---|
| Sol tık | İl / birlik seç (birlik sayacına tıklamak o ildeki birliklerinizi seçer) |
| Sağ tık | Seçili birlikleri gönder (düşman iline göndermek saldırıdır) |
| Sürükle · tekerlek | Haritayı kaydır · yakınlaştır (dokunmatik: iki parmak) |
| Shift + sürükle | Kutu ile birlik seçimi |
| Çift tık | İldeki tüm birliklerinizi seç |
| Boşluk · 1–5 | Duraklat · oyun hızı |
| O A P K D S L N | Ordu, Araştırma, Politika, Kararlar, Diplomasi, Savaşlar, Dünya, Haberler |
| Q W E R T Y U I | Harita modları |
| H · Esc · F1 | Ülkene dön · Kapat/Menü · Yardım |

## Proje yapısı

```
index.html, css/style.css
js/main.js                 Giriş noktası (harita verisini yükler)
js/engine/                 Oyun motoru (DOM'dan bağımsız, Node'da test edilir)
  world.js                 Statik il geometrisi, komşuluk, isabet testi
  setup.js                 Senaryodan yeni oyun kurulumu
  game.js                  Durum, önbellekler, günlük döngü, kayıt
  economy.js               Bütçe, büyüme, üretim, araştırma, insan gücü
  military.js              Yol bulma, hareket, muharebe, ikmal, işgal, füze/SİHA/nükleer
  diplomacy.js             Savaş, barış, teslim olma, antlaşmalar, ittifaklar
  ai.js                    Yapay zekâ (cephe, taarruz, üretim, araştırma, diplomasi)
  events.js                Olaylar, krizler, seçimler, kararlar, inşaat
js/data/countries.js       2026 ülke veritabanı, ittifaklar, ilişkiler, senaryo
js/data/rules.js           Birimler, arazi, yasalar, teknolojiler, kararlar
js/render/                 Canvas harita oluşturucu ve renkler
js/ui/                     Arayüz (HUD, paneller, menüler, ekranlar)
data/world.json            Üretilmiş harita verisi (1,5 MB)
tools/                     Harita üretim hattı, simülasyon ve yerel sunucu
tests/                     Motor testleri (node --test)
```

## Geliştirme

```bash
npm test                                  # motor testleri
node tools/simulate.mjs 1095 x 42         # 3 yıllık başsız dünya simülasyonu (denge ayarı için)

# Haritayı yeniden üretmek (Natural Earth verisi indirilir)
npm install
./tools/fetch-natural-earth.sh
npm run build:map
```

## Kaynaklar ve lisanslar

- Harita: [Natural Earth](https://www.naturalearthdata.com/) — kamu malı.
- Ülke özetleri, lider portreleri ve il görselleri: [Wikipedia](https://www.wikipedia.org/) / [Wikimedia Commons](https://commons.wikimedia.org/) — her görselin kendi lisansı geçerlidir; oyun içinde kaynağa bağlantı verilir.
- Bayraklar: [flagcdn.com](https://flagcdn.com/) (Wikimedia Commons kaynaklı, kamu malı).
- Ekonomik ve askeri değerler kamuya açık 2025 tahminlerine dayanan yaklaşık değerlerdir. Oyun bir simülasyondur; oyun içindeki olaylar kurgusaldır.
