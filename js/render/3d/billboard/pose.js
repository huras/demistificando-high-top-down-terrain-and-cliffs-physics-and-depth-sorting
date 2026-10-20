/**
 * Pose AAA do cartão: pe no chão, yaw da câmera, inclinacao no X (ordem YXZ).
 * obj: Object3D / dummy de InstancedMesh.
 */
export function poseCartao(obj, opts) {
  if (!obj || !opts) return obj;
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const z = opts.z ?? 0;
  const largura = opts.largura > 0 ? opts.largura : 1;
  const altura = opts.altura > 0 ? opts.altura : 1;
  const yaw = Number.isFinite(opts.yaw) ? opts.yaw : 0;
  const inclinacao = Number.isFinite(opts.inclinacao) ? opts.inclinacao : 0;
  const roll = Number.isFinite(opts.roll) ? opts.roll : 0;
  if (obj.rotation.order !== "YXZ") obj.rotation.order = "YXZ";
  obj.position.set(x, y, z);
  obj.rotation.set(inclinacao, yaw, roll);
  obj.scale.set(largura, altura, 1);
  if (typeof obj.updateMatrix === "function") obj.updateMatrix();
  return obj;
}
