// Türkçe ek üretimi (ünlü uyumu, kaynaştırma ünsüzü, sertleşme, kısaltma okunuşu)
const VOWELS = 'aıoueiöü';
const BACK = 'aıou';
const HARD = 'fstkçşhp';
const LETTER = { A: 'a', B: 'be', C: 'ce', Ç: 'çe', D: 'de', E: 'e', F: 'fe', G: 'ge', Ğ: 'ge', H: 'he', I: 'ı', İ: 'i', J: 'je', K: 'ka', L: 'le', M: 'me', N: 'ne', O: 'o', Ö: 'ö', P: 'pe', R: 're', S: 'se', Ş: 'şe', T: 'te', U: 'u', Ü: 'ü', V: 've', Y: 'ye', Z: 'ze', X: 'iks', W: 've', Q: 'ku' };
const WORD_ACRONYMS = new Set(['NATO', 'BRICS', 'ASEAN', 'OPEC', 'NAFTA', 'SİHA', 'İHA']);
// 3. tekil iyelik ekiyle biten adlar (ör. Cumhuriyeti → Cumhuriyeti'ne)
const POSSESSIVE = /^(cumhuriyeti|devletleri|emirlikleri|adaları|sahili|ginesi|krallığı|federasyonu|birliği|grenadinleri|burnu|bölgesi|ittifakı|paktı)$/;

function lastWord(name) {
  const parts = String(name).trim().replace(/[.()]+$/g, '').split(/[\s\-–]+/);
  return parts[parts.length - 1] || '';
}
function phon(name) {
  const w = lastWord(name);
  if (/^[A-ZÇĞİÖŞÜ]+$/.test(w) && !WORD_ACRONYMS.has(w)) return LETTER[w[w.length - 1]] || 'e';
  return w.toLocaleLowerCase('tr-TR');
}
function lastVowel(s) { for (let i = s.length - 1; i >= 0; i--) if (VOWELS.includes(s[i])) return s[i]; return 'e'; }
const endsVowel = (s) => VOWELS.includes(s[s.length - 1]);
const two = (v) => (BACK.includes(v) ? 'a' : 'e');
const four = (v) => ('aı'.includes(v) ? 'ı' : 'ei'.includes(v) ? 'i' : 'ou'.includes(v) ? 'u' : 'ü');
const isPoss = (name) => POSSESSIVE.test(lastWord(name).toLocaleLowerCase('tr-TR'));

// Yönelme: Türkiye'ye, Irak'a, ABD'ye, Rusya Federasyonu'na
export function dat(name) {
  const p = phon(name), v = lastVowel(p);
  if (isPoss(name)) return `${name}'n${two(v)}`;
  return `${name}'${endsVowel(p) ? 'y' : ''}${two(v)}`;
}
// İlgi: Türkiye'nin, İran'ın, ABD'nin
export function gen(name) {
  const p = phon(name), v = lastVowel(p);
  return `${name}'${endsVowel(p) ? 'n' : ''}${four(v)}n`;
}
// Belirtme: Türkiye'yi, İran'ı
export function acc(name) {
  const p = phon(name), v = lastVowel(p);
  if (isPoss(name)) return `${name}'n${four(v)}`;
  return `${name}'${endsVowel(p) ? 'y' : ''}${four(v)}`;
}
// Bulunma: Türkiye'de, Irak'ta, Rusya Federasyonu'nda
export function loc(name) {
  const p = phon(name), v = lastVowel(p);
  if (isPoss(name)) return `${name}'nd${two(v)}`;
  return `${name}'${HARD.includes(p[p.length - 1]) ? 't' : 'd'}${two(v)}`;
}
// Ayrılma: Türkiye'den, Irak'tan
export function abl(name) { return `${loc(name)}n`; }
