# P7 신규 기획(v1.3 오버라이드) GAP AUDIT + 결정 로그

> 출처: 최신 게임플레이 피드백 대화(v1.3 설계 오버라이드). 기준: HEAD 9222740 + 외부 Codex 감사 diff(전투 시작 방어 보존/회귀 테스트/막 스케일 문서 정정 — 본 단계에서 통합 보존).
> 규약: 질문 없이 합리 결정 + 근거 기록. P6 결정은 v1.3과 충돌하지 않는 범위에서만 존속.
> 상태 어휘: engineering-safe / balance-provisional / experience-unverified.
> 구현 순서: P7.1 쿨다운 행동 모델 → P7.2 슬롯 8·시작 4스킬·세이브 v7 → P7.3 양면 속성 코인 → P7.4 진짜 과열 → P7.5 드로우·임시 코인 → P7.6 튜토리얼/UX → P7.7 검증·배포.

## D1. 행동 모델 — 턴당 3회 캡 폐지 + 스킬별 쿨다운

| 항목 | 내용 |
|---|---|
| 요구 | 턴당 스킬 3회 카운터 완전 제거(다른 카운터로 대체 금지). 코인이 남고 스킬이 가용하면 계속 사용. 스킬별 쿨다운: 반복(기본기)=같은 턴 무제한 / 쿨1=다음 턴 가용 / 쿨2=한 턴 봉인 후 가용 / 쿨3=두 턴 봉인 후 가용. 플레이어 턴 시작에 감소. 전투당 1회는 단일 메커니즘으로 통일, 다음 전투에 리셋 |
| 현재 상태 | `skillUsesThisTurn>=3` 캡(resolve/flip:416, consume:47, commands:59, action-feedback:44, bulk/trace:81) + 슬롯별 `usedThisTurn`(턴당 1회) + `usedThisCombat`(oncePerCombat) |
| 채택 결정 | **`skillUsesThisTurn` 상태 필드 자체를 삭제**(카운터 재도입 여지 제거). `usedThisTurn` 삭제 → `SlotState.cooldownRemaining: number`(0=가용)로 대체. 사용 시 `cooldownRemaining = skill.cooldown`, 플레이어 턴 시작에 `max(0, n-1)`. 검산: 쿨1→사용턴 1, 다음 턴 시작 0(가용) ✓ / 쿨3→3, +1턴 2(봉인), +2턴 1(봉인), +3턴 0(가용) ✓ |
| 쿨다운 데이터 | `SkillDefBase.cooldown?: 0\|1\|2\|3`. **미지정 기본값 = 1**(기존 usedThisTurn=턴당 1회와 동일 케이던스 — 기존 콘텐츠 밸런스 중립 마이그레이션). 기본기(slash/guard/jab/fist-guard)만 명시 0(반복). 검증: 정수 0~3, **oncePerCombat과 cooldown≥1 동시 지정 금지**(중첩 봉인 규칙은 학습 불가 — 콘텐츠 검증 에러) |
| 전투당 1회 | `oncePerCombat` + `usedThisCombat` 유지(이미 전투 단위 리셋 — 슬롯이 전투마다 재생성). "제거(remove-after-use)"류 별도 메커니즘 없음 확인 — 단일화 충족 |
| 쿨다운 감소/리셋 | 원자 `{ kind:'reduceCooldown', amount }` — **자기 슬롯 제외**(기본 비자기대상 요구), 반복(쿨0)·전투당 1회 스킬은 구조적으로 영향 없음(쿨다운 상태가 없으므로 — 요구의 '대상 불가'를 데이터 검증이 아닌 구조로 충족). 대표 스킬 1종(P7.5의 재정비류) |
| 파급 | commands.legalCommands 캡 분기 삭제 → 시뮬 4정책 자동 상속. bulk/trace 검증기에서 카운터 검증 삭제, 쿨다운 범위 검증 추가. UI: skillCap 사유 삭제, `cooldown` 사유("재사용 대기 N턴") 추가, 카드 쿨다운 배지 |
| 무한 루프 안전 | 반복 스킬도 코인 장전이 필수(플립 비용) → 손 코인 유한으로 자연 종결. place/unplace 순환은 기존 봇 가드 유지 |
| 상태 | engineering-safe / balance-provisional |

