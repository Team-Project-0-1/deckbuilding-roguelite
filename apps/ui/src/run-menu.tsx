import { useEffect, useRef, useState } from "react";

import { OverlayPortal } from "./overlay";

interface RunMenuProps {
  hasSave: boolean;
  onClose: () => void;
  onExitToTitle: () => void;
  onLoad: () => void;
  onNewRun: () => void;
  open: boolean;
}

type ConfirmAction = "load" | "new-run" | null;

export const RunMenu = ({
  hasSave,
  onClose,
  onExitToTitle,
  onLoad,
  onNewRun,
  open,
}: RunMenuProps) => {
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const primaryRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) {
      setConfirmAction(null);
      return undefined;
    }
    primaryRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (confirmAction !== null) setConfirmAction(null);
      else onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmAction, onClose, open]);

  if (!open) return null;

  const confirmingLoad = confirmAction === "load";
  if (confirmAction !== null) {
    return (
      <OverlayPortal layer="modal">
        <section
          aria-label={confirmingLoad ? "저장 불러오기 확인" : "새 런 확인"}
          aria-modal="true"
          className="result-overlay run-menu-overlay"
          data-testid="run-menu"
          role="dialog"
        >
          <div className="result-panel run-menu-panel">
            <p className="run-kicker">확인</p>
            <h1>
              {confirmingLoad
                ? "마지막 저장을 불러올까요?"
                : "새 런을 시작할까요?"}
            </h1>
            <p>
              {confirmingLoad
                ? "현재 전투에서 사용한 동전과 행동은 사라지고 전투를 처음부터 다시 시작합니다."
                : "현재 런 저장을 삭제하고 캐릭터 선택으로 이동합니다."}
            </p>
            <div className="run-menu-actions horizontal">
              <button
                className="secondary-action"
                ref={primaryRef}
                type="button"
                onClick={() => setConfirmAction(null)}
              >
                취소
              </button>
              <button
                data-testid="confirm-action"
                type="button"
                onClick={confirmingLoad ? onLoad : onNewRun}
              >
                {confirmingLoad ? "불러오기" : "저장 삭제 후 시작"}
              </button>
            </div>
          </div>
        </section>
      </OverlayPortal>
    );
  }

  return (
    <OverlayPortal layer="modal">
      <section
        aria-label="런 메뉴"
        aria-modal="true"
        className="result-overlay run-menu-overlay"
        data-testid="run-menu"
        role="dialog"
      >
        <div className="result-panel run-menu-panel">
          <p className="run-kicker">RUN MENU</p>
          <h1>런 관리</h1>
          <div className="run-menu-actions">
            <button ref={primaryRef} type="button" onClick={onClose}>
              계속하기
            </button>
            <button
              className="secondary-action"
              data-testid="run-menu-load"
              disabled={!hasSave}
              type="button"
              onClick={() => setConfirmAction("load")}
            >
              마지막 저장 불러오기
            </button>
            <button
              className="secondary-action danger-action"
              data-testid="run-menu-new"
              type="button"
              onClick={() => setConfirmAction("new-run")}
            >
              새 런 시작
            </button>
            <button
              className="secondary-action"
              data-testid="run-menu-exit"
              type="button"
              onClick={onExitToTitle}
            >
              타이틀로 나가기
            </button>
          </div>
        </div>
      </section>
    </OverlayPortal>
  );
};
