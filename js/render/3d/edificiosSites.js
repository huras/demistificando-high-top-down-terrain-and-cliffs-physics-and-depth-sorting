/**
 * Malhas 3D dos sítios outdoor — casas/fazenda + props (toras HGSS).
 * Stream por proximidade; moinhos animam o ventilador.
 */
import * as THREE from "three";
import { CHUNK_XZ } from "../../config.js";
import { alturaDoRelevo } from "../../mundo/bioma/catalogo.js";
import {
  MODELO_CASA_SITE,
  MODELO_PROP_SITE,
  modeloDoPropSite,
  pegadaDoModeloSite,
  pegadaDoPropSite,
} from "../../mundo/sites/catalogo.js";
import { sitesDoChunk } from "../../mundo/sites/plano.js";
import { yawDoEdificio } from "../../mundo/cidade/orientacaoEdificio.js";
import { carregarMoldeCidade } from "./edificiosCidade.js";
import { marcarReflexo } from "./ceu/reflexoPoca.js";
import { carregarMoinhoPivo } from "../../mundo/sites/moinhoPivo.js";
import {
  ehModeloMoinho,
  eixoFanDaInstancia,
  eixoYawDaInstancia,
  faseInicialMoinho,
  montarArticulacaoMoinho,
  tickMoinhos,
} from "./moinhoSites.js";

const RAIO_CHUNKS = 3;
const IDS_CASA = Object.freeze([...new Set(Object.values(MODELO_CASA_SITE))]);
const IDS_PROP = Object.freeze([...new Set(Object.values(MODELO_PROP_SITE))]);

/** Yaw estável por id (props soltos não “olham pro centro”). */
function yawDoProp(id) {
  let h = 2166136261;
  const s = String(id || "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const quad = (h >>> 0) % 4;
  return (quad * Math.PI) / 2;
}

/**
 * @returns {{
 *   grupo: THREE.Group,
 *   quandoPronto: Promise<void>,
 *   atualizar: (px:number, py:number, dt?:number) => void,
 * }}
 */
export function criarEdificiosSites() {
  const grupo = new THREE.Group();
  grupo.name = "edificios-sites";

  /** @type {Map<string, THREE.Group>} */
  const moldes = new Map();
  /** @type {Map<string, THREE.Object3D>} */
  const vivos = new Map();
  /** @type {Map<string, { eixo: THREE.Object3D, x: number, z: number }>} */
  const rotores = new Map();

  let resolverPronto;
  const quandoPronto = new Promise((resolve) => {
    resolverPronto = resolve;
  });

  carregarMoinhoPivo()
    .then(() => {
      const cargas = [];
      for (let i = 0; i < IDS_CASA.length; i++) {
        const id = IDS_CASA[i];
        const pegada = pegadaDoModeloSite(id);
        const opts = pegada ? { ladoX: pegada.ladoX, ladoZ: pegada.ladoZ } : null;
        cargas.push(
          carregarMoldeCidade(id, opts).then((g) => {
            if (g && ehModeloMoinho(id)) montarArticulacaoMoinho(g, id);
            return [id, g];
          })
        );
      }
      for (let i = 0; i < IDS_PROP.length; i++) {
        const id = IDS_PROP[i];
        const pegada = pegadaDoPropSite(id);
        const opts = pegada ? { ladoX: pegada.ladoX, ladoZ: pegada.ladoZ } : null;
        cargas.push(carregarMoldeCidade(id, opts).then((g) => [id, g]));
      }
      return Promise.all(cargas);
    })
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
  let pxTick = 0;
  let pyTick = 0;

  function liberar(id) {
    const inst = vivos.get(id);
    if (!inst) return;
    grupo.remove(inst);
    vivos.delete(id);
    rotores.delete(id);
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
            if (ehModeloMoinho(casa.modelo)) {
              const eixoFan = eixoFanDaInstancia(inst);
              const eixoYaw = eixoYawDaInstancia(inst);
              if (eixoFan) {
                eixoFan.rotation.z = faseInicialMoinho(casa.id);
                rotores.set(casa.id, {
                  eixoFan,
                  eixoYaw,
                  yawPai: inst.rotation.y,
                  x: casa.x,
                  z: casa.y,
                });
              }
            }
            grupo.add(inst);
            vivos.set(casa.id, inst);
          }

          for (const prop of site.props) {
            const modelo = modeloDoPropSite(prop.propId);
            if (!modelo) continue;
            manter.add(prop.id);
            if (vivos.has(prop.id)) continue;
            const molde = moldes.get(modelo);
            if (!molde) continue;
            const inst = molde.clone(true);
            inst.name = prop.id;
            inst.rotation.y = yawDoProp(prop.id);
            const z = alturaDoRelevo(prop.x, prop.y);
            inst.position.set(prop.x, z, prop.y);
            grupo.add(inst);
            vivos.set(prop.id, inst);
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
    /**
     * Stream por proximidade + tick dos ventiladores (dt em segundos).
     * @param {number} px
     * @param {number} py
     * @param {number} [dt]
     */
    atualizar(px, py, dt = 0) {
      if (!moldes.size) return;
      pxTick = px;
      pyTick = py;
      if (
        !(
          Number.isFinite(pxAplicado) &&
          Math.hypot(px - pxAplicado, py - pyAplicado) < 4
        )
      ) {
        pxAplicado = px;
        pyAplicado = py;
        sincronizar(px, py);
      }
      if (dt > 0 && rotores.size) tickMoinhos(rotores.values(), dt, pxTick, pyTick);
    },
  };
}
