# QA 노트 — mage (P4.6)

## Base Lock Gate
- 프롬프트: prompt-kit-validation/base.refined.txt — check_prompt.mjs ok=true·errors 0 (생성 전 검증, skill-repos 기능 검증기)
- 생성: codex image_gen, session id: 019f53f6-0ee8-7cb1-9083-5a2ecfa5d9d6
- base-source.png md5: 6381dc38db8050522824f18fb68d38a7 (prepare --force 최종본 재계산)
- 판정: 전신·왼쪽 향·16비트 스타일 일치·마젠타 클린·단일 포즈 — LOCK (독립 검증 교차 판정 포함)
- 독립 판정 PASS-CONDITIONAL: 지팡이 화염 구슬이 갈래 안에서 분리돼 보임 — 행 프롬프트에서 물리 부착 보석/화염 캡으로 명시(추출 단일 연결체 보장).

## 행 생성 (기록 예정)

## 행 생성 (component-row, 킷 선검증 전 행 ok=true·0E)
- idle session id: 019f5408-3d04-7510-85cb-cbf88b7cb53a
- attack session id: 019f5408-3d4a-7d72-8e5b-6e0a1a184aed
- hurt session id: 019f540c-f714-7ab2-ab0c-03c7cce2e944
- 반려/재생성 이력: 전 행 2세대(1차 불꽃 분리·슬롯 근접 반려 — 강화 문구 재생성), hurt 3세대(임팩트 광선 반려)
- 크로마: 마젠타 명시 고정 (prepare auto 선택이 base 기준 cyan을 고르는 결함 우회 — mage/boss 추출 실패 원인이었음)

## 모션 QA (BLOCKING 통과)
- idle 루프 심리스(1·4 동일)·attack 와인드업→타격→회수·hurt 반동→복귀 — 컨택트 시트/GIF 검토, 정체성 12프레임 일관
- 독립 시각 QA 교차 판정 반영(파편 반려 이력 위 참조)

## 최종 아틀라스 후처리 (D11)
- pixel-perfect fit(kCentroid·공유 팔레트) 재추출 후 **정확 팔레트 P-mode 변환(완전 무손실 — RGBA 바이트 동일)**
- 팔레트 62색, 63,782 → 24,765 bytes
- raw 행 불가침 (후처리는 sprite-sheet-alpha.png에만)
