import { definirAdaptadorVetor } from "../../entrada/teclado.js";

/**
 * WASD = strafe relativo ao yaw da câmera (Q/E orbitam; não gira com o facing).
 * yaw 0 = olha para −Z (norte).
 */
export function ativarInputRelativoCamera(obterYaw) {
  definirAdaptadorVetor((dx, dy) => {
    const yaw = obterYaw();
    const fwd = -dy;
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    const worldDx = cos * dx + -sin * fwd;
    const worldDy = -sin * dx + -cos * fwd;
    return { dx: worldDx, dy: worldDy };
  });
}

export function desativarInputRelativoCamera() {
  definirAdaptadorVetor(null);
}
