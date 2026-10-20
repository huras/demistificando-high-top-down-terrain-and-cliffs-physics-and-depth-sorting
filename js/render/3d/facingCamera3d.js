/**
 * Facing estilo Ragnarok: direção no mundo → linha do sheet relativa à câmera.
 *
 * Mesma convenção de [`adaptadorInput3d.js`](adaptadorInput3d.js):
 * yaw 0 = câmera ao sul olhando −Z (norte).
 *
 * Sheet gold: 0 sul (frente), 1 oeste, 2 leste, 3 norte (costas).
 */

/**
 * @param {number} dirX mundo (+X leste)
 * @param {number} dirY mundo (+Y sul / +Z Three)
 * @param {number} yawCam yaw da câmera 3D (rad)
 * @returns {0|1|2|3}
 */
export function linhaFacingCamera(dirX, dirY, yawCam) {
  const dx = dirX || 0;
  const dy = dirY || 0;
  if (dx === 0 && dy === 0) return 0;

  const sin = Math.sin(yawCam);
  const cos = Math.cos(yawCam);
  // Mesmos eixos do input: look = (−sin, −cos), right = (cos, −sin)
  const telaDir = dx * cos + dy * -sin; // + = direita na tela
  const telaFrente = dx * -sin + dy * -cos; // + = para dentro da tela (longe da câmera)

  if (Math.abs(telaDir) > Math.abs(telaFrente)) {
    return telaDir < 0 ? 1 : 2; // esquerda / direita
  }
  return telaFrente > 0 ? 3 : 0; // costas / frente
}

/**
 * Preferência: velocidade se andando; senão dirX/dirY do corpo.
 */
export function linhaFacingDoCorpo(corpo, yawCam) {
  if (corpo.mirando) {
    return linhaFacingCamera(corpo.dirX || 0, corpo.dirY || 1, yawCam);
  }
  const vx = corpo.vx ?? 0;
  const vy = corpo.vy ?? 0;
  const spd = Math.hypot(vx, vy);
  if (spd > 0.35) return linhaFacingCamera(vx, vy, yawCam);
  return linhaFacingCamera(corpo.dirX || 0, corpo.dirY || 1, yawCam);
}
