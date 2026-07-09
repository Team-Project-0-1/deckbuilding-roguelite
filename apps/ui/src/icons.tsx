// 픽셀 아트 시스템 — 문자 맵 → SVG rect. 이모지/폰트 글리프 의존 없음.
// 팔레트·맵은 확정 아트 앵커(docs/ui/combat-ui-v2.png)의 밝은 숲 + SD 비율 방향.

interface PixelArtProps {
  map: readonly string[];
  palette: Record<string, string>;
  scale?: number;
  className?: string;
  label?: string;
}

export const PixelArt = ({ map, palette, scale = 5, className, label }: PixelArtProps) => {
  const height = map.length;
  const width = map.reduce((max, row) => Math.max(max, row.length), 0);
  return (
    <svg
      aria-hidden={label === undefined}
      aria-label={label}
      className={className}
      height={height * scale}
      role={label === undefined ? undefined : 'img'}
      shapeRendering="crispEdges"
      viewBox={`0 0 ${width} ${height}`}
      width={width * scale}
    >
      {map.flatMap((row, y) =>
        [...row].map((ch, x) => {
          const fill = palette[ch];
          if (fill === undefined) return null;
          return <rect fill={fill} height={1} key={`${x}-${y}`} width={1} x={x} y={y} />;
        })
      )}
    </svg>
  );
};

const OUT = '#241d2b';

// ---- 전사 (SD 2.5등신, 붉은 스카프 + 은빛 갑옷 + 검) ----
const WARRIOR_PALETTE: Record<string, string> = {
  k: OUT,
  h: '#7a4a28', // 머리카락
  H: '#5d3820',
  s: '#f2c894', // 피부
  e: '#3b2c22', // 눈
  c: '#cc3b30', // 스카프/망토
  C: '#93251d',
  a: '#aebccb', // 갑옷
  A: '#7e8ca0',
  b: '#4a3826', // 부츠/벨트
  m: '#dfe8f0', // 칼날
  g: '#d9a441' // 칼자루
};

const WARRIOR_MAP = [
  '.....kkkkkk....m',
  '....khhhhhhk..kmk',
  '...khhhhhhhhk.kmk',
  '...khhhhhhhhk.kmk',
  '...kssssssssk.kmk',
  '...ksesssesk..kmk',
  '...kssssssssk.kmk',
  '....kssssssk..kgk',
  '...kkccccckk..kgk',
  '..kccccccccck.ksk',
  '.kcakaaaaakack.k.',
  '.kcakaAAAakack...',
  '.ksskaaaaaakssk..',
  '..kkkaAAAAakkk...',
  '....kaakkaak.....',
  '....kaak.kaak....',
  '...kbbk...kbbk...',
  '..kbbbk...kbbbk..'
];

export const WarriorSprite = ({ scale = 6 }: { scale?: number }) => (
  <PixelArt className="pixel-sprite" label="전사" map={WARRIOR_MAP} palette={WARRIOR_PALETTE} scale={scale} />
);

// ---- 고블린 약탈자 (초록 피부 + 가죽 조끼 + 단검) ----
const GOBLIN_PALETTE: Record<string, string> = {
  k: OUT,
  g: '#7ab648', // 피부
  G: '#578a2e',
  e: '#d43c2c', // 눈
  v: '#7a5b38', // 조끼
  V: '#5b422a',
  m: '#cfd8e0', // 단검
  t: '#e8e0c8' // 이빨
};

const GOBLIN_MAP = [
  'kk.....kkkk.....kk',
  'kgk...kggggk...kgk',
  'kgGk.kggggggk.kGgk',
  '.kgggggggggggggk..',
  '..kgggggggggggk...',
  '..kgekgggkegk.....',
  '..kggggggggggk....',
  '..kgktktktkggk....',
  '...kggggggggk.kmk.',
  '..kkvvvvvvkk..kmk.',
  '.kgvvvvvvvvgk.kmk.',
  '.kgkvVvvVvkgk.kmk.',
  '.kggkvvvvkggk.kvk.',
  '..kkkvVVvkkkkkgk..',
  '....kvvvvk..kgk...',
  '....kgkkgk..kk....',
  '...kGGkkGGk.......',
  '..kGGGk.kGGGk.....'
];

