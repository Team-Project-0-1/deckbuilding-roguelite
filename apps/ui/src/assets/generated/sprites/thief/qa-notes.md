# QA 노트 — thief (P4.6)

## Base Lock Gate
- 프롬프트: prompt-kit-validation/base.refined.txt — check_prompt.mjs ok=true·errors 0 (생성 전 검증, skill-repos 기능 검증기)
- 생성: codex image_gen, session id: 019f53f6-12ba-75e0-b359-ad00125c835c
- base-source.png md5: d65598426a6570e62393444fd3dbe157 (prepare --force 최종본 재계산)
- 판정: 전신·왼쪽 향·16비트 스타일 일치·마젠타 클린·단일 포즈 — LOCK (독립 검증 교차 판정 포함)


## 행 생성 (기록 예정)

## 행 생성 (component-row, 킷 선검증 전 행 ok=true·0E)
- idle session id: 019f53fe-b5f6-7051-83ea-ce437bf76cb9
- attack session id: 019f53fe-b57b-7ae3-9b0d-29436b556676
- hurt session id: 019f53fe-b5e6-73e2-b96c-d2a21e4da0dd
- 반려 없음 (1세대 통과)
- 크로마: 마젠타 명시 고정 (prepare auto 선택이 base 기준 cyan을 고르는 결함 우회 — mage/boss 추출 실패 원인이었음)

## 모션 QA (BLOCKING 통과)
- idle 루프 심리스(1·4 동일)·attack 와인드업→타격→회수·hurt 반동→복귀 — 컨택트 시트/GIF 검토, 정체성 12프레임 일관
- 독립 시각 QA 교차 판정 반영(파편 반려 이력 위 참조)

## 최종 아틀라스 후처리 (D11)
- pixel-perfect fit(kCentroid·공유 팔레트) 재추출 후 **정확 팔레트 P-mode 변환(완전 무손실 — RGBA 바이트 동일)**
- 팔레트 56색, 50,169 → 19,403 bytes
- raw 행 불가침 (후처리는 sprite-sheet-alpha.png에만)
