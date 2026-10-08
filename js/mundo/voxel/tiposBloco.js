/** IDs e flags de bloco. */

export const BLOCO = {
  AR: 0,
  GRAMA: 1,
  TERRA: 2,
  PEDRA: 3,
  AGUA: 4,
};

const FLAGS = {
  [BLOCO.AR]: { solido: false, climbavel: false, liquido: false },
  [BLOCO.GRAMA]: { solido: true, climbavel: true, liquido: false },
  [BLOCO.TERRA]: { solido: true, climbavel: true, liquido: false },
  [BLOCO.PEDRA]: { solido: true, climbavel: true, liquido: false },
  [BLOCO.AGUA]: { solido: false, climbavel: false, liquido: true },
};

export function ehSolido(id) {
  return !!FLAGS[id | 0]?.solido;
}

export function ehClimbavel(id) {
  return !!FLAGS[id | 0]?.climbavel;
}

/** Só o id de água. Ids desconhecidos continuam sendo ar. */
export function ehLiquido(id) {
  return !!FLAGS[id | 0]?.liquido;
}

export function nomeBloco(id) {
  switch (id | 0) {
    case BLOCO.GRAMA:
      return "grama";
    case BLOCO.TERRA:
      return "terra";
    case BLOCO.PEDRA:
      return "pedra";
    case BLOCO.AGUA:
      return "agua";
    default:
      return "ar";
  }
}
