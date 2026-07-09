## 골 검토 요약 (Step 8 자동 생성)

- 목표: 동전 장전·플립 전투 MVP(Phase 1: M0~M4)를 헤드리스 코어 우선으로 구현, 배포 URL 포함 플레이 가능 상태 도달
- 마일스톤: M0 셋업 / M1 헤드리스 코어 / M2 UI+연출+배포 / M3 화염·화상·불씨 / M4 소비형·취급·일회성
- 필수 검증: pnpm typecheck · lint · test(골든+퍼즈+콘텐츠 lint) · build · sim play --seed 42
- scope 잠금: Non-goals(계정·상점·이벤트·모바일·사운드·타 속성) 금지, 04_PROJECT_SPEC "절대 하지 마" 준수, 코드 작성은 codex 위임 기본

---

# PROGRESS

## 현재 골

동전 장전·플립 전투 문법의 MVP(Phase 1: M0~M4)를 헤드리스 코어 우선으로 구현하고, 브라우저에서 플레이 가능한 상태(배포 URL 포함)로 만든다.

## 현재 마일스톤

마일스톤 2 (M1 헤드리스 전투 코어) 진행 중 — codex 위임 + Claude 검수 체제

## 완료

- [x] **M0 프로젝트 셋업** (2026-07-10) — pnpm 모노레포(core/content/ui/sim), xoshiro128** 결정론 RNG(계층 derive + attempt 소금), RNG 테스트 7종, ESLint core 순수성 규칙, Vite+React 부트스트랩(base path), sim CLI, GitHub Actions CI. codex 작성 → Claude 검수(수정 2건: CoinUid/SlotId number 브랜드, sim CLI 내로잉) → 검증 통과. 런타임: Node 18(EOL, vitest 구동 불가) → Node 22.14 로컬 설치로 해결

## 마지막 검증 결과

```text
M0 (2026-07-10): pnpm typecheck ✓ (4/4 패키지) · pnpm lint ✓ · pnpm test ✓ (7/7 —
동일 시드 1,000회 재현, 스냅샷 재개, 스트림 독립성, label/index 분리, attempt 소금,
property 범위·멀티셋, 분포 스모크) · pnpm build ✓ (UI 143.96kB) · pnpm sim ✓
CI green은 push 후 확인 예정
```

## 실패 시도

| 시도 | 변경 | 결과 | 배운 점 |
| --- | --- | --- | --- |

## 현재 가장 안정적인 상태

M0 완료 커밋 — 모노레포 + RNG 전 검증 통과 상태

## 다음 단계

M1 헤드리스 전투 코어 — codex에 위임: content-types(스키마 전체) + CombatState/리듀서/이벤트 + 플립 해결 P0~P9 + 턴 상태기계(3회 캡) + 약탈자 + CLI play/fuzz + 베기/방어 골든. 완료 기준: CLI 1판 완주, 퍼즈 1,000판 불변식 0위반, 베기 10/6·방어 5/8

## 리스크 / 블로커

- 사람 게이트 2건은 골이 자동 통과할 수 없음: M2 손맛 플레이테스트, M4 갈등 관찰 — 도달 시 "사람 대기"로 기록
- 잔여 가정(01_PRD 가정 원장): 사운드 MVP 제외 / 한국어 단일 / 최신 데스크톱 브라우저만
- 코드 작성은 codex exec 위임이 기본 — codex 세션/인증 만료 시 직접 작성 폴백 (PLAN.md 운영 노트)

## 인수인계 메모

이 PROGRESS.md는 골잡이가 생성했다. 골 실행 중 매 체크포인트마다 갱신된다.

## 골 시작 기록
- 시작 시각: 2026-07-10T02:35:26+09:00
- 사용 CLI: claude_code
- 컴팩트 후 본문 길이: 975자