## D2. 슬롯 8 + 시작 4스킬 + 세이브 v7

| 항목 | 내용 |
|---|---|
| 요구 | 기본 최대 장착 슬롯 8(10은 기본 구현 금지 — 선택적 미래 확장으로만 문서화). 캐릭터 시작 스킬 4: 공용 기본 공격+기본 방어+캐릭터 스킬 2. 워리어=버닝 스트라이크+화염 소비/과열 인에이블러, 아카니스트=마력 충전+명령. 기본기는 반복 사용 가능, 이후 교체 가능. 세이브 v7(v1~v6 안전 마이그레이션), 빈 슬롯 지원 |
| 채택 결정 | `MAX_SKILL_SLOTS = 8` 코어 상수 신설(6 하드코딩 산재 제거: reducer emptyPlaced/slots 생성, run.ts equippedSkills() 6강제, App.tsx slice(0,6), shop 6슬롯 문구, 트레이스). `EquippedSkills = (SkillId\|null)[]` 길이 8 — **빈 슬롯 = null**. `SlotState.skillId: SkillId\|null`(기존 `'' as never` 핵 제거). `UpgradedSlots` 길이 8 |
| 10슬롯 | 구현하지 않음. 확장 시 `MAX_SKILL_SLOTS`만 상향 + 세이브 버전 승격이면 충분한 구조로 설계(본 문서가 확장 경로 정본) |
| 시작 스킬 | warrior: **jab·fist-guard·burning-fist·inner-passion(신규 과열 인에이블러)**. arcanist: **slash·guard·arcane-charge·arcane-command**. guardian: slash·guard·warding-strike·mana-bulwark. sorcerer: slash·guard·spark-strike·chain-surge. frost-knight: slash·guard·frost-slash·glacial-wall. 시작 셋에서 빠진 기존 스킬(ignite/ignite-sword/flame-rampage, aegis-pulse/shield-summon 등)은 보상/상점 풀 존속 |
| 모호성 ① | "공용 기본 공격/방어" vs 워리어 격투 어휘(jab/fist-guard) — **워리어는 격투 ID 유지**(수치·반복성 공용 동일, '주먹 파이터·검 이미지 금지' 브랜드 제약이 문구 우선). 요구는 역할(반복 기본기 2종)로 해석 |
| 기본기 수치 | **v1.3 하향 채택: 공격 4(+앞면 3) / 방어 4(+뒷면 3)** — slash·jab·guard·fist-guard 공통. 근거(EV/코인): 현행 slash 6+4×0.5=8.0/코인이 캡 폐지 후 반복 스팸 시 smash(6.5/코인)·burning-fist(5.5/코인+화염) 등 모든 유료 스킬을 지배. 하향 후 5.5/코인 — 코인 소진용 바닥은 되되 지배 불가. 목표 '반복이 안전하고 유용하되 지배적이지 않게' 충족. 구현 후 시드 스윕으로 재확인. balance-provisional |
| 세이브 v7 | `RUN_SAVE_VERSION = 7`. v6→v7: equippedSkills/upgradedSlots 뒤에 null/false 패딩(6→8), 기존 필드 불변. v1~v5는 기존 체인으로 v6 도달 후 v7 패딩. normalizeRunSave 길이 검증 8 + null 허용(빈 슬롯), 중복 검사는 non-null만 |
| 파급 | createCombat equippedSkills 길이 8 요구(null 허용), startingSkills 4는 런 생성에서 null 패딩. 보상 흐름: 빈 슬롯 존재 시 **빈 슬롯 장착이 기본 제안**(교체는 슬롯 만석 시). rest 강화는 non-null 슬롯만. seed42 골든 재고정 |
| 상태 | engineering-safe / balance-provisional |

## D3. 드로우·임시 코인 지원 (고비용 턴 구성 가능화)

