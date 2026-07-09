/goal PRD/03_PHASES.md Phase 1(M0~M4)의 자동 검증 가능한 완료 기준이 전부 만족되고 VALIDATION.md의 필수 검증이 통과될 때까지 멈추지 말고 PLAN.md의 마일스톤을 구현한다.

먼저 PRD/01_PRD.md, PRD/04_PROJECT_SPEC.md, VALIDATION.md, RECOVERY.md, PLAN.md를 읽는다. 규칙이 애매하면 docs/implementation-plan.md(§4 결정 표, §5 파이프라인, §5.8 골든 정답지)가 정답이다.
마일스톤 단위(M0→M1→M2→M3→M4)로 순서대로 작업하고, M1 완료 기준(CLI 1판 완주 + 퍼즈 1,000판) 통과 전에 UI를 시작하지 않는다.
코드 작성은 가능한 한 codex exec에 외주로 위임한다(토큰 절약) — 스펙 작성·결과 리뷰·테스트·통합은 직접 수행하고, codex 불가 시 직접 작성으로 폴백한다 (PLAN.md 운영 노트).
PRD와 PLAN.md를 벗어나는 scope 확장은 금지한다. Non-goals(계정·상점·이벤트·모바일·사운드·타 속성)는 구현하지 않는다.
04_PROJECT_SPEC.md의 "절대 하지 마"를 준수한다(core에 Math.random 금지, UI에 규칙 분기 금지, custom 효과 원자 금지 등).
각 마일스톤이 끝나면 VALIDATION.md의 해당 검증을 실행하고 마일스톤 단위로 커밋한다.
각 마일스톤이 끝나면 PROGRESS.md를 업데이트한다.
사람 게이트(손맛·갈등 플레이테스트)는 자동화하지 않는다 — 도달 시 PROGRESS.md에 "사람 대기"로 기록하고 자동 검증 항목만으로 다음 마일스톤 진행을 판단한다.
실패 처리·scope 잠금 상세는 RECOVERY.md를 따른다. 요구사항이 충돌하거나 같은 검증이 3회(3 attempts) 실패하면 자체 수정을 멈추고 사람의 결정을 기다린다(Claude Code는 /goal pause를 지원하지 않음).
