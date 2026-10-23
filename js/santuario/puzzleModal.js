/**
 * Modal 4×4 para destravar santuário.
 */
import {
  PUZZLE_SIZE,
  PUZZLE_PIECE_COUNT,
  puzzlePieceSliceStyle,
  shuffledPuzzleOrder,
  isPuzzleSolved,
} from "./travaEntrada.js";

const RESOLVE_CHARGE_MS = 1200;
const RESOLVE_FADE_MS = 320;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadImageUrl(primary, fallback) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(primary);
    img.onerror = () => {
      if (fallback && fallback !== primary) {
        loadImageUrl(fallback, null).then(resolve);
        return;
      }
      resolve(primary);
    };
    img.src = primary;
  });
}

/** @type {EntrancePuzzleModal | null} */
let instancia = null;

export class EntrancePuzzleModal {
  constructor(root) {
    this.root = root;
    this.titleEl = root?.querySelector("[data-entrance-puzzle-title]");
    this.hintEl = root?.querySelector("[data-entrance-puzzle-hint]");
    this.previewEl = root?.querySelector("[data-entrance-puzzle-preview]");
    this.boardEl = root?.querySelector("[data-entrance-puzzle-board]");
    this.cancelBtn = root?.querySelector("[data-entrance-puzzle-cancel]");
    this.debugBtn = root?.querySelector("[data-entrance-puzzle-debug]");
    this._open = false;
    this._resolving = false;
    this._order = [];
    this._spec = null;
    this._imageSrc = "/ref/sprites/pokemon-portraits/133.png";
    this._onSolve = null;
    this._onCancel = null;
    this._drag = null;

    this.debugBtn?.addEventListener("click", () => this.debugSolve());
    this.cancelBtn?.addEventListener("click", () => this.cancel());
    this.boardEl?.addEventListener("pointerdown", (e) => this._onPointerDown(e));
    window.addEventListener("pointermove", (e) => this._onPointerMove(e));
    window.addEventListener("pointerup", (e) => this._onPointerUp(e));
    window.addEventListener("pointercancel", () => this._endDrag());
    window.addEventListener("keydown", (e) => {
      if (!this._open || e.key !== "Escape") return;
      if (this._resolving) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      this.cancel();
    });
  }

  get isOpen() {
    return this._open;
  }

  async open(spec, { onSolve, onCancel } = {}) {
    if (!this.root || !spec?.id) return false;
    this.close();
    this._spec = spec;
    this._onSolve = onSolve ?? null;
    this._onCancel = onCancel ?? null;
    this._open = true;
    this._resolving = false;
    this._order = shuffledPuzzleOrder(`shrine:${spec.id}`);

    const primary = spec.imageSrc || this._imageSrc;
    const fallback = "/ref/sprites/pokemon-portraits/133.png";
    this._imageSrc = await loadImageUrl(primary, fallback);

    this.root.hidden = false;
    this.root.classList.remove("is-resolving", "is-fading");
    if (this.debugBtn) {
      this.debugBtn.hidden = false;
      this.debugBtn.disabled = false;
    }
    if (this.cancelBtn) {
      this.cancelBtn.hidden = false;
      this.cancelBtn.disabled = false;
    }
    if (this.titleEl) {
      this.titleEl.textContent = spec.title || "Santuário elemental";
    }
    if (this.hintEl) {
      this.hintEl.textContent = "Arraste as peças para montar o retrato.";
    }
    if (this.previewEl) {
      this.previewEl.src = this._imageSrc;
      this.previewEl.alt = "Retrato";
    }
    this._renderBoard();
    return true;
  }

  close() {
    this._endDrag();
    this._open = false;
    this._resolving = false;
    this._spec = null;
    this._onSolve = null;
    this._onCancel = null;
    this._order = [];
    if (this.root) {
      this.root.hidden = true;
      this.root.classList.remove("is-resolving", "is-fading");
    }
    if (this.boardEl) {
      this.boardEl.classList.remove("is-charging", "is-whiteout");
      this.boardEl.replaceChildren();
    }
  }

  debugSolve() {
    if (!this._open || this._resolving) return;
    this._endDrag();
    this._order = Array.from({ length: PUZZLE_PIECE_COUNT }, (_, i) => i);
    this._renderBoard();
    void this._playResolveSequence();
  }

  cancel() {
    if (this._resolving) return;
    const cb = this._onCancel;
    this.close();
    cb?.();
  }