| 항목 | 내용 |
|---|---|
| 요구 | 즉시 드로우·다음 턴 드로우(·선택적 조건 드로우) 공식화. 임시 코인 생성처(버림/뽑기/손) 공식화 — 즉시성에 따라 강도/쿨다운 차등. 4+비용 턴을 실제로 구성할 수 있는 대표 스킬. 버프/지원은 즉시 체감 리턴 필수. 4+비용 스킬 = 강한 기본치 + 드로우/임시 코인/다음 턴 이득/의미 있는 상태 중 1+ |
| 신규 원자 | `{ kind:'draw', count }`(즉시, 뽑기+버림 소진 시 부분 드로우), `{ kind:'nextTurnDraw', count }`(`player.nextDrawBonus`, 다음 턴 시작 드로우에 합산). **턴 시작 총 드로우 상한 8**(5-penalty+bonus를 [0,8] 클램프 — 손 상한 10과 함께 폭주 방지). 조건 드로우는 백로그(조건 어휘가 아직 1종뿐 — 과열 조건 드로우는 과열 소비 규칙과 혼동 위험, 학습성 우선) |
| 임시 코인 계층 | 기존 `addCoin` zone 3종 그대로 — **강도 표준 문서화**: 손(즉시 사용 가능)=최고가(쿨다운↑ 또는 수량↓) > 뽑기(다음 셔플/드로우)=중간 > 버림(리셔플 후)=최저가. 콘텐츠 리뷰 기준으로 사용 |
| 지원 스킬 표준 | 버프/지원(addTurnTrigger·empowerSummons류 포함)은 draw/임시 코인/다음 턴 이득 중 1+ 동반 필수 — 신규 콘텐츠부터 적용, 기존 위반(flame-sword 등)은 P7.5에서 라이더 보강 |
| 4+비용 표준 | 기본치 강력 + 상기 리턴 1+ 필수. conflagration(5): 화상 4 보유 ✓ + nextTurnDraw 1 보강. 신규 4비용 대표 2종(각 캐릭터 축 1): warrior 'meteor-blow'류(대피해+화상+임시 화염), arcanist 4비용 병기 일제(소환+드로우) — 구체 수치는 콘텐츠 커밋 |
| 대표 신규 | 공용 'battle-focus'(전투 집중: 1비용, draw 2, 쿨2 — 고비용 턴 셋업), 공용 'coin-mint'류(임시 기본 코인 손 2, 쿨2), 재정비(reduceCooldown 1 + draw 1, 쿨3) — 수량 절제(풀 희석 방지) |
| 상태 | engineering-safe / balance-provisional |

## D4. 양면 속성 코인

| 항목 | 내용 |
|---|---|
| 요구 표 | fire: 앞 화상1/뒤 피해1 · mana: 앞 방어1/뒤 방어2 · frost: 앞 동상1/뒤 방어1 · electric: 앞 감전1/뒤 피해1 · blood: 앞 회복1/뒤 방어1. 모든 속성 코인이 앞뒤 고유 효과. 특수 코인·약화·취약 도입 금지 |
| 현재 상태 | 4속성(fire/mana/frost/lightning) 전부 **앞면 단면 proc만**. blood는 Element 유니언에 예약만 존재(코인·회복 원자 없음) |
| 채택 결정 | `CoinDef.proc`(단면) → **`procs?: { heads?: EffectAtom[]; tails?: EffectAtom[] }`** 스키마 교체(콘텐츠·검증·flip 해석·UI 문구·심 전면 갱신). 표 그대로 구현. **electric = 기존 lightning id 유지**(id 마이그레이션은 세이브/골든 전방위 위험 — 표시명 '감전/전기'로 충족, 모호성 기록). **blood 코인 신설**(피의 코인) + `{ kind:'heal', amount }` 원자 신설(플레이어 hp, maxHp 상한, `healed` 이벤트). mana 기존 앞면 방어2 → 앞1/뒤2로 조정(표 우선 — 기대값 1.5로 하향이나 양면 신뢰성이 보상, balance-provisional) |
| 대상 규칙 | 단일 대상 스킬→그 적 / 전체 스킬→**모든 생존 적에 각각**(스킬 본체·면 효과·공격형 proc 모두) / 자기·무대상 스킬+공격형 proc→현재 선택 적(cmd.target) **필수**, 미지정·사망 대상은 코인·쿨다운·과열을 소비하지 않고 거부 / mana·blood 우호 효과→스킬 대상 무관 플레이어 |
| 소비 규칙 | 소비(플립 없음)는 면 보너스도 속성 고유 proc도 발동하지 않음 — **현행 엔진이 이미 충족**(proc은 resolveFlip의 플립된 코인에만). 회귀 테스트로 계약 고정 |
| 드래프트 가치 | 비시그니처 속성도 단독 가치: blood(회복/방어)·mana(방어 양면)는 전 캐릭터 방어/유지 픽, frost(동상/방어)·lightning(감전/피해) 공격 보조 픽. 코인 보상 가중에 blood 편입(전 캐릭터 비시그니처 가중) |
| 파급 | preview 축 heal 추가, coin-info.ts 앞/뒤 2행 문구, 키워드 툴팁, content.test/validate(procs 면별 검증), CONTENT_VERSION '1.2.0-p7' 승격+레거시 목록 편입 |
| 상태 | engineering-safe / balance-provisional |

