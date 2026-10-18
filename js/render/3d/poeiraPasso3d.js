import * as THREE from "three";
import { ALTURA_BLOCO } from "../../config.js";
import {
  amostraPoeira,
  poeiraPronta,
  puffsPasso,
  quadrosPoeira,
} from "../../fx/poeiraPasso.js";

const COR = 0xefe6d6;

export function criarPoeiraPasso3d() {
  const grupo = new THREE.Group();
  grupo.name = "poeira-passo";
  const sprites = [];
  const texturas = [null, null, null];
  let montado = false;

  function montar() {
    if (montado || !poeiraPronta()) return;
    const folhas = quadrosPoeira();
    for (let f = 0; f < 3; f++) {
      const tex = new THREE.CanvasTexture(folhas[f]);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      tex.needsUpdate = true;
      texturas[f] = tex;
    }
    const puffs = puffsPasso();
    for (let i = 0; i < puffs.length; i++) {
      const mat = new THREE.SpriteMaterial({
        map: texturas[0],
        color: COR,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        opacity: 0,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.center.set(0.5, 0.08);
      sprite.visible = false;
      sprite.renderOrder = 2;
      sprite.frustumCulled = false;
      grupo.add(sprite);
      sprites.push(sprite);
    }
    montado = true;
  }

  function atualizar() {
    montar();
    if (!montado) return;
    const puffs = puffsPasso();
    for (let i = 0; i < sprites.length; i++) {
      const sprite = sprites[i];
      const p = puffs[i];
      if (!p?.viva) {
        if (sprite.visible) sprite.visible = false;
        continue;
      }
      const a = amostraPoeira(p);
      const mat = sprite.material;
      const tex = texturas[a.quadro];
      if (mat.map !== tex) mat.map = tex;
      mat.opacity = a.alfa;
      sprite.visible = true;
      sprite.position.set(p.x, p.z * ALTURA_BLOCO + 0.03, p.y);
      sprite.scale.set(a.tam, a.tam, 1);
    }
  }

  return { grupo, atualizar };
}
