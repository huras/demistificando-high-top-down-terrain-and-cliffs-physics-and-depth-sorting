/**
 * Aba Moinho do editor de colisores — ajusta o pivô do ventilador.
 */
import * as THREE from "three";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { pegadaDoModeloSite } from "../mundo/sites/catalogo.js";
import {
  carregarMoinhoPivo,
  definirCacheMoinhoPivo,
  offsetMoinho,
} from "../mundo/sites/moinhoPivo.js";
import { carregarMoldeCidade } from "../render/3d/edificiosCidade.js";
import {
  aplicarOffsetEixoFan,
  eixoYawDaInstancia,
  montarArticulacaoMoinho,
} from "../render/3d/moinhoSites.js";

export const ITENS_MOINHO = Object.freeze([
  { id: "windmill-1", nome: "EditedWindmill 1" },
]);

/**
 * @param {{
 *   cena: THREE.Scene,
 *   predio: THREE.Group,
 *   camera: THREE.Camera,
 *   canvas: HTMLCanvasElement,
 *   controles: { enabled: boolean },
 *   dizer: (t: string) => void,
 * }} ctx
 */
export function criarModoMoinho(ctx) {
  const { cena, predio, camera, canvas, controles, dizer } = ctx;

  /** @type {Record<string, { dx:number, dy:number, dz:number }>} */
  let arquivo = {};
  let modeloId = "";
  /** @type {THREE.Object3D | null} */
  let eixo = null;
  /** @type {THREE.Object3D | null} */
  let eixoYaw = null;
  /** @type {THREE.Object3D | null} */
  let marca = null;
  let spin = true;

  const dxEl = document.getElementById("moinho-dx");
  const dyEl = document.getElementById("moinho-dy");
  const dzEl = document.getElementById("moinho-dz");
  const dxVal = document.getElementById("moinho-dx-valor");
  const dyVal = document.getElementById("moinho-dy-valor");
  const dzVal = document.getElementById("moinho-dz-valor");
  const coordsEl = document.getElementById("moinho-coords");
  const btnReset = document.getElementById("moinho-reset");

  const gizmo = new TransformControls(camera, canvas);
  gizmo.setMode("translate");
  gizmo.setSpace("local");
  gizmo.setSize(0.75);
  gizmo.enabled = false;
  gizmo.visible = false;
  cena.add(gizmo.getHelper());
  gizmo.addEventListener("dragging-changed", (ev) => {
    controles.enabled = !ev.value;
  });
  gizmo.addEventListener("objectChange", () => {
    if (!eixo || !marca) return;
    const hub = eixo.userData.hubBase;
    if (!hub) return;
    const off = {
      dx: marca.position.x - hub.x,
      dy: marca.position.y - hub.y,
      dz: marca.position.z - hub.z,
    };
    gravar(off);
    aplicarOffsetEixoFan(eixo, off);
    syncHud(off);
  });

  function arred(n) {
    const v = Number(n);
    return Number.isFinite(v) ? Math.round(v * 1000) / 1000 : 0;
  }

  function lerHud() {
    return {
      dx: arred(dxEl.value),
      dy: arred(dyEl.value),
      dz: arred(dzEl.value),
    };
  }

  function syncHud(off) {
    const o = {
      dx: arred(off.dx),
      dy: arred(off.dy),
      dz: arred(off.dz),
    };
    dxEl.value = String(o.dx);
    dyEl.value = String(o.dy);
    dzEl.value = String(o.dz);
    dxVal.textContent = o.dx.toFixed(3);
    dyVal.textContent = o.dy.toFixed(3);
    dzVal.textContent = o.dz.toFixed(3);
    coordsEl.textContent = `dx ${o.dx} · dy ${o.dy} · dz ${o.dz}`;
  }

  function gravar(off) {
    if (!modeloId) return;
    const o = {
      dx: arred(off.dx),
      dy: arred(off.dy),
      dz: arred(off.dz),
    };
    if (o.dx === 0 && o.dy === 0 && o.dz === 0) delete arquivo[modeloId];
    else arquivo[modeloId] = o;
    definirCacheMoinhoPivo(arquivo);
  }

  function limparPredio() {
    gizmo.detach();
    gizmo.enabled = false;
    gizmo.visible = false;
    while (predio.children.length) {
      const c = predio.children[0];
      predio.remove(c);
    }
    eixo = null;
    eixoYaw = null;
    marca = null;
  }

  async function abrir(id) {
    modeloId = id;
    limparPredio();
    dizer(`Carregando ${id}…`);
    const pegada = pegadaDoModeloSite(id);
    const opts = pegada ? { ladoX: pegada.ladoX, ladoZ: pegada.ladoZ } : null;
    definirCacheMoinhoPivo(arquivo);
    const molde = await carregarMoldeCidade(id, opts);
    if (!molde) {
      dizer("Não carregou o moinho");
      return;
    }
    const off = arquivo[id] ? { ...arquivo[id] } : { dx: 0, dy: 0, dz: 0 };
    const art = montarArticulacaoMoinho(molde, id);
    eixo = art?.eixoFan || null;
    eixoYaw = art?.eixoYaw || eixoYawDaInstancia(molde);
    if (eixo) aplicarOffsetEixoFan(eixo, off);
    predio.add(molde);

    marca = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 14, 12),
      new THREE.MeshBasicMaterial({ color: 0xff5ad5, depthTest: false })
    );
    marca.renderOrder = 10;
    if (eixo) {
      marca.position.copy(eixo.position);
      eixo.parent.add(marca);
      gizmo.attach(marca);
      gizmo.enabled = true;
      gizmo.visible = true;
    }
    syncHud(off);
    dizer(`${id} · pivô do cata-vento (rosa) · head segue o vento no jogo`);
  }

  function onSlider() {
    const off = lerHud();
    gravar(off);
    if (eixo) aplicarOffsetEixoFan(eixo, off);
    if (marca && eixo) marca.position.copy(eixo.position);
    syncHud(off);
  }

  for (const el of [dxEl, dyEl, dzEl]) {
    el.addEventListener("input", onSlider);
  }
  btnReset.addEventListener("click", () => {
    gravar({ dx: 0, dy: 0, dz: 0 });
    if (eixo) aplicarOffsetEixoFan(eixo, { dx: 0, dy: 0, dz: 0 });
    if (marca && eixo) marca.position.copy(eixo.position);
    syncHud({ dx: 0, dy: 0, dz: 0 });
    dizer("Offset zerado (cubo automático)");
  });

  async function boot() {
    await carregarMoinhoPivo();
    // Cópia mutável do cache carregado.
    arquivo = {};
    for (const item of ITENS_MOINHO) {
      const o = offsetMoinho(item.id);
      if (o.dx || o.dy || o.dz) arquivo[item.id] = { ...o };
    }
    definirCacheMoinhoPivo(arquivo);
  }

  function tick(dt) {
    if (!spin) return;
    if (eixoYaw) eixoYaw.rotation.y += 0.35 * dt;
    if (eixo) eixo.rotation.z += 2.2 * dt;
  }

  function desativar() {
    limparPredio();
    modeloId = "";
  }

  async function salvar() {
    const res = await fetch("/api/moinho-pivo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(arquivo),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.ok === false) throw new Error(json.erro || "não salvou");
    definirCacheMoinhoPivo(arquivo);
  }

  function temAjuste(id) {
    const o = arquivo[id];
    return !!(o && (o.dx || o.dy || o.dz));
  }

  return {
    boot,
    abrir,
    desativar,
    tick,
    salvar,
    itens: ITENS_MOINHO,
    temAjuste,
    get modeloId() {
      return modeloId;
    },
  };
}