## D5. 진짜 과열(Overheat)

| 항목 | 내용 |
|---|---|
| 요구 | damagePerFireInHand(가짜 과열) 대체/보강. 화염 코인 소비로 과열 진입, 비중첩, 턴 넘어 지속, 비과열 스킬은 소비 안 함, 과열 강화 분기 보유 스킬이 성공 해결되면 해결 후 소비, 취소/불법 사용은 비소비, 중복 진입 무스택 |
| 채택 결정 | `PlayerState.overheat: boolean` + 원자 `{ kind:'enterOverheat' }`(중복 진입 no-op, `overheatEntered` 이벤트는 최초만). `SkillDefBase.overheatBonus?: EffectAtom[]` — 해결 시 과열이면 기본 효과 뒤에 추가 적용, **해결 완료 후 overheat=false + `overheatConsumed` 이벤트**. 플립·소비 스킬 공통 지원. step 오류 경로는 상태 불변(기존 clone-and-return 구조가 비소비 요구를 자연 충족) |
| 가짜 과열 정리 | **`damagePerFireInHand` 원자 삭제**(재사용처 없는 오해 표면 — 삭제 우선 원칙). overheat-strike(과열권)=쿨1·기본 피해+overheatBonus, overheat-vent(배기 폭발)=전투당 1회·대형 overheatBonus로 재설계 |
| Inner Passion | '내면의 발화'(inner-passion, warrior 시작): **소비 fire×1, 쿨3, enterOverheat + draw 1**. 모호성 ②: 원 대화가 소비(무플립) 스킬에 앞/뒤 보너스를 병기 — **소비는 플립하지 않는다는 전역 규칙 우선, 면 보너스 폐기**(규칙 학습성 보존). 체감 리턴은 D3 표준에 따라 draw 1로 대체 |
| Fire Fist | '화염 정권'(fire-fist, warrior): 플립 2비용, 기본 피해 10, overheatBonus 피해 +4(=14), 임시 화염 1 뽑기 더미, 쿨1, 앞면당 +1. "화염 코인 앞면 +2"는 신규 `elementFaces?: [{ element, face, mode:'per', effects }]`로 화염 앞면에 **추가 +1**(일반 앞면 +1과 합산 = +2 — 표 수치 그대로, 이중 계산 아님) |
| 학습 규칙 요약(툴팁 정본) | "화염 코인을 소비하면 과열. 과열은 하나만, 턴이 지나도 유지. 과열 강화 스킬을 성공시키면 소모" |
| 파급 | preview 과열 분기(현재 상태 기준 계산 — 과열 여부는 입력 상태에 이미 있음), UI 플레이어 상태 칩(과열 배지)+스킬 카드 과열 분기 표시, 심 트레이스 |
| 상태 | engineering-safe / balance-provisional / experience-unverified(과열 손맛) |

