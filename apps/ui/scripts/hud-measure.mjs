// HUD 개선 검증 도구 — 1280×720 / 1024×720에서 주요 영역 치수 측정 + 스크린샷.
// 사용: node scripts/hud-measure.mjs [출력 디렉토리 (기본 /tmp)]
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';
import { preview } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = process.argv[2] ?? '/tmp';

const server = await preview({
  root,
  preview: { host: '127.0.0.1', port: 4173, strictPort: true }
});

const measure = () => {
  const rect = (selector) => {
    const el = document.querySelector(selector);
    if (el === null) return null;
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom) };
  };
  const sprites = [...document.querySelectorAll('.sprite-frame')].map((el) => Math.round(el.getBoundingClientRect().bottom));
  return {
    battlefield: rect('.battlefield'),
    skillRow: rect('.skill-row'),
    skillCard: rect('.skill-card'),
    hud: rect('.bottom-hud'),
    handTray: rect('.hand-tray'),
    coin: rect('.coin'),
    pouch: rect('.pouch'),
    pileCounts: rect('.pile-counts'),
    endTurn: rect('.end-turn'),
    spriteBottoms: sprites,
    horizontalScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth
  };
};

const browser = await chromium.launch();
try {
  for (const width of [1280, 1024]) {
    const page = await browser.newPage({ viewport: { width, height: 720 }, deviceScaleFactor: 1 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('http://127.0.0.1:4173/deckbuilding-roguelite/?seed=BRAVE-EMBER-42', { waitUntil: 'networkidle' });
    await page.waitForFunction(
      () => document.querySelector('.end-turn:not(:disabled)') !== null && document.querySelector('.float-text') === null
    );
    // 잠금 해제 직후 카드 디밍 페이드-인이 끝날 때까지 대기 (캡처 레이스 방지 — 디밍은 카드 단위)
    await page.waitForFunction(() => {
      const cards = [...document.querySelectorAll('.skill-card')];
      return cards.length > 0 && cards.every((card) => getComputedStyle(card).opacity === '1');
    });
    console.log(`== ${width}x720 ==`);
    console.log(JSON.stringify(await page.evaluate(measure), null, 1));
    await page.screenshot({ path: `${outDir}/hud-${width}.png`, fullPage: false });
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise((resolveClose) => server.httpServer.close(resolveClose));
}
