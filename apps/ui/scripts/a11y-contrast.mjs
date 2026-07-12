// P5.3 대비 리포트 (report-only, 차단 아님) — 주요 텍스트 요소의 실효 대비를
// 계산해 AA(4.5:1 일반, 3:1 대형) 미달 목록을 기록한다. 픽셀 폰트 특성상
// 판정은 사람 게이트 몫 — 여기서는 관측만 남긴다.
// 사용: node scripts/a11y-contrast.mjs [출력 JSON 경로]
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = process.argv[2] ?? "/tmp/a11y-contrast.json";
const base =
  process.env.PLAYTEST_BASE_URL ?? "http://127.0.0.1:4183/deckbuilding-roguelite/";

const server =
  process.env.PLAYTEST_BASE_URL === undefined
    ? await (
        await import("vite")
      ).preview({ root, preview: { host: "127.0.0.1", port: 4183, strictPort: true } })
    : null;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`${base}?seed=BRAVE-EMBER-42&encounter=raider`, {
  waitUntil: "networkidle",
});
await page.waitForSelector(".end-turn", { timeout: 15000 });

const report = await page.evaluate(() => {
  const luminance = ([r, g, b]) => {
    const f = (c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const parse = (value) => {
    const m = value.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
    return m ? { rgb: [Number(m[1]), Number(m[2]), Number(m[3])], a: m[4] === undefined ? 1 : Number(m[4]) } : null;
  };
  // 그라디언트 스톱 파싱 — 최악(전경과 대비가 가장 낮은) 스톱을 배경으로 채택
  // (토큰-쌍 보수 계산: 문서화된 방식 — 스캐너가 backgroundColor 투명만 보고
  // 조상 배경으로 떨어지면 그라디언트 요소에서 가짜 1.0x 판정이 난다)
  const gradientStops = (image) => {
    const stops = [];
    const re = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)|#([0-9a-fA-F]{6})/g;
    let m;
    while ((m = re.exec(image)) !== null) {
      if (m[5] !== undefined) {
        stops.push([
          parseInt(m[5].slice(0, 2), 16),
          parseInt(m[5].slice(2, 4), 16),
          parseInt(m[5].slice(4, 6), 16),
        ]);
      } else {
        stops.push([Number(m[1]), Number(m[2]), Number(m[3])]);
      }
    }
    return stops;
  };
  // 배경 탐색: 그라디언트 스톱(자기 요소 우선) → 불투명 배경 조상
  const bgOf = (el, fgRgb) => {
    let node = el;
    while (node && node !== document.documentElement) {
      const cs = getComputedStyle(node);
      const image = cs.backgroundImage;
      if (image && image.includes("gradient")) {
        const stops = gradientStops(image);
        if (stops.length > 0) {
          // 전경과의 대비가 가장 낮은 스톱 = 보수적 배경
          const lum = ([r, g, b]) => {
            const f = (c) => {
              const s2 = c / 255;
              return s2 <= 0.03928 ? s2 / 12.92 : ((s2 + 0.055) / 1.055) ** 2.4;
            };
            return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
          };
          const lf = lum(fgRgb);
          let worst = stops[0];
          let worstRatio = Infinity;
          for (const stop of stops) {
            const lb = lum(stop);
            const ratio = (Math.max(lf, lb) + 0.05) / (Math.min(lf, lb) + 0.05);
            if (ratio < worstRatio) {
              worstRatio = ratio;
              worst = stop;
            }
          }
          return worst;
        }
      }
      const c = parse(cs.backgroundColor);
      if (c && c.a >= 0.9) return c.rgb;
      node = node.parentElement;
    }
    return [35, 48, 29];
  };
  const targets = [
    [".unit-name", "유닛 이름"],
    [".hp-num", "HP 숫자"],
    [".card-title", "카드 제목"],
    [".card-effect-copy", "카드 효과 본문"],
    [".run-meta strong", "진행 메타"],
    [".end-turn", "턴 종료 버튼"],
    [".rejection-chip", "거부 칩"],
    [".hint-strip", "힌트 스트립"],
    [".shop-price", "상점 가격"],
    [".mute-toggle", "음소거 토글"],
  ];
  const rows = [];
  for (const [selector, label] of targets) {
    const el = document.querySelector(selector);
    if (!el) {
      rows.push({ selector, label, present: false });
      continue;
    }
    const cs = getComputedStyle(el);
    const fg = parse(cs.color);
    if (!fg) continue;
    const bg = bgOf(el, fg.rgb);
    const l1 = luminance(fg.rgb);
    const l2 = luminance(bg);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const px = Number.parseFloat(cs.fontSize);
    const bold = Number(cs.fontWeight) >= 700;
    const large = px >= 24 || (px >= 18.66 && bold);
    rows.push({
      selector,
      label,
      present: true,
      ratio: Math.round(ratio * 100) / 100,
      fontSizePx: px,
      threshold: large ? 3 : 4.5,
      passAA: ratio >= (large ? 3 : 4.5),
    });
  }
  return rows;
});

const summary = {
  schemaVersion: "a11y-contrast-report-v1",
  reportOnly: true,
  note: "픽셀 폰트·게임 스타일 특성상 차단 게이트 아님 — 미달 목록은 사람 판정 입력",
  rows: report,
  failing: report.filter((r) => r.present && !r.passAA).map((r) => r.label),
};
writeFileSync(out, JSON.stringify(summary, null, 1));
console.log(`contrast report → ${out}`);
console.log(
  report
    .filter((r) => r.present)
    .map((r) => `${r.passAA ? "ok " : "LOW"} ${r.label} ${r.ratio}:1`)
    .join("\n"),
);
await browser.close();
if (server) await server.close();
