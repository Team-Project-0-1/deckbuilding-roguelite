# 화염 격투가 (warrior 시각 교체) — P6 D5 sprite-gen 런 QA 노트

- 판타지: 성인 여성 화염 격투가 '여울' — 붉은 단발 톰보이, 짙은 태닝, 우향, 불꽃 붕대/너클. 노출 절제.
- Base Lock 게이트: PASS (전신·단일 idle·우향·그린 크로마 클린·분리 이펙트 없음·픽셀 밀도 일관).
- 크로마: **그린 #00FF00 명시 핀** — 적발·웜톤 소재라 마젠타/시안 충돌 회피 (P6 D7 분기 게이트).
  prepare의 auto가 cyan을 골라 요청·프롬프트 사후 핀으로 교정 (P4.6 마젠타 핀과 동일 처치).
- 프롬프트 킷: base + idle/attack/hurt 정련본 전부 ok=true·0E (prompt-kit-validation/*.refined.result.json).
- 추출: pixel_perfect(kCentroid·foot-centroid·logical_height 86·palette 32), 상태당 4컴포넌트 정상, ok=true.
- 아틀라스: exact-palette P-mode 무손실 변환(RGBA 바이트 동일 검증) 56,634→23,087B.
- 모션 QA (컨택트 시트+GIF 검수): idle=호흡 가드 루프 PASS / attack=가드→윈드업→스트레이트→회수 PASS /
  hurt=움찔→웅크림→회복 PASS. 분리 이펙트·가이드 흔적·정체성 드리프트 없음.
- 생성 세션 SID (image_gen provenance):
  - base: 019f556f-16b7-7590-b857-5117dd10b048
  - idle: 019f5576-baa0-7811-9379-61a3aafb3f0a
  - attack: 019f5576-bae0-7fe2-a253-5d0c08e049b8
  - hurt: 019f5576-ba15-7342-95e2-d99fdbfcbfbe
