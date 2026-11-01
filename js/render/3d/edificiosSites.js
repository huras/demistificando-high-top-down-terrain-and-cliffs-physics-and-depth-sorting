/**
 * Casas 3D dos sítios outdoor — stream por proximidade (LOD barato).
 * Reusa moldes do hub; só instancia o que está perto do jogador.
 */
import * as THREE from "three";
import { CHUNK_XZ } from "../../config.js";
import { alturaDoRelevo } from "../../mundo/bioma/catalogo.js";
import { MODELO_CASA_SITE } from "../../mundo/sites/catalogo.js";
import { sitesDoChunk } from "../../mundo/sites/plano.js";
import { yawDoEdificio } from "../../mundo/cidade/orientacaoEdificio.js";
import { carregarMoldeCidade } from "./edificiosCidade.js";
import { marcarReflexo } from "./ceu/reflexoPoca.js";

const RAIO_CHUNKS = 3;
const IDS_MODELO = Object.freeze([...new Set(Object.values(MODELO_CASA_SITE))]);

/**
 * @returns {{
 *   grupo: THREE.Group,
 *   quandoPronto: Promise<void>,
 *   atualizar: (px:number, py:number) => void,
 * }}
 */
export function criarEdificiosSites() {
  const grupo = new THREE.Group();
  grupo.name = "edificios-sites";

  /** @type {Map<string, THREE.Group>} */
  const moldes = new Map();
  /** @type {Map<string, THREE.Object3D>} */
  const vivos = new Map();

  let resolverPronto;
  const quandoPronto = new Promise((resolve) => {
    resolverPronto = resolve;
  });

  Promise.all(IDS_MODELO.map((id) => carregarMoldeCidade(id).then((g) => [id, g])))
    .then((pares) => {
      for (let i = 0; i < pares.length; i++) {
        const [id, raiz] = pares[i];
        if (!raiz) continue;
        moldes.set(id, raiz);
      }
      marcarReflexo(grupo);
      resolverPronto?.();
    })
    .catch((err) => {
      console.error("modelos de site", err);
      resolverPronto?.();
    });

  let pxAplicado = NaN;
  let pyAplicado = NaN;

  function liberar(id) {
    const inst = vivos.get(id);
    if (!inst) return;
    grupo.remove(inst);
    vivos.delete(id);
  }

  function sincronizar(px, py) {
    const cx = Math.floor(px / CHUNK_XZ);
    const cy = Math.floor(py / CHUNK_XZ);
    /** @type {Set<string>} */
    const manter = new Set();

    for (let dy = -RAIO_CHUNKS; dy <= RAIO_CHUNKS; dy++) {
      for (let dx = -RAIO_CHUNKS; dx <= RAIO_CHUNKS; dx++) {
        const sites = sitesDoChunk(cx + dx, cy + dy);
        for (const site of sites) {
          for (const casa of site.edificios) {
            manter.add(casa.id);
            if (vivos.has(casa.id)) continue;
            const molde = moldes.get(casa.modelo);
            if (!molde) continue;
            const inst = molde.clone(true);
            inst.name = casa.id;
            inst.rotation.y = yawDoEdificio("casa", casa.x, casa.y);
            const z = alturaDoRelevo(casa.x, casa.y);
            inst.position.set(casa.x, z, casa.y);
            if (casa.tint) {
              inst.traverse((filho) => {
                if (!filho.isMesh || !filho.material) return;
                const mats = Array.isArray(filho.material)
                  ? filho.material
                  : [filho.material];
                for (let m = 0; m < mats.length; m++) {
                  if (mats[m]?.color) mats[m].color.set(casa.tint);
                }
              });
            }
            grupo.add(inst);
            vivos.set(casa.id, inst);
          }
        }
      }
    }

    for (const id of [...vivos.keys()]) {
      if (!manter.has(id)) liberar(id);
    }
  }

  return {
    grupo,
    quandoPronto,
    atualizar(px, py) {
      if (!moldes.size) return;
      if (
        Number.isFinite(pxAplicado) &&
        Math.hypot(px - pxAplicado, py - pyAplicado) < 4
      ) {
        return;
      }
      pxAplicado = px;
      pyAplicado = py;
      sincronizar(px, py);
    },
  };
}
