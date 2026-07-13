import type { ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";

import { AnchoredOverlay } from "./overlay";

import "./keywords.css";

export type KeywordTerm =
  | "burn"
  | "wither"
  | "block"
  | "flip"
  | "consume"
  | "frostbite"
  | "shock"
  | "trigger"
  | "attack-buff"
  | "passive"
  | "temporary"
  | "elementCoin"
  | "cooldown"
  | "oncePerCombat"
  | "overheat";

export const KEYWORD_GLOSSARY: Record<KeywordTerm, { label: string; description: string }> = {
  burn: {
    label: "화상",
    description: "대상의 턴이 끝날 때 스택만큼 피해를 준다 (방어 무시). 그 뒤 스택이 1 줄어든다.",
  },
  wither: {
    label: "위축",
    description: "다음 턴에 뽑는 동전이 그만큼 줄어든다.",
  },
  block: {
    label: "방어",
    description: "받는 피해를 먼저 막는다. 자기 턴이 시작되면 0으로 돌아간다.",
  },
  flip: {
    label: "플립",
    description: "장전한 동전을 던져 앞·뒤를 정한다. 기본 효과는 항상 발동하고, 면 결과는 보너스만 더한다.",
  },
  consume: {
    label: "소비",
    description: "동전을 던지지 않고 그대로 지불한다. 앞·뒤 효과는 발동하지 않는다.",
  },
  frostbite: {
    label: "동상",
    description: "남은 턴 동안 대상이 가하는 공격 피해가 25% 줄어든다. 자기 턴이 끝날 때 1턴씩 줄어든다.",
  },
  shock: {
    label: "감전",
    description: "남은 턴 동안 대상이 받는 피해가 50% 늘어난다. 자기 턴이 끝날 때 1턴씩 줄어든다.",
  },
  trigger: {
    label: "턴 버프",
    description: "이번 턴 동안만 유지되는 발동 효과. 턴이 끝나면 사라진다.",
  },
  "attack-buff": {
    label: "공격 버프",
    description:
      "다음 공격 행동 1회의 피해가 표시만큼 늘어난다. 사용하면 사라지고, 사용 전에는 유지되며 중첩 시 더해진다.",
  },
  passive: {
    label: "패시브",
    description: "이 적의 고유 특성. 조건이 되면 자동으로 발동한다 — 의도(다음 행동)와 별개.",
  },
  temporary: {
    label: "임시 코인",
    description: "이번 전투에서만 쓰는 동전. 전투가 끝나면 사라진다.",
  },
  elementCoin: {
    label: "속성 코인",
    description: "앞면과 뒷면에 서로 다른 속성 효과가 있는 동전. 플립할 때만 발동하고, 소비하면 발동하지 않는다.",
  },
  // P7 D1/D5 — 쿨다운·전투당 1회·과열 (공식 용어 정본)
  cooldown: {
    label: "쿨다운",
    description:
      "사용 후 표시된 턴 수만큼 다시 쓸 수 없다. 내 턴이 시작될 때 1씩 줄어든다. 쿨다운 0(반복) 스킬은 코인이 남는 한 같은 턴에 계속 쓸 수 있다.",
  },
  oncePerCombat: {
    label: "전투당 1회",
    description: "이번 전투에서 한 번만 쓸 수 있다. 다음 전투에서 다시 쓸 수 있다.",
  },
  overheat: {
    label: "과열",
    description:
      "일부 화염 스킬로 진입한다. 하나만 유지되고 턴이 지나도 남는다. 과열 강화 스킬을 성공시키면 강화 효과가 적용된 뒤 과열이 사라진다.",
  },
};

export function Keyword(props: {
  term: KeywordTerm;
  children?: ReactNode;
  className?: string;
  // 콘텐츠 정의 용어(몬스터 패시브 등) — 용어 사전 대신 개별 항목으로 툴팁 구성
  entry?: { label: string; description: string };
}): JSX.Element {
  const id = useId();
  const host = useRef<HTMLSpanElement>(null);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  // hover/:focus-visible 표시도 Escape로 즉시 해제돼야 한다 (WCAG 1.4.13 — 포커스
  // 이동 없이 닫기). 억제는 hover 이탈·blur에서 풀려 다음 표시를 막지 않는다.
  const [suppressed, setSuppressed] = useState(false);
  const entry = props.entry ?? KEYWORD_GLOSSARY[props.term];
  const open = !suppressed && (focused || hovered || pinned);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (host.current?.contains(event.target as Node)) return;
      setPinned(false);
      setSuppressed(true);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setPinned(false);
      setSuppressed(true);
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <span
      className={`kw-host ${props.className ?? ""}`}
      data-open={open ? "true" : undefined}
      data-suppressed={suppressed ? "true" : undefined}
      ref={host}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setSuppressed(false);
      }}
    >
      <button
        aria-describedby={id}
        className="kw"
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          if (pinned) {
            setPinned(false);
            setSuppressed(true);
          } else {
            setSuppressed(false);
            setPinned(true);
          }
        }}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.stopPropagation();
          setPinned(false);
          setSuppressed(true);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          setSuppressed(false);
        }}
      >
        {props.children ?? entry.label}
      </button>
      <AnchoredOverlay anchorRef={host} className="kw-tip" id={id} open={open} role="tooltip">
        <strong>{entry.label}</strong>
        {entry.description}
      </AnchoredOverlay>
    </span>
  );
}
