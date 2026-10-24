/**
 * Tela de boot com progresso por fase (assets, mundo, shaders GPU).
 * A 1ª abertura pós-reboot é mais lenta: disco frio + compile de shaders.
 */

/** @typedef {{ id: string, rotulo: string, peso: number }} FaseBoot */

/** @type {FaseBoot[]} */
export const FASES_BOOT = [
  { id: "modulos", rotulo: "Módulos do jogo", peso: 8 },
  { id: "kits", rotulo: "Kits de bioma", peso: 5 },
  { id: "visuais", rotulo: "Texturas e sprites", peso: 20 },
  { id: "mundo", rotulo: "Mundo no spawn", peso: 7 },
  { id: "pokemon", rotulo: "Catálogo Pokémon", peso: 10 },
  { id: "santuarios", rotulo: "Santuários", peso: 5 },
  { id: "cena3d", rotulo: "Cena 3D e terreno", peso: 10 },
  { id: "cidade", rotulo: "Modelos da cidade", peso: 15 },
  { id: "shaders", rotulo: "Shaders da GPU", peso: 20 },
];

const pesoTotal = FASES_BOOT.reduce((s, f) => s + f.peso, 0);

/** @type {Map<string, number>} */
const fracaoPorFase = new Map(FASES_BOOT.map((f) => [f.id, 0]));

let raiz = null;
let barra = null;
let pctEl = null;
let statusEl = null;
let listaEl = null;
let detalheEl = null;
let concluido = false;
let falhou = false;

function indiceFase(id) {
  for (let i = 0; i < FASES_BOOT.length; i++) {
    if (FASES_BOOT[i].id === id) return i;
  }
  return -1;
}

function progressoGlobal() {
  let acc = 0;
  for (let i = 0; i < FASES_BOOT.length; i++) {
    const f = FASES_BOOT[i];
    acc += f.peso * Math.min(1, Math.max(0, fracaoPorFase.get(f.id) || 0));
  }
  return acc / pesoTotal;
}

function pintarLista() {
  if (!listaEl) return;
  const itens = listaEl.querySelectorAll("[data-fase]");
  for (let i = 0; i < itens.length; i++) {
    const el = itens[i];
    const id = el.getAttribute("data-fase");
    const fr = fracaoPorFase.get(id) || 0;
    el.classList.toggle("is-feita", fr >= 1);
    el.classList.toggle("is-ativa", fr > 0 && fr < 1);
  }
}

function pintarBarra() {
  if (concluido || falhou) return;
  const p = progressoGlobal();
  const pct = Math.round(p * 100);
  if (barra) barra.style.transform = `scaleX(${p})`;
  if (pctEl) pctEl.textContent = `${pct}%`;
  if (raiz) raiz.setAttribute("aria-valuenow", String(pct));
  pintarLista();
}

/**
 * Garante um frame pintado antes de trabalho bloqueante (ex.: compile síncrono).
 */
export function esperarPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(resolve);
    });
  });
}

export function montarTelaCarregamento(host = document.getElementById("boot-carregamento")) {
  raiz = host;
  if (!raiz) return null;
  barra = raiz.querySelector("[data-boot-barra]");
  pctEl = raiz.querySelector("[data-boot-pct]");
  statusEl = raiz.querySelector("[data-boot-status]");
  listaEl = raiz.querySelector("[data-boot-lista]");
  detalheEl = raiz.querySelector("[data-boot-detalhe]");
  document.body.classList.add("esta-carregando");
  raiz.hidden = false;
  raiz.setAttribute("aria-busy", "true");
  if (listaEl && !listaEl.childElementCount) {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < FASES_BOOT.length; i++) {
      const f = FASES_BOOT[i];
      const li = document.createElement("li");
      li.dataset.fase = f.id;
      li.innerHTML = `<span class="boot-load__check" aria-hidden="true"></span><span>${f.rotulo}</span>`;
      frag.appendChild(li);
    }
    listaEl.appendChild(frag);
  }
  pintarBarra();
  return raiz;
}

export function definirStatus(texto, detalhe = "") {
  if (statusEl) statusEl.textContent = texto || "";
  if (detalheEl) {
    if (detalhe) {
      detalheEl.hidden = false;
      detalheEl.textContent = detalhe;
    } else {
      detalheEl.textContent = "";
      detalheEl.hidden = true;
    }
  }
}

/**
 * @param {string} id
 * @param {number} [fracao=1] 0–1 dentro da fase
 */
export function marcarFase(id, fracao = 1) {
  if (!fracaoPorFase.has(id)) return;
  const atual = fracaoPorFase.get(id) || 0;
  const prox = Math.min(1, Math.max(atual, fracao));
  fracaoPorFase.set(id, prox);

  // Fases anteriores ficam completas se pulamos à frente.
  const idx = indiceFase(id);
  for (let i = 0; i < idx; i++) {
    fracaoPorFase.set(FASES_BOOT[i].id, 1);
  }
  pintarBarra();
}

export async function concluirCarregamento() {
  if (concluido) return;
  concluido = true;
  for (let i = 0; i < FASES_BOOT.length; i++) {
    fracaoPorFase.set(FASES_BOOT[i].id, 1);
  }
  definirStatus("Pronto", "");
  pintarBarra();
  await esperarPaint();
  if (!raiz) {
    document.body.classList.remove("esta-carregando");
    return;
  }
  raiz.classList.add("is-saindo");
  raiz.setAttribute("aria-busy", "false");
  await new Promise((resolve) => {
    const fim = () => {
      raiz.hidden = true;
      raiz.classList.remove("is-saindo");
      document.body.classList.remove("esta-carregando");
      resolve();
    };
    raiz.addEventListener("transitionend", fim, { once: true });
    setTimeout(fim, 520);
  });
}

export function falharCarregamento(erro) {
  falhou = true;
  document.body.classList.remove("esta-carregando");
  if (!raiz) {
    console.error(erro);
    return;
  }
  raiz.classList.add("is-erro");
  raiz.setAttribute("aria-busy", "false");
  definirStatus(
    "Falha ao carregar",
    String(erro?.message || erro || "Erro desconhecido"),
  );
  if (barra) barra.style.transform = `scaleX(${progressoGlobal()})`;
}
