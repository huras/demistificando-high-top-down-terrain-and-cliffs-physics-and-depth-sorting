/**
 * Texturas do quadro — preload.
 */

export const QUEST_BOARD_TEXTURE = Object.freeze({
  board: "./assets/textures/ui/wood_1-dark.jpg",
  ctrl: "./assets/textures/ui/wood_1-light.jpg",
});

/** @type {Promise<void> | null} */
let woodWarm = null;

function decodeImage(src) {
  return (async () => {
    const img = new Image();
    img.decoding = "async";
    img.src = src;
    if (typeof img.decode === "function") await img.decode();
    else {
      await new Promise((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`wood texture load failed: ${src}`));
      });
    }
  })();
}

export function aquecerMadeiraQuadro() {
  if (woodWarm) return woodWarm;
  woodWarm = Promise.all([
    decodeImage(QUEST_BOARD_TEXTURE.board),
    decodeImage(QUEST_BOARD_TEXTURE.ctrl),
  ]).then(
    () => undefined,
    () => undefined,
  );
  return woodWarm;
}
