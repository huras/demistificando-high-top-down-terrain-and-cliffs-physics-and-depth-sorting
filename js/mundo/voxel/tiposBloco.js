/** IDs e flags de bloco. */

export const BLOCO = {
  AR: 0,
  GRAMA: 1,
  TERRA: 2,
  PEDRA: 3,
};

const FLAGS = {
  [BLOCO.AR]: { solido: false, climbavel: false },
  [BLOCO.GRAMA]: { solido: true, climbavel: true },
  [BLOCO.TERRA]: { solido: true, climbavel: true },
  [BLOCO.PEDRA]: { solido: true, climbavel: true },
};

export function ehSolido(id) {
  return !!FLAGS[id | 0]?.solido;
}

export function ehClimbavel(id) {
  return !!FLAGS[id | 0]?.climbavel;
}

export function nomeBloco(id) {
  switch (id | 0) {
    case BLOCO.GRAMA:
      return "grama";
    case BLOCO.TERRA:
      return "terra";
    case BLOCO.PEDRA:
      return "pedra";
    default:
      return "ar";
  }
}