  _createPieceEl(pieceIndex) {
    const piece = document.createElement("div");
    piece.className = "entrance-puzzle__piece";
    piece.dataset.piece = String(pieceIndex);
    const slice = puzzlePieceSliceStyle(pieceIndex, this._imageSrc);
    for (const [key, value] of Object.entries(slice)) {
      piece.style[key] = value;
    }
    return piece;
  }

  _renderBoard() {
    if (!this.boardEl) return;
    this.boardEl.style.setProperty("--puzzle-size", String(PUZZLE_SIZE));
    this.boardEl.classList.remove("is-charging", "is-whiteout");
    this.boardEl.replaceChildren();
    for (let slot = 0; slot < PUZZLE_PIECE_COUNT; slot++) {
      const piece = this._order[slot];
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "entrance-puzzle__slot";
      cell.dataset.slot = String(slot);
      cell.append(this._createPieceEl(piece));
      this.boardEl.append(cell);
    }
  }

  async _playResolveSequence() {
    if (this._resolving || !this.root) return;
    this._resolving = true;
    this._endDrag();
    if (this.debugBtn) {
      this.debugBtn.disabled = true;
      this.debugBtn.hidden = true;
    }
    if (this.cancelBtn) {
      this.cancelBtn.disabled = true;
      this.cancelBtn.hidden = true;
    }
    if (this.hintEl) this.hintEl.textContent = "Abrindo…";
    this.root.classList.add("is-resolving");
    this.boardEl?.classList.add("is-charging");
    await wait(RESOLVE_CHARGE_MS * 0.72);
    this.boardEl?.classList.add("is-whiteout");
    await wait(RESOLVE_CHARGE_MS * 0.28);
    this.root.classList.add("is-fading");
    await wait(RESOLVE_FADE_MS);
    const solve = this._onSolve;
    this.close();
    solve?.();
  }

  _slotFromPoint(clientX, clientY) {
    if (!this.boardEl) return -1;
    const el = document.elementFromPoint(clientX, clientY);
    const slotEl = el?.closest?.("[data-slot]");
    if (!slotEl || !this.boardEl.contains(slotEl)) return -1;
    const slot = Number(slotEl.dataset.slot);
    return Number.isFinite(slot) ? slot : -1;
  }

  _onPointerDown(e) {
    if (!this._open || this._resolving || (e.button != null && e.button !== 0)) {
      return;
    }
    const slot = this._slotFromPoint(e.clientX, e.clientY);
    if (slot < 0) return;
    const pieceEl = this.boardEl?.querySelector(
      `[data-slot="${slot}"] .entrance-puzzle__piece`
    );
    if (!pieceEl) return;
    e.preventDefault();
    const rect = pieceEl.getBoundingClientRect();
    const ghost = pieceEl.cloneNode(true);
    ghost.classList.add("entrance-puzzle__ghost");
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    ghost.style.width = `${w}px`;
    ghost.style.height = `${h}px`;
    document.body.append(ghost);
    this._drag = { from: slot, pointerId: e.pointerId, ghost };
    this._moveGhost(e.clientX, e.clientY);
    pieceEl.classList.add("is-dragging");
    this.boardEl?.classList.add("is-dragging");
  }

  _onPointerMove(e) {
    if (!this._drag || e.pointerId !== this._drag.pointerId) return;
    this._moveGhost(e.clientX, e.clientY);
  }

  _onPointerUp(e) {
    if (!this._drag || e.pointerId !== this._drag.pointerId) return;
    const to = this._slotFromPoint(e.clientX, e.clientY);
    const from = this._drag.from;
    this._endDrag();
    if (this._resolving) return;
    if (to < 0 || to === from) return;
    const tmp = this._order[from];
    this._order[from] = this._order[to];
    this._order[to] = tmp;
    this._renderBoard();
    if (isPuzzleSolved(this._order)) void this._playResolveSequence();
  }

  _moveGhost(x, y) {
    const ghost = this._drag?.ghost;
    if (!ghost) return;
    ghost.style.left = `${x}px`;
    ghost.style.top = `${y}px`;
  }

  _endDrag() {
    if (!this._drag) return;
    this._drag.ghost?.remove();
    this.boardEl
      ?.querySelector(".entrance-puzzle__piece.is-dragging")
      ?.classList.remove("is-dragging");
    this.boardEl?.classList.remove("is-dragging");
    this._drag = null;
  }
}

export function garantirPuzzleModal() {
  if (instancia?.root) return instancia;
  const root = document.getElementById("entrance-puzzle");
  if (!root) return null;
  instancia = new EntrancePuzzleModal(root);
  return instancia;
}

export function puzzleSantuarioAberto() {
  return !!instancia?.isOpen;
}
