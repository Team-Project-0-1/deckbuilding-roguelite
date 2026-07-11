// 이벤트 화면 — 순수 프레젠테이션 (D10). 비용·보상·불가 사유 진실은 코어
// pendingEvent/acceptEvent가 소유하고, 이 컴포넌트는 props로만 받는다.
// emoji 금지 — 픽셀 폰트 안전 텍스트만.

export interface EventCoinPick {
  bagIndex: number;
  name: string;
  visualClass: string;
  pickable: boolean;
}

interface EventScreenProps {
  name: string;
  prompt: string;
  riskLine: string;
  rewardLine: string;
  /** 기본 코인 직접 선택이 필요한 이벤트(제단·희생)의 후보 — 아니면 null */
  coinPicks: EventCoinPick[] | null;
  selectedPick: number | null;
  acceptLabel: string;
  acceptDisabled: boolean;
  disabledReason: string | null;
  rejection: string | null;
  onPick: (bagIndex: number) => void;
  onAccept: () => void;
  onDecline: () => void;
}

export const EventScreen = ({
  name,
  prompt,
  riskLine,
  rewardLine,
  coinPicks,
  selectedPick,
  acceptLabel,
  acceptDisabled,
  disabledReason,
  rejection,
  onPick,
  onAccept,
  onDecline,
}: EventScreenProps) => (
  <section aria-label="이벤트" className="event-screen" data-testid="event-screen">
    <h2>{name}</h2>
    <p className="event-prompt">{prompt}</p>
    <dl className="event-terms">
      <div>
        <dt>위험</dt>
        <dd data-testid="event-risk">{riskLine}</dd>
      </div>
      <div>
        <dt>보상</dt>
        <dd data-testid="event-reward">{rewardLine}</dd>
      </div>
    </dl>
    {rejection === null ? null : (
      <p className="event-rejection" role="status">
        {rejection}
      </p>
    )}
    {coinPicks === null ? null : (
      <div className="event-coin-picks" data-testid="event-coin-picks">
        <p>대상 기본 코인을 고릅니다.</p>
        <ul>
          {coinPicks.map((coin) => (
            <li key={coin.bagIndex}>
              <button
                className={`event-pick ${selectedPick === coin.bagIndex ? "picked" : ""}`}
                data-testid={`event-pick-${coin.bagIndex}`}
                disabled={!coin.pickable}
                onClick={() => onPick(coin.bagIndex)}
                type="button"
              >
                <span
                  aria-hidden="true"
                  className={`pop-coin ${coin.visualClass}`}
                />
                {coin.name}
              </button>
            </li>
          ))}
        </ul>
      </div>
    )}
    <div className="event-actions">
      <button
        data-testid="event-accept"
        disabled={acceptDisabled}
        onClick={onAccept}
        type="button"
      >
        {acceptLabel}
      </button>
      <button
        className="secondary-action"
        data-testid="event-decline"
        onClick={onDecline}
        type="button"
      >
        지나친다
      </button>
    </div>
    {disabledReason === null ? null : (
      <p className="event-disabled-reason" data-testid="event-disabled-reason">
        {disabledReason}
      </p>
    )}
  </section>
);
