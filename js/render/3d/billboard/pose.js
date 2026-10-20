/**
 * Pose 3D do cartão.
 *
 * modo "elevado" (props high top-down):
 * - (x,y,z) = centro da base no chão.
 * - Origem da geo = centro da base NA ARTE (não o pixel de baixo).
 * - Y sobe pra o último pixel OPACO abaixo do pivô cair no chão
 *   (padding transparente do PNG não conta — senão fica vão).
 * - dz empurra no +Z local (pra frente do billboard).
 *
 * modo "pe" (atores): origem = pé; sem lift (comportamento antigo).
 */
export function poseCartao(obj, opts) {
  if (!obj || !opts) return obj;
  const x = opts.x ?? 0;
  const yChao = opts.y ?? 0;
  const z = opts.z ?? 0;
  const largura = opts.largura > 0 ? opts.largura : 1;
  const altura = opts.altura > 0 ? opts.altura : 1;
  const yaw = Number.isFinite(opts.yaw) ? opts.yaw : 0;
  const inclinacao = Number.isFinite(opts.inclinacao) ? opts.inclinacao : 0;
  const roll = Number.isFinite(opts.roll) ? opts.roll : 0;
  const pivotY = Number.isFinite(opts.pivotY) ? opts.pivotY : 1;
  const dz = Number.isFinite(opts.dz) ? opts.dz : 0;
  const elevado = opts.elevado === true || opts.modo === "elevado";

  let lift = 0;
  if (elevado) {
    lift = alturaPivoAcimaChao(pivotY, altura, inclinacao, opts.opacoY);
  }

  if (obj.rotation.order !== "YXZ") obj.rotation.order = "YXZ";
  obj.position.set(x, yChao + lift, z);
  obj.rotation.set(inclinacao, yaw, roll);
  obj.scale.set(largura, altura, 1);
  obj.updateMatrix();

  if (dz !== 0) {
    const e = obj.matrix.elements;
    obj.position.x += e[8] * dz;
    obj.position.y += e[9] * dz;
    obj.position.z += e[10] * dz;
    obj.updateMatrix();
  }
  return obj;
}

/**
 * Altura do pivô acima do chão (linha azul).
 * opacoY = fração do último pixel opaco (scan); default 1 = borda da textura.
 */
export function alturaPivoAcimaChao(pivotY, alturaCartao, inclinacao = 0, opacoY = 1) {
  const py = Number.isFinite(pivotY) ? pivotY : 1;
  const h = alturaCartao > 0 ? alturaCartao : 1;
  const pe = Number.isFinite(opacoY) ? Math.max(0, Math.min(1, opacoY)) : 1;
  const abaixo = Math.max(0, (pe - py) * h);
  return abaixo * Math.cos(Number.isFinite(inclinacao) ? inclinacao : 0);
}
