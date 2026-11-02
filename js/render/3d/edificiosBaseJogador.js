/**
 * Stream 3D das casas / móveis outdoor do jogador.
 */
import * as THREE from "three";
import { alturaDoRelevo } from "../../mundo/bioma/catalogo.js";
import { pegadaDoModeloSite } from "../../mundo/sites/catalogo.js";
import {
  casasPerto,
  listarMoveisOutdoor,
  versaoEstruturasJogador,
} from "../../construir/estruturas.js";
import { carregarMoldeCidade } from "./edificiosCidade.js";
import { listarIdsCasaJogador } from "../../construir/modelosCasa.js";
import { marcarReflexo } from "./ceu/reflexoPoca.js";

const RAIO = 64;

/**
 * @returns {{
 *   grupo: THREE.Group,
 *   quandoPronto: Promise<void>,
 *   atualizar: (px: number, py: number) => void,
 *   invalidar: () => void,
 * }}
 */
export function criarEdificiosBaseJogador() {
  const grupo = new THREE.Group();
  grupo.name = "edificios-base-jogador";

  /** @type {Map<string, THREE.Group>} */
  const moldes = new Map();
  /** @type {Map<string, THREE.Object3D>} */
  const vivos = new Map();

  let versaoAplicada = -1;
  let pxAplicado = NaN;
  let pyAplicado = NaN;

  let resolverPronto;
  const quandoPronto = new Promise((resolve) => {
    resolverPronto = resolve;
  });

  const ids = listarIdsCasaJogador();
  Promise.all(
    ids.map((id) => {
      const pegada = pegadaDoModeloSite(id);
      const opts = pegada ? { ladoX: pegada.ladoX, ladoZ: pegada.ladoZ } : null;
      return carregarMoldeCidade(id, opts).then((g) => [id, g]);
    })
  )
    .then((pares) => {
      for (const [id, g] of pares) {
        if (g) moldes.set(id, g);
      }
      marcarReflexo(grupo);
      resolverPronto?.();
    })
    .catch((err) => {
      console.error("modelos base jogador", err);
      resolverPronto?.();
    });

  function liberar(id) {
    const inst = vivos.get(id);
    if (!inst) return;
    grupo.remove(inst);
    vivos.delete(id);
  }

  function proxyMovel(key) {
    const geo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
    const mat = new THREE.MeshStandardMaterial({
      color: key === "cama" ? 0xb45309 : key === "planta" ? 0x16a34a : 0x92400e,
      roughness: 0.85,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0.35;
    const g = new THREE.Group();
    g.add(mesh);
    return g;
  }

  function sincronizar(px, py) {
    /** @type {Set<string>} */
    const manter = new Set();
    const casas = casasPerto(px, py, RAIO);
    for (const casa of casas) {
      manter.add(casa.id);
      if (vivos.has(casa.id)) continue;
      const molde = moldes.get(casa.buildingId);
      if (!molde) continue;
      const inst = molde.clone(true);
      inst.name = casa.id;
      inst.rotation.y = casa.yaw || 0;
      const z = Number.isFinite(casa.z) ? casa.z : alturaDoRelevo(casa.x, casa.y);
      inst.position.set(casa.x, z, casa.y);
      grupo.add(inst);
      vivos.set(casa.id, inst);
    }

    for (const f of listarMoveisOutdoor()) {
      const dx = f.x + 0.5 - px;
      const dy = f.y + 0.5 - py;
      if (dx * dx + dy * dy > RAIO * RAIO) continue;
      manter.add(f.id);
      if (vivos.has(f.id)) continue;
      const inst = proxyMovel(f.key);
      inst.name = f.id;
      const z = Number.isFinite(f.z) ? f.z : alturaDoRelevo(f.x + 0.5, f.y + 0.5);
      inst.position.set(f.x + 0.5, z, f.y + 0.5);
      grupo.add(inst);
      vivos.set(f.id, inst);
    }

    for (const id of [...vivos.keys()]) {
      if (!manter.has(id)) liberar(id);
    }
    versaoAplicada = versaoEstruturasJogador();
  }

  return {
    grupo,
    quandoPronto,
    invalidar() {
      versaoAplicada = -1;
      pxAplicado = NaN;
    },
    atualizar(px, py) {
      if (!moldes.size && !vivos.size) {
        /* moldes ainda carregando — ainda assim mostra móveis proxy */
      }
      const ver = versaoEstruturasJogador();
      const moveu =
        !Number.isFinite(pxAplicado) ||
        Math.hypot(px - pxAplicado, py - pyAplicado) >= 4;
      if (ver !== versaoAplicada || moveu) {
        pxAplicado = px;
        pyAplicado = py;
        sincronizar(px, py);
      }
    },
  };
}
