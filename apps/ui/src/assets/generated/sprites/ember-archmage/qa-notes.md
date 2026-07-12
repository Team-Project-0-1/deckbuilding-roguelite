# QA 노트 — ember-archmage (P4.6)

## Base Lock Gate
- 프롬프트: prompt-kit-validation/base.refined.txt — check_prompt.mjs ok=true·errors 0 (생성 전 검증, skill-repos 기능 검증기)
- 생성: codex image_gen, session id: 019f53f9-017b-7fd2-98d9-80b436bd34f2 (재생성 — 1차 019f53f7-0cea-7ad1-b3ed-01e31cbf2564 부유 파편 FAIL 반려)
- base-source.png md5: 3f49d64f7a1d672a52fa800d677a7b8b (prepare --force 최종본 재계산)
- 판정: 전신·왼쪽 향·16비트 스타일 일치·마젠타 클린·단일 포즈 — LOCK (독립 검증 교차 판정 포함)
- 독립 판정 FAIL→재생성 PASS: 잉걸불 전부 실루엣 부착(왕관·견갑·허리·지팡이 머리쇠), 부유 파편 0. 로컬 수리 없음.

## 행 생성 (기록 예정)

## 행 생성 (component-row, 킷 선검증 전 행 ok=true·0E)
- idle session id: 019f5408-3d8e-75b0-82e2-22880a0808a8
- attack session id: 019f5409-1a5a-78f2-9fef-15c2d57d77d6
- hurt session id: 019f5416-a2e8-7773-9e88-62695c970d2a
- 반려/재생성 이력: hurt 3회 재생성(1차 임팩트 광선·2차 불티 파편 반려, 3차 '방어 동작' 재프레임으로 클린 — 풀스케일 컴포넌트 4·파편 0), idle/attack 2세대(1차 슬롯 근접 반려)
- 크로마: 마젠타 명시 고정 (prepare auto 선택이 base 기준 cyan을 고르는 결함 우회 — mage/boss 추출 실패 원인이었음)

## 모션 QA (BLOCKING 통과)
- idle 루프 심리스(1·4 동일)·attack 와인드업→타격→회수·hurt 반동→복귀 — 컨택트 시트/GIF 검토, 정체성 12프레임 일관
- 독립 시각 QA 교차 판정 반영(파편 반려 이력 위 참조)

## 최종 아틀라스 후처리 (D11)
- pixel-perfect fit(kCentroid·공유 팔레트) 재추출 후 **정확 팔레트 P-mode 변환(완전 무손실 — RGBA 바이트 동일)**
- 팔레트 90색, 100,835 → 38,062 bytes
- raw 행 불가침 (후처리는 sprite-sheet-alpha.png에만)