## D6. 튜토리얼/UX

- 기존: 비영속 hint-strip 2단뿐(App.tsx:2057, 3315) — 영속 온보딩 부재.
- 결정: **점진·문맥 튜토리얼 카드 5종**(모달 일괄 금지). 트리거: ① 첫 전투 시작(기본 루프: 장전→사용→턴 종료) ② 첫 쿨다운 진입/전투당 1회 잠금 관찰 ③ 손에 첫 속성 코인 ④ 첫 속성 proc 발동(양면·대상 규칙) ⑤ 첫 소비 스킬 연료 선택(무플립 규칙). localStorage `deckbuilding-roguelite.tutorial.v1` seen-키 영속(런 세이브와 분리 — 세이브 스키마 오염 방지). 기존 hint-strip 패턴/aria-live 계승, dismissible, reduced-motion 존중.
- 공식 한국어 용어(정본): **쿨다운**(배지 "쿨 N"), **전투당 1회**, **반복**(기본기), **과열**, **앞면/뒷면**, **소비**(플립 없음). keywords.tsx 글로서리에 쿨다운/과열/회복 추가.
- 스킬 카드: 쿨다운 잔여 배지 + 비활성 사유 툴팁(rejectionReason에 cooldown 사유), 반복 스킬 표기, 과열 분기 미리보기.
- 코인 툴팁: 앞/뒤 2행 효과 + 대상 규칙 1행. 반응형(390×844)·접근성 기존 계약 유지.
- 상태: engineering-safe / experience-unverified.

## D7. 문서/브랜드/구조

