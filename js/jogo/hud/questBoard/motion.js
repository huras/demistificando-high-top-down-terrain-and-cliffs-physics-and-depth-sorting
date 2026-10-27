/** Entrada/saída do quadro — opacity + transform. */

export const QUEST_BOARD_IN_MS = 280;
export const QUEST_BOARD_OUT_MS = 180;

export function playQuestBoardEnter(root) {
  let cancelled = false;
  let raf2 = 0;
  root.classList.remove("is-out");
  root.classList.add("is-motion");
  const raf1 = requestAnimationFrame(() => {
    raf2 = requestAnimationFrame(() => {
      if (cancelled) return;
      root.classList.add("is-in");
    });
  });
  const settle = setTimeout(() => {
    if (!cancelled) root.classList.remove("is-motion");
  }, QUEST_BOARD_IN_MS + 40);
  return () => {
    cancelled = true;
    cancelAnimationFrame(raf1);
    cancelAnimationFrame(raf2);
    clearTimeout(settle);
  };
}

export function playQuestBoardLeave(root, onDone) {
  let cancelled = false;
  root.classList.add("is-motion", "is-out");
  root.classList.remove("is-in");
  const sheet = root.querySelector("[data-quest-board-sheet]");
  const finish = () => {
    if (cancelled) return;
    cancelled = true;
    cleanup();
    root.classList.remove("is-motion", "is-out");
    onDone?.();
  };
  const onEnd = (e) => {
    if (e.target !== sheet) return;
    if (e.propertyName !== "transform" && e.propertyName !== "opacity") return;
    finish();
  };
  sheet?.addEventListener("transitionend", onEnd);
  const timer = setTimeout(finish, QUEST_BOARD_OUT_MS + 50);
  function cleanup() {
    sheet?.removeEventListener("transitionend", onEnd);
    clearTimeout(timer);
  }
  return () => {
    cancelled = true;
    cleanup();
  };
}
