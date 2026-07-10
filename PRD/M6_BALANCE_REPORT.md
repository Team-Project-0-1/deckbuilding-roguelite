# M6 밸런스 자동 보고서

> 결론: **수치 변경 없음.** 이 문서는 봇의 기계적 사실과 재현 가능한 경고를 남기지만, 재미·체감 밸런스 또는 Phase 3 진입을 판정하지 않는다.

## 재현 계약

```text
pnpm sim:balance
```

- 스키마: `m6-balance-report-v1`
- base seed: `1`
- baseline 정책별 125런 × 4정책 = 총 500런
- CRN: GreedyEV 20쌍, `baseline`(fire-first) 대 `basic-first`
- 출력: compact JSON 한 줄(episodes/transcripts 제외)
- 동일 명령 2회 출력: 각 11,023 bytes, byte-identical
- 전체 명령 출력 SHA-256: `af430ad12f8c223f19e3ca72a4f7b56d6fb81eaf112abbeb3544c4f115d34cbc`
- JSON 한 줄 SHA-256(줄바꿈 포함): `af38159ee0da5ef7f6487a2fb107d9fa39b2c071b8a760f290f7c5f9c5e3b0ce`

옵션 표본이 필요하면 `--seed`, `--games-per-policy`, `--crn-games`를 명시한다. 기본값만 이 문서의 고정 표본이다.

## 기계적 봇 사실

### 전체 결과

| runs | terminal | victory | defeat | crash | invariant violation | completed combat |
| ---: | -------: | ------: | -----: | ----: | ------------------: | ---------------: |
|  500 |      500 |     274 |    226 |     0 |                   0 |    2,054 / 2,500 |

승률·완료 전투 수는 정책 기준선과 런 조기 패배가 섞인 관측값이며 자동 밸런스 게이트가 아니다.

### 정책 × 적 결과와 턴 분포

`W/L/N`은 해당 적 전투의 승리/패배/비종료 수다. 모든 p50/p99는 nearest-rank다.

| 정책     | 적              | 전투 | W/L/N   |  mean | p50 | p99 | max |
| -------- | --------------- | ---: | ------- | ----: | --: | --: | --: |
| Aggro    | gatekeeper      |  125 | 125/0/0 | 2.976 |   3 |   4 |   5 |
| Aggro    | gatekeeper-plus |   95 | 24/71/0 | 2.221 |   2 |   4 |   4 |
| Aggro    | raider          |  125 | 125/0/0 | 3.128 |   3 |   4 |   4 |
| Aggro    | raider-plus     |  125 | 95/30/0 | 2.736 |   3 |   3 |   3 |
| Aggro    | shaman          |  125 | 125/0/0 | 2.688 |   3 |   3 |   3 |
| GreedyEV | gatekeeper      |  125 | 125/0/0 | 3.360 |   3 |   5 |   6 |
| GreedyEV | gatekeeper-plus |  125 | 125/0/0 | 4.016 |   4 |   5 |   6 |
| GreedyEV | raider          |  125 | 125/0/0 | 3.360 |   3 |   4 |   5 |
| GreedyEV | raider-plus     |  125 | 125/0/0 | 2.976 |   3 |   4 |   4 |
| GreedyEV | shaman          |  125 | 125/0/0 | 2.736 |   3 |   4 |   4 |
| Random   | gatekeeper      |   19 | 1/18/0  | 4.263 |   3 |  10 |  10 |
| Random   | raider          |  125 | 64/61/0 | 7.792 |   8 |  11 |  12 |
| Random   | raider-plus     |    1 | 0/1/0   | 1.000 |   1 |   1 |   1 |
| Random   | shaman          |   64 | 19/45/0 | 4.984 |   5 |  10 |  10 |
| Turtle   | gatekeeper      |  125 | 125/0/0 | 4.416 |   4 |   6 |   6 |
| Turtle   | gatekeeper-plus |  125 | 125/0/0 | 4.816 |   5 |   7 |   7 |
| Turtle   | raider          |  125 | 125/0/0 | 4.008 |   4 |   5 |   5 |
| Turtle   | raider-plus     |  125 | 125/0/0 | 4.936 |   5 |   7 |   7 |
| Turtle   | shaman          |  125 | 125/0/0 | 2.960 |   3 |   4 |   4 |

### 정책별 플립 대 소비

직접 가치는 `직접 피해 + 방어 획득`이며 화상 스택은 별도 축이다. `소비 우세 seed`는 같은 정책의 한 에피소드 안에서 소비 직접 가치가 플립 직접 가치보다 큰 횟수다.

