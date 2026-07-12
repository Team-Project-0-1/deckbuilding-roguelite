# 마도기사 (arcanist 신규) — P6 D6 sprite-gen 런 QA 노트

- 판타지: 성인 마도기사 — 검은 장발, 네이비 아카데미 학생복, 마도서, 우향. 갑옷/실물 무기 없음, 성적 과장 배제.
- Base Lock 게이트: v1 **FAIL** (손에서 분리된 대형 부유 마법진 — 추출 컴포넌트 오염 위험, P4.6 교훈).
  이펙트 어휘 전면 제거(몸·옷·책만) 후 v2 재생성 → **PASS**. v1 원본은 스크래치 기각 기록.
- 크로마: 마젠타 #FF00FF 명시 핀 (네이비/블루 소재).
- 프롬프트 킷: base + idle/attack/hurt 정련본 전부 ok=true·0E.
- 추출: pixel_perfect(동일 레시피), 상태당 4컴포넌트 정상, ok=true.
- 아틀라스: exact-palette P-mode 무손실 56,581→23,048B.
- 모션 QA: idle=독서 호흡 루프 PASS / attack=독서→손 들기→지시 명령→복귀 PASS / hurt=책 감싸 움찔→회복 PASS.
- 생성 세션 SID (image_gen provenance):
  - base(v1 기각): 019f556f-1751-7542-a032-8bcf2ed066f0
  - base: (v2 재생성 — genarc2.sh, gen.log arcanist-v2)
  - idle: 019f5576-bb04-7163-986f-8e553622d055
  - attack: 019f5577-db56-7ca2-a472-5961c8d924ed
  - hurt: 019f5577-db4c-70c2-93fc-2853bf9f0f8f
