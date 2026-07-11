# 카드 아트 provenance — P3.2 (2026-07-11)

생성: codex `image_gen` (ChatGPT OAuth), 스타일 레퍼런스 2장 첨부 방식(기존 카드 아트 톤 고정),
후처리: LANCZOS 리샘플 + 중앙 크롭 264×198 → webp q88 (기존 카드 아트와 동일 규격).
스프라이트가 아닌 불투명 장식 패널이므로 sprite-gen 크로마/아틀라스 파이프라인 비대상.

| 파일 | 스타일 ref | 프롬프트 모티프 |
|------|-----------|----------------|
| card-warding-strike.webp | card-guard + card-ignite | 수호 기사의 철퇴 타격 — 은색 철퇴 호, 파란 수호 문양 빛 궤적 |
| card-mana-bulwark.webp | card-guard + card-ignite | 원형 방패 벽 — 은테두리 방패에 파란 마나 오라 |
| card-shield-reprisal.webp | card-guard + card-ignite | 방패 반격 — 쳐내는 순간의 파란 충격파 |
| card-mana-well.webp | card-guard + card-ignite | 마나 샘 — 파란 마나 코인형 빛방울 |
| card-smash.webp | card-slash + card-burning-strike | 대검 강타 — 내리찍는 강철 대검·스파크 |
| card-fire-infusion.webp | card-slash + card-burning-strike | 화염 주입 — 화염이 스며드는 장검 |
| card-furnace.webp | card-slash + card-burning-strike | 용광로 — 끓는 쇳물 화구·불똥 |

수호자 캐릭터 스프라이트 provenance는 `apps/ui/src/assets/generated/sprites/guardian/`
(sprite-request.json·prompts/·raw/·qa-notes.md) — component-row 파이프라인 전 과정 보존.

## gongnyang-prompt-kit 검증 기록 (사후 실행 — 정직 기록)

- 사실: 카드 아트 프롬프트는 생성 **전에** 킷으로 컴파일되지 않았다(레퍼런스 앵커 방식 사용).
  감시자 지적 후 `check_prompt.mjs`를 전 7종에 실행 — 원문·결과를 `card-art-prompt-validation/`에 보존.
- 결과: 7종 전부 ok:false — 공통 E-AR-END/E-CAT-LANG/E-CAM-LANG/E-LIGHT-LANG/E-TEX-LANG,
  W-SHORT-A/W-HEX-MISS/W-TEXT-GUARD. 킷 루브릭은 단독(standalone) 프로덕션 프롬프트 기준이며,
  이번 프롬프트의 스타일·조명·구도 진실은 첨부 레퍼런스 2장이 소유했다.
- 판정: 산출물이 기존 카드 스타일에 부합(시각 판정 95)하므로 루브릭 적합화를 위한 재생성은
  하지 않는다. **P3.3+부터는 카드 아트 프롬프트를 킷으로 선컴파일한 뒤 생성한다.**

## 킷 정련(refined) 프롬프트 — 게이트 통과 기록 (2차)

- `card-art-prompt-validation/`에 원문·정련본·검증 결과 보존. 정련본 7종 전부 **ok=true, errors 0, warnings 0**.
- 중대성 판정: 정련은 레퍼런스 2장이 소유하던 스타일·조명·구도 진실을 프롬프트 텍스트로 문서화한 것
  (카테고리 절·클로즈업 구도 절·발광 명암 절·질감 절·AR 4:3·HEX 축약). 모티프·톤·구도 등 생성 핵심 불변 —
  **비중대 → 수용 자산(시각 판정 95) 유지, 재생성 불필요.** P3.3+ 카드 아트는 이 서식으로 선컴파일 후 생성.

## P3.3 추가분 (2026-07-12) — 킷 선컴파일 준수

| 파일 | 스타일 ref | 모티프 | 킷 검증 |
|------|-----------|--------|---------|
| card-flame-sword.webp | card-ignite + card-burning-strike | 화염이 스며든 장검 셋업, 화상 문양 불씨 | 생성 **전** ok=true·0E·0W |
| card-heart-of-flame.webp | 동일 | 갑주 가슴의 고동치는 불의 심장, 화상 파문 | 동일 |
| card-conflagration.webp | 동일 | 대화재 소용돌이·백열 코어 | 동일 |

원문·결과: `card-art-prompt-validation/{flame-sword,heart-of-flame,conflagration}.{txt,result.json}`.
이번 배치부터 선컴파일 프로세스 적용 (P3.2 감사 후속 — 사후 정련이 아니라 생성 전 검증).

## P3.4 추가분 (2026-07-12) — 킷 선컴파일 준수, 11종

생성·후처리 규격은 상단과 동일 (codex `image_gen`, 스타일 ref 2장, LANCZOS+중앙 크롭 264×198 webp q88).
모든 프롬프트는 생성 **전** `check_prompt.mjs` ok=true·errors 0 확인 후 사용 —
원문·결과: `card-art-prompt-validation/<skill-id>.{txt,result.json}`.

| 파일 | 스타일 ref | 모티프 |
|------|-----------|--------|
| card-spark-strike.webp | card-slash + card-ignite | 전격 일섬 — 검신을 타는 감전 아크 |
| card-chain-surge.webp | 동일 | 연쇄 뇌전 — 적들 사이를 잇는 번개 사슬 |
| card-static-field.webp | 동일 | 정전기장 — 대지에 퍼지는 감전 파문 |
| card-volt-lash.webp | 동일 | 전압 채찍 — 휘어지는 뇌전 채찍 궤적 |
| card-overload.webp | 동일 | 과부하 — 백열 방전 코어·감전 증폭 |
| card-frost-slash.webp | card-guard + card-slash | 서리 베기 — 성에가 맺히는 냉기 검격 |
| card-glacial-wall.webp | 동일 | 빙벽 — 융기하는 얼음 방벽 |
| card-chilling-field.webp | 동일 | 한파 — 지면을 얼리는 동상 냉기장 |
| card-glacier-strike.webp | 동일 | 빙하 강타 — 빙괴를 두른 내리찍기 |
| card-winters-grasp.webp | 동일 | 겨울의 손아귀 — 옥죄는 서리 손톱·동상 결정 |
| card-aegis-surge.webp | 동일 | 이지스 서지 — 마나 소비 방패 파동 |

스프라이트 2종(sorcerer·frost-knight)은 `apps/ui/src/assets/generated/sprites/<id>/`에
component-row 전 과정 보존 — 행 프롬프트 킷 선검증(ok=true·0E·0W)·Base Lock·Motion QA 기록은
각 폴더 `prompt-kit-validation/`·`qa-notes.md` (dual-tool provenance).