| 정책     | flip 사용/직접가치 | consume 사용/직접가치 | consume 사용 점유 | consume 가치 점유 | 소비 가치 우세 seed |
| -------- | -----------------: | --------------------: | ----------------: | ----------------: | ------------------: |
| Aggro    |     3,650 / 32,082 |           853 / 8,329 |             0.189 |             0.206 |             0 / 125 |
| GreedyEV |     4,694 / 40,160 |           952 / 8,983 |             0.169 |             0.183 |             0 / 125 |
| Random   |      1,414 / 7,317 |           374 / 3,608 |             0.209 |             0.330 |            12 / 125 |
| Turtle   |     6,794 / 51,612 |           829 / 7,468 |             0.109 |             0.126 |             0 / 125 |

이 봇 표본에서는 소비가 전체 빈도나 직접 가치에서 플립을 지배하지 않는다. 그러나 이것은 사람의 “소비를 강제당한다”는 체감 질문을 닫지 않는다.

### Gatekeeper 정확 시퀀스 수렴과 이상 항목

- exact command-sequence convergence: 70회 / 고유 episode 70개
- 적: `gatekeeper` 70회, `gatekeeper-plus` 0회
- 정책 조합: `aggro + greedy` 70회
- 전체 anomaly occurrence/seed: 70 / 70
- anomaly kind: `gatekeeperPolicySequenceConvergence` 70회
- global anomaly: 0

수렴은 같은 episode·variant·combat·enemy와 **완전히 같은 command key 배열**일 때만 센다. 근사 유사도나 결과만 같은 전투는 포함하지 않는다. 보고서 JSON은 재현을 위해 70개 episode index를 정렬해 보존한다.

### fire-first 대 basic-first CRN

| 항목                                      | 결과                                          |
| ----------------------------------------- | --------------------------------------------- |
| 정책 / 쌍                                 | GreedyEV / 20                                 |
| A=A                                       | true, 3,468,056 bytes, fingerprint `2ef3ebfd` |
| fire-first                                | 20/20 terminal, 20승                          |
| basic-first                               | 20/20 terminal, 19승                          |
| 같은 결과                                 | 19/20                                         |
| fire-first만 승리 / basic-first만 승리    | 1 / 0                                         |
| 평균 최종 HP Δ (basic-first - fire-first) | -2.45                                         |
| 평균 완료 전투 Δ                          | 0                                             |
| CRN anomaly seed                          | 0                                             |

공통 combat/reward stream 검증을 통과한 기존 증거를 compact report에 재수록했다. 작은 차이는 결함이나 수치 조정 방향을 증명하지 않으며 report-only다.

## 정보성 목표 대역

| 지표             | 참고 대역 |        관측 | 대역 비교 | 자동 게이트 |
| ---------------- | --------- | ----------: | --------- | ----------- |
| 전체 평균 턴     | 4~7       |       3.761 | 밖        | 아니오      |
| 적별 평균 턴     | 3~7.5     | 3.114~4.572 | 안        | 아니오      |
| 속성 코인 활용률 | ≥0.60     |       0.514 | 밖        | 아니오      |
| 화상 피해 기여   | 0.15~0.35 |       0.103 | 밖        | 아니오      |

이 비교는 사람 데이터의 최종 판정을 대신하지 않는다. 특히 Random은 많은 조기 패배로 후반 적 표본 수가 작다.

## 경고(모두 report-only)

1. Gatekeeper에서 Aggro/GreedyEV의 정확 시퀀스 수렴이 70/125 episode에 관측됐다.
2. Aggro 승률 0.192와 GreedyEV 승률 1.000 사이 정책 격차가 크다.
3. basic-first는 fire-first보다 평균 최종 HP가 2.45 낮았다.
4. 소비 우세 가능성은 사람 체감 질문으로 유지한다. 봇 직접 가치에서는 이번 표본상 활성 경고가 아니었다.

## 사람에게 남은 질문과 Phase 3 보류

- M2/M4/M5의 손맛·갈등·런 보상이 실제 플레이에서 의도대로 느껴지는가?
- 사람 N≥5 로그에서도 §8.3 지표와 정성 반응이 수용 가능한가?
- 소비가 플립보다 강제되거나 우월하다고 느껴지는가?
- 문지기 행동 반복이 단조롭게 느껴지는가?
- 사람 로그로 참고 대역을 확정할 수 있는가?

위 질문과 기존 사람 검증이 미완료이므로 **Phase 3는 blocked**다.

## 튜닝 결정

현재 자동 증거는 어떤 수치를 어느 방향으로 바꿔야 하는지 특정하지 못한다. 정책 차이, 참고 대역 이탈, 작은 CRN 차이만으로 수치를 바꾸면 근거 없는 튜닝이 된다. 따라서 M6 T6.4의 결론은 **numeric content change = none**이며, 수치 조정은 사람 데이터 이후로 이연한다.
