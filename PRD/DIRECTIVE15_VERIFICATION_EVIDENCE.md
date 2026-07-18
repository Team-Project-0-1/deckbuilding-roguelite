# Directive 15 Verification Evidence — M17/M18

검증일: 2026-07-18

## 구현 범위

- M17 검은가시 심문관 로데릭: 반복 스킬 열성, 단일 가용 스킬 완화 주기, 정확 슬롯 추적, 18 피해 처형 예고, 실제 피해 15 취소, 1턴 봉인.
- M18 무너진 왕의 재무관 마르셀: 합법적인 동일 속성 2코인 납세, 부분 납부, 체납 시 위조 코인 2개와 방어 8, 연속 체납 시 소유자별 압류 예고와 피해 4.
- 위조 코인: 무속성·무효과·전투 전용, 드로우 즉시 소진, 납세·인챈트·압류·런 보상 제외, 전투 종료 정리.
- UI: 처형·납세·압류 사전 예고, 한국어 의미 로그, 피드백·SFX·접근성 라벨.
- 그래프: Act 2 이후 단독 엘리트 후보. 축약 콘텐츠 DB에서는 선택적 D15 후보만 필터링하여 기존 테스트·RNG 스트림을 보존.

## 자동 검증

| 검증 | 결과 | 증거 |
|---|---|---|
| D15 집중 테스트 | PASS | 5 files, 38/38 |
| 전체 단위·통합 테스트 | PASS | 84 files, 799/799 |
| typecheck | PASS | core/content/ui/sim 오류 0 |
| lint | PASS | ESLint exit 0 |
| build | PASS | Vite production build exit 0 |
| ci:sim | PASS | 500/500 terminal, crash 0, invariant 0, seed 42 unchanged |
| 시뮬레이션 관측 | REPORT | 786/2500 combats, 31.44%, 평균 10.174턴 |
| feedback/content/assets | PASS | 각 게이트 exit 0 |
| 번들 예산 | PASS | total 3,119,465 B / 3,213,312 B; JS 571,470 B / 589,824 B; CSS 86,689 B / 90,112 B; max 651,044 B / 716,800 B |
| 성능 | PASS | LCP median 372ms, CLS worst 0.000469, 200ms 초과 long task 0 |
| 접근성 | PASS | contrast/a11y gate exit 0 |
| 모바일 | PASS | 전체 mobile playtest gate exit 0 |

## 리뷰

- D15 독립 코드 리뷰: APPROVE, 남은 지적 0.
- 세금은 정확히 2개를 합법적으로 소비 가능한 플립·소비 스킬만 열 수 있으며, 3코스트 및 all-3 경계 테스트를 포함한다.
- 중복 스킬 ID에서도 처형 예고와 실제 봉인이 저장된 동일 슬롯을 가리킨다.
- 콘텐츠 검증기는 테스트·개발·직접 TSX 실행에서 유지되고, 이미 검증된 프로덕션 Vite 번들에서만 제외된다.
- 기존 React SSR `useLayoutEffect` 경고는 비차단 기존 경고이며 D15 신규 실패가 아니다.

## 잔여 수동 검증

M17/M18의 수치와 체감은 `balance-provisional`, `experience-unverified`로 유지한다. 실제 플레이 피드백 전까지 HP·피해·납세 주기·위조 코인 수량은 조정 가능하며, 예고·취소·복구 가능성 계약은 유지한다.
