# PLAN — 코인플립 로그라이크 (Phase 1: M0~M4)

## 목표

동전 장전·플립 전투 문법의 MVP(전사 vs 적 1종, 스킬 6종)를 헤드리스 코어 우선으로 구현하고, 브라우저에서 플레이 가능한 상태(배포 URL 포함)로 만들어 손맛 검증이 가능한 지점까지 도달한다.

## 참조 문서

- PRD.md (PRD/01_PRD.md — 요약 PRD, §5 성공 기준, §6 Non-goals)
- PRD/02_DATA_MODEL.md · PRD/03_PHASES.md · PRD/04_PROJECT_SPEC.md (AI 행동 규칙)
- docs/implementation-plan.md — **규칙이 애매할 때의 정답지** (§4 결정 표, §5 전투 파이프라인, §5.8 골든 정답지, §6 스키마, §7 태스크 상세)
- docs/PRD.md (v0.4) · docs/content-design-guide.md (수치 기준)
- PRD/references/ (디자인 레퍼런스 — 스타일: pixel art retro) + 아트 앵커 docs/ui/combat-ui-v2.png
- VALIDATION.md
- RECOVERY.md

## 운영 노트

- **코드 작성 위임**: 파일 단위 코드 작성은 가능한 한 `codex exec`(로그인 완료 상태)에 외주로 위임해 토큰을 절약한다. 스펙 작성 → codex 구현 → 결과 리뷰·테스트·통합은 골 세션이 직접 수행한다. codex 실패/불가 시 직접 작성으로 폴백.
- 위임 시에도 04_PROJECT_SPEC.md의 "절대 하지 마" 목록과 docs/implementation-plan.md §5 명세를 codex 프롬프트에 함께 전달한다.

## 마일스톤 1: M0 프로젝트 셋업
- 범위(Scope): pnpm 모노레포(core/content/ui/sim), strict tsconfig + ESLint(core 순수성 규칙), Vitest+fast-check, 결정론 RNG(flip/shuffle/ai/reward 스트림 파생 + attempt 소금), Vite+React 부트스트랩, GitHub Actions CI
- 완료 조건: 동일 시드 1,000회 플립 완전 재현 + 스트림 독립성 테스트 통과, CI green
- 검증: `pnpm test --filter @game/core` + CI 실행 확인

## 마일스톤 2: M1 헤드리스 전투 코어
- 범위(Scope): CombatState/5영역/슬롯6, 순수 리듀서 step()+이벤트, 스킬 스키마(any/per, oncePerCombat, 코스트 lint A18), 턴 상태기계(3회 캡 카운터, 유닛별 방어 리셋·틱 훅), 플립 해결 P0~P9, 적 1종(약탈자)+의도, 승패 판정, CLI 플레이어, 랜덤봇 퍼즈, 베기/방어 골든
- 완료 조건: CLI로 전투 1판 완주, 퍼즈 1,000판 무예외·불변식 위반 0, 베기 10/6·방어 5/8 골든 통과, core에 DOM/React 의존 0
- 검증: `pnpm sim play --seed 42 --auto` + `pnpm sim fuzz --games 1000` + `pnpm test`

## 마일스톤 3: M2 최소 UI + 플립 연출 + 배포
- 범위(Scope): 이벤트→애니메이션 큐 어댑터, PRD §15.1 레이아웃(v0.3.1 — 필드 스프라이트+유닛 HP바, 노란 소켓, 주머니 원), 드래그 장전(회수 지원), CSS 3D 플립 연출, 면 조합 열거 프리뷰, 승패 화면(시드 표시), GitHub Pages 배포(vite base path)
- 완료 조건: 브라우저 전투 완주, URL 시드 파라미터 재현, 배포 URL 접속 가능, 스크린샷 캡처, 픽셀 아트(32px·Neo둥근모) 방향이 레퍼런스와 부합
- 검증: `pnpm build` + 스크린샷 + 배포 확인. 완료 시 PROGRESS.md에 "손맛 게이트 사람 대기" 기록

## 마일스톤 4: M3 화염 코인 + 화상 + 불씨 주머니
- 범위(Scope): 속성 코인 개별 proc(P6), 화상(D2 — 양측 턴 종료 훅), 임시 코인 수명주기, 스킬 데이터(불타는 일격 per 모드, 점화), 캐릭터 특성 훅(불씨 주머니), UI 속성/화상/임시 표식
- 완료 조건: 화염 2 HH→화상 2, 화상 틱 방어 관통 후 −1, 일격 HH=14, 불씨로 뽑을 더미 11개, 임시 코인 전투 후 잔존 0
- 검증: `pnpm test` (M3 골든 + 퍼즈 불변식 추가분)

## 마일스톤 5: M4 소비형 + 취급 태그 + 일회성 (MVP 6종 완성)
- 범위(Scope): 소비형 파이프라인 C0~C4(유효속성 연료, 소모 영역 격리), 취급 태그(D6 — 스냅샷 부여·턴 종료 만료·연료 인정), 점화 검술·화염 폭주(뒷면 자해, oncePerCombat), 손패 상한, UI(소비 조건 점등, 연료 선택, 일회성 배지·잠금)
- 완료 조건: MVP 6종 전수 골든(§5.8 표), 폭주→검술 콤보 테스트, 소모 영역 리셔플 재등장 0, 일회성 2회 사용 거부, 턴당 4번째 스킬 거부
- 검증: `pnpm test` 전체 + `pnpm sim play` 완주. 완료 시 PROGRESS.md에 "갈등 게이트 사람 대기" 기록

## 최종 완료 기준

- [ ] 모든 마일스톤 완료
- [ ] VALIDATION.md의 모든 검증 통과 (사람 게이트 항목은 "사람 대기"로 기록)
- [ ] scope 위반 없음
- [ ] PROGRESS.md 업데이트
