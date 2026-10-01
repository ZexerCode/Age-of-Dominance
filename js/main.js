// Giriş noktası: harita verisini yükle, uygulamayı başlat
import { World } from './engine/world.js';
import { App } from './ui/app.js';
import { showStartMenu } from './ui/screens.js';

const bar = document.getElementById('loading-bar');
const text = document.getElementById('loading-text');

async function loadWorld() {
  const res = await fetch('data/world.json');
  if (!res.ok) throw new Error(`Harita verisi alınamadı (${res.status})`);
  const total = Number(res.headers.get('content-length')) || 0;
  if (!res.body || !total) return res.json();
  const reader = res.body.getReader();
  const chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    bar.style.width = `${Math.min(90, (got / total) * 90).toFixed(0)}%`;
  }
  const buf = new Uint8Array(got);
  let off = 0;
  for (const c of chunks) { buf.set(c, off); off += c.length; }
  return JSON.parse(new TextDecoder().decode(buf));
}

async function main() {
  try {
    const raw = await loadWorld();
    text.textContent = 'Dünya kuruluyor…';
    bar.style.width = '94%';
    await new Promise((r) => setTimeout(r, 30));
    const world = new World(raw);
    const app = new App(world);
    window.__app = app;
    showStartMenu(app);
    bar.style.width = '100%';
    const ld = document.getElementById('loading');
    ld.classList.add('done');
    setTimeout(() => ld.remove(), 700);
  } catch (e) {
    console.error(e);
    text.textContent = `Yükleme hatası: ${e.message}`;
    text.style.color = '#e0524a';
  }
}
main();