- **기획 위계(마인드맵)**: 브랜드 코어(코인 플립 도박수·픽셀 톤·주먹 파이터) → 코어 루프(장전→플립→해결→턴) → 전투 엔진(쿨다운·양면 코인·과열·소환) → 빌드 구성(8슬롯·코인 가방·패시브·강화) → 런 구조(3막×10방문·노드·경제) → 콘텐츠(캐릭터 5·스킬·적·이벤트) → UX/튜토리얼(점진 학습·툴팁·접근성) → 프로덕션 기반(결정론 심·세이브 마이그레이션·CI/배포 게이트).
- **Docs형 vs Sheets형 관리 구분**(Markdown 정본, Google Drive 불변): Docs형(서사·규칙 산문)=PRD/*.md, docs/content-design-guide.md, 본 결정 로그. Sheets형(데이터·밸런스 표)=packages/content/src/index.ts가 SSoT(코드가 시트), 파생 표는 PRD/P*_BALANCE_EVIDENCE.md에 스냅샷. 신규 표 편집 흐름 도입 없음(코드 SSoT 유지가 결정론·검증 게이트와 정합).
- **브랜드 권고**: 내부 설계 브랜드로 **Coin Combat(코인 컴뱃)** 채택 권고 — 전투 정체성(코인 플립)이 유일 차별점이며 모든 시스템 어휘가 코인에 수렴. 단, **리포지토리/라이브 제품 개명은 하지 않음**(URL·세이브 키·배포 경로 파급 대비 이득 없음). 후속 마케팅 결정 시점까지 문서 어휘로만 사용.

## D8. 검증/완료 계약

- 신규 규칙별 단위/통합: 쿨다운 감소 시점·반복 스킬 다회 사용·전투당 1회 리셋·8슬롯/빈 슬롯·v6→v7(및 v1→v7 체인) 라운드트립·양면 proc 면별/대상별·소비 무proc 계약·과열 진입/지속/소비/비소비·draw/nextTurnDraw 클램프.
- 시뮬: 결정론(A=A) 유지, 시드 스윕으로 기본기 하향 후 지배도(기본기 사용 비중)·클리어율 비교, 스톨 진단 상한 재확인.
- UI: 데스크톱+390×844 실플레이 스크린샷, 접근성/성능 게이트, 배포 SHA/live smoke.
- 밸런스·재미는 balance-provisional / experience-unverified 유지 — 봇 증거만으로 재미 주장 금지.

## D9. 구현 중 감사 보정·발견 (P7 구현 세션)

- **감사 보정 반영**: ① 자기·무대상 스킬에 공격형 속성 동전이 장전되면 살아 있는 적을 명시 선택해야 하며, 누락/사망 대상은 상태 불변으로 거부한다. ② 전체 대상 스킬의 본체·면 효과와 공격형 proc은 모든 생존 적 각각에 적용한다(진짜 AoE). ③ 손 상한 10을 드로우와 addCoin(hand)이 단일 상수 `HAND_LIMIT`로 공유한다. ④ 슬롯 상수 단일 정본 `MAX_SKILL_SLOTS`를 저장 검증까지 공유한다. ⑤ reduceCooldown은 반복·전투당 1회·자기 슬롯을 명시 제외한다. ⑥ 피해 전용 과열 보너스는 기본 피해와 같은 타격으로 합산한다. ⑦ 빈 슬롯은 강화될 수 없다. ⑧ 화염 정권의 임시 코인은 결정타 여부와 무관하게 생성되도록 피해 전에 처리한다.
- **블록 스톨 발견 (balance-provisional)**: 캡 폐지 + 반복 방어 기본기(4+3)로 방어형 봇(turtle/수호자·냉기 기사)이 적 피해를 영구 상회 — 시드 스윕에서 4,000턴+ 비종결 관측(20,000 커맨드 상한 재검증). 심 계약은 유지(비종결 트레이스 캡·무결성 0 위반). 사람 기준 실사용 확률은 낮으나 **불사 전략 자체는 실재** — 후보 완화책(적 격앙 램프/기본 방어 하향/스톨 상한)은 밸런스 게이트로 이관, 이번 단계 미적용(골든 churn·v1.3 반복 기본기 요구 우선).
- **v6→v7 마이그레이션 정책**: P7이 시작 셋을 바꿨으므로(6→4종) 구 로드아웃의 진행 중 런은 changedSlots 적대 검증 상한을 넘어 **격리(quarantine)+새 런**으로 회복될 수 있다 — P6 시작 셋 교체 때와 동일 정책(부분 손실 수용, 파손 없는 복구 우선).

## 결정된 모호성 요약 (v1.3 미명시 → Fable 설계)

1. 쿨다운 미지정 기본값 = 1(기존 턴당 1회 케이던스 중립 이관). 2. oncePerCombat+cooldown 동시 지정 금지. 3. reduceCooldown은 자기 슬롯 제외·반복/전투당1회는 구조적 비대상. 4. 워리어 기본기 = jab/fist-guard 격투 ID 유지(공용 역할 충족). 5. 기본기 수치 v1.3 하향 채택(EV/코인 지배도 근거). 6. electric = lightning id 유지(표시명만 전기 계열). 7. blood 코인 신설 + heal 원자(플레이어 전용). 8. mana 앞면 proc 2→1 하향(표 우선). 9. 전체 대상 스킬의 공격형 proc = 모든 생존 적 각각. 10. Inner Passion 면 보너스 폐기(소비=무플립 전역 규칙 우선) + draw 1 보상. 11. Fire Fist '화염 앞면 +2' = 일반 +1과 합산 구현(elementFaces 추가 +1). 12. damagePerFireInHand 원자 삭제(대체 완료 후). 13. 턴 시작 드로우 상한 8. 14. 조건 드로우 백로그. 15. 10슬롯 미구현(문서 확장 경로만). 16. 튜토리얼 영속은 localStorage 별도 키(세이브 스키마 분리). 17. skillUsesThisTurn 필드 삭제(통계 대체 카운터도 미도입 — 요구 자구 우선). 18. 과열 피해 보너스는 기본 피해와 단일 타격 합산(D9 ⑥). 19. 구 로드아웃 진행 런은 격리+새 런 회복(D9 정책). 20. 블록 스톨 완화는 밸런스 게이트 이관(D9).