export const GoblinSprite = ({ scale = 6 }: { scale?: number }) => (
  <PixelArt className="pixel-sprite" label="약탈자" map={GOBLIN_MAP} palette={GOBLIN_PALETTE} scale={scale} />
);

// ---- 소형 아이콘 (10×10) ----
const ICON_OUT = '#1c1724';

const iconPalette = (main: string, shade: string, extra: Record<string, string> = {}): Record<string, string> => ({
  k: ICON_OUT,
  m: main,
  s: shade,
  ...extra
});

const SWORD_MAP = [
  '.......km.',
  '......kmk.',
  '.....kmk..',
  '....kmk...',
  '.k.kmk....',
  '.kkgk.....',
  '..kgk.....',
  '.kskk.....',
  'ksk.......',
  'kk........'
];

export const SwordIcon = ({ scale = 2.4 }: { scale?: number }) => (
  <PixelArt map={SWORD_MAP} palette={iconPalette('#e6edf4', '#8b6f3e', { g: '#d9a441' })} scale={scale} />
);

const SHIELD_MAP = [
  '.kkkkkkkk.',
  'kmmmmmmmmk',
  'kmmsmmsmmk',
  'kmmmmmmmmk',
  'kmsmmmmsmk',
  'kmmmmmmmmk',
  '.kmmssmmk.',
  '.kmmmmmmk.',
  '..kmmmmk..',
  '...kmmk...'
];

export const ShieldIcon = ({ scale = 2.4, tone = 'blue' }: { scale?: number; tone?: 'blue' | 'steel' }) => (
  <PixelArt
    map={SHIELD_MAP}
    palette={tone === 'blue' ? iconPalette('#4f7fd4', '#2d55a0') : iconPalette('#b8c4d0', '#7e8ca0')}
    scale={scale}
  />
);

const FLAME_MAP = [
  '....kk....',
  '...kmmk...',
  '...kmmk...',
  '..kmmmmk..',
  '.kmmsmmmk.',
  '.kmsssmmk.',
  'kmmshhsmmk',
  'kmsshhssmk',
  '.kmsssssk.',
  '..kkkkkk..'
];

export const FlameIcon = ({ scale = 2.4 }: { scale?: number }) => (
  <PixelArt map={FLAME_MAP} palette={iconPalette('#f0902c', '#f6c948', { h: '#fdf3d0' })} scale={scale} />
);

const HEART_MAP = [
  '.kk...kk..',
  'kmmk.kmmk.',
  'kmsmkmmmk.',
  'kmmmmmmmk.',
  '.kmmmmmk..',
  '..kmmmk...',
  '...kmk....',
  '....k.....'
];

export const HeartIcon = ({ scale = 2 }: { scale?: number }) => (
  <PixelArt map={HEART_MAP} palette={iconPalette('#d43c50', '#f08098')} scale={scale} />
);

const SKULL_MAP = [
  '..kkkkkk..',
  '.kmmmmmmk.',
  'kmmmmmmmmk',
  'kmksmmksmk',
  'kmmmmmmmmk',
  '.kmmkkmmk.',
  '.kmkmmkmk.',
  '..kkkkkk..'
];

export const SkullIcon = ({ scale = 2 }: { scale?: number }) => (
  <PixelArt map={SKULL_MAP} palette={iconPalette('#d8d4c8', '#8a8578')} scale={scale} />
);

const EMBER_MAP = [
  '...kk.....',
  '..kmsk.kk.',
  '.kmssk.ksk',
  '.kmmssk.k.',
  'kmmssssk..',
  'kmsshssk..',
  '.kssssk...',
  '..kkkk....'
];

export const EmberIcon = ({ scale = 2 }: { scale?: number }) => (
  <PixelArt map={EMBER_MAP} palette={iconPalette('#f0902c', '#c85a20', { h: '#fdf3d0' })} scale={scale} />
);
