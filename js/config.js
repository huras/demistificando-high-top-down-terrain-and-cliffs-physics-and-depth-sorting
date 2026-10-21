/**
 * Célula horizontal = 1. Altura do bloco = metade do lado.
 * A simulação conta degraus (1 bloco = 1); a tela e o 3D espremem só o eixo vertical.
 */
export const ALTURA_BLOCO = 0.5;
export const TILE = 16;
/** Pixels de um degrau, antes do ESCALA. */
export const FACE_H = TILE * ALTURA_BLOCO;
export const ESCALA = 2;
export const EPS_SORT = 0.001;

export const RAIO_CORPO = 0.28;
/** Disco do Pokémon no chão. Soma com o do outro corpo. */
export const RAIO_POKEMON = 0.34;
/** Base do tronco e da pedra. A copa continua só visual. */
export const RAIO_BASE_ARVORE = 0.36;
export const RAIO_BASE_PEDRA = 0.44;
/** Altura do corpo em células (pés → topo da cabeça) pra AABB voxel. */
export const ALTURA_CORPO = 1.7;

/** Corrida (células/s e células/s²). */
export const VELOCIDADE_MAX = 5.4;
export const VELOCIDADE_SPRINT = 8.2; // Shift
export const ACELERACAO_CHAO = 32;
export const ATRITO_CHAO = 26;
export const ACELERACAO_AR = 16;
export const ATRITO_AR = 1.8;

/** Agente que segue o jogador. */
export const AGENTE_VEL_MUL = 1;
export const AGENTE_DIST_PARAR = 1.15;
/** NPC seguidor e Pokémon do time: param antes de encostar no jogador. */
export const AGENTE_DIST_SEGUIR = 2.45;
/** Só “chegou” se |Δelev| estiver abaixo disto (evita satisfeito no tile ao lado do cliff). */
export const AGENTE_GAP_ELEV_PARAR = 0.85;

/** Pathfinding compartilhado (muitas entidades). */
export const PATH_EXPAND_POR_FRAME = 768;
export const PATH_REPATH_LIDER_CELULA = true;
export const PATH_STUCK_SEG = 0.6;
export const PATH_RETRY_SEM_CAMINHO = 1.25;
/** Overhead fixo de attach/mantle (o tempo vertical usa ESCALADA_VEL). */
export const PATH_CUSTO_ESCALADA = 0.45;
/** Glide NavLinks (asa-delta no grafo). */
/** Queda mínima a partir do chão (não do ápice) pra virar glide. */
export const PATH_GLIDE_QUEDA_MIN = 2;
/** Distância horizontal mínima — evita micro-glide / asa contra cliff. */
export const PATH_GLIDE_DIST_MIN = 4;
/** Pico→pico mesma altura: só com vão largo. */
export const PATH_GLIDE_PICO_DIST_MIN = 8;
/** Vão entre montanhas da demo ≈ 21; precisa cobrir pico→pico. */
export const PATH_GLIDE_ALCANCE_MAX = 32;
/** Fator vs alcance físico (1 = teórico; um pouco generoso pra pico→pico). */
export const PATH_GLIDE_ALCANCE_MUL = 0.95;
/**
 * Altura extra de lançamento (pulo→asa) só pro envelope/alcance.
 * Nunca permite pousar acima do z do chão de origem.
 */
export const PATH_GLIDE_PULO_BONUS = 2.2;
/** Multiplicador de custo da aresta glide (<1 = A* prefere asa vs contorno). */
export const PATH_GLIDE_CUSTO_MUL = 0.55;
/** Folga mínima (células) pra abrir asa por heurística de queda. */
export const AGENTE_GLIDE_HEUR_FOLGA = 2.2;

/** Fly NavLinks (voo livre no grafo). */
export const PATH_VOO_DIST_MIN = 3;
export const PATH_VOO_ALCANCE_MAX = 28;
export const PATH_VOO_CUSTO_MUL = 0.42;
export const PATH_VOO_VEL = 7.5;

/** Voo livre (jogador F / companheiro path). */
export const VOO_VEL_VERT = 5.2;
export const VOO_VEL_HORIZ_MUL = 1.15;
export const VOO_POUSO_EPS = 0.2;

/**
 * Pulo Mario: segurar Space = gravidade leve; soltar = corta vz.
 * Hold ≈ v²/(2·g_hold) ≈ 1.49 (20% acima de 1.24). Tap = hop curto.
 * Apex: t≈v/g_hold ≈ 0.42s.
 */
export const PULO_VELOCIDADE = 6.4 * Math.sqrt(1.2);
export const GRAVIDADE = 24;
export const GRAVIDADE_PULO_SEGURANDO = 16.5;
export const PULO_CORTE_SOLTAR = 0.42;
export const PULO_COYOTE = 0.09;
export const PULO_BUFFER = 0.12;
export const PULO_EPS_POUSO = 0.08;

/**
 * Asa-delta — só com 2º toque de Space no ar (nunca hold).
 * 3º toque fecha.
 */
export const ASA_DELTA_DESCIDA = 0.55;
export const ASA_DELTA_ABRIR_APOS = 0.08;
export const ASA_DELTA_LIFT_MIN = 0.12;
export const ASA_DELTA_VEL_MUL = 1.2;
export const ASA_DELTA_ACEL_AR = 22;
export const ASA_DELTA_ATRITO_AR = 0.5;
/** Shift no planar e no voo: velocidade horizontal × isto. */
export const ASA_DELTA_CORRIDA_MUL = 3;
/** Ctrl esquerdo no planar: descida × isto. */
export const ASA_DELTA_DESCIDA_CTRL_MUL = 3;

/** Escalada grudada (BOTW) — células/s na face. */
export const ESCALADA_VEL = 1.85;
export const ESCALADA_MANTLE_EPS = 0.12;
export const ESCALADA_IMPULSO_SOLTAR = 2.8;
/** Mantle: arco suave pro topo (em vez de teleporte). */
export const ESCALADA_MANTLE_DUR = 0.32;
export const ESCALADA_MANTLE_ARCO = 0.42;

/** Stamina (unidades arbitrárias). */
export const STAMINA_MAX = 100;
export const STAMINA_DRAIN_ESCALADA = 18;
export const STAMINA_REGEN = 28;

/**
 * Água. Profundidade = superfície − piso sólido.
 * Até o limiar dá pra vadear; acima disso o corpo flutua
 * na mesma imersão de quem ainda pisa no limite.
 */
export const AGUA_LIMIAR_VADO = 1.05;
/** Pés no nado: a mesma linha do vau no limite. */
export const AGUA_FLUTUA = AGUA_LIMIAR_VADO;
/** Lâmina visual abaixo do chanfro da margem (bate com QUEDA_LABIO + folga). */
export const AGUA_OFFSET_LAMINA = 0.18;
/** Além de AGUA_FLUTUA, o quanto o corpo desce ao afogar. */
export const AGUA_AFOGA_EXTRA = 0.8;
export const AGUA_VEL_NADO = 2.4;
export const AGUA_CORRENTE = 2.2;
export const AGUA_QUEDA_VEL = 7.5;
export const AGUA_DRAIN_NADO = 10;
export const AGUA_DRAIN_NADO_PARADO = 4;
export const AGUA_AFOGA_SEG = 2.5;
export const AGUA_BRACADA_VZ = 8.1;
export const AGUA_BRACADA_CUSTO = 22;
export const AGUA_CUSTO_NAV = 4;
export const AGUA_CUSTO_NAV_RASO = 1.65;

/** Balanço só visual do nado, em blocos. Não entra na física. */
export const AGUA_NADO_BOB_A = 0.05;
export const AGUA_NADO_BOB_B = 0.03;
export const AGUA_NADO_BOB_PARADO = 0.62;

/** Elipse na lâmina. rx cresce até CRESCE vezes; ry é fração de rx. */
export const AGUA_ONDA_INTERVALO = 0.12;
export const AGUA_ONDA_INTERVALO_PARADO = 0.55;
export const AGUA_ONDA_VIDA = 0.9;
export const AGUA_ONDA_RX = 0.7;
export const AGUA_ONDA_CRESCE = 2.6;
export const AGUA_ONDA_RY = 0.38;
export const AGUA_ONDA_ATRAS = 0.25;
export const AGUA_ONDA_PASSO = 0.022;
export const AGUA_IMERSAO_MIN = 0.12;

/** Gota ao sair e enquanto o molhado durar. */
export const AGUA_GOTA_VIDA = 0.35;
export const AGUA_GOTA_GRAV = 14;
export const AGUA_GOTA_RAJADA = 5;
export const AGUA_GOTA_PINGA = 0.4;
export const AGUA_MOLHA_SEG = 5;

/** Pegada no seco, carregada na água. */
export const AGUA_PEGADA_CARGA = 6;
export const AGUA_PEGADA_DIST = 0.62;
export const AGUA_PEGADA_INTERVALO = 0.14;
export const AGUA_PEGADA_VEL = 0.2;
export const AGUA_PEGADA_VIDA = 6.2;
export const AGUA_PEGADA_TAM = 0.28;
export const AGUA_PEGADA_LATERAL = 0.14;
export const AGUA_PEGADA_CHEIO = 0.55;

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 3.5;
export const ZOOM_PASSO = 1.12;
export const CAMERA_SUAVIDADE = 7;

/** Câmera terceira pessoa (modo 3D). */
export const CAMERA3D_DIST_MIN = 4;
export const CAMERA3D_DIST_MAX = 32;
export const CAMERA3D_DIST_PADRAO = 28.8;
export const CAMERA3D_ALTURA = 3.2;
export const CAMERA3D_OLHAR_Y = 1.15;
export const CAMERA3D_PIVO_MIN = 0.4;
export const CAMERA3D_PIVO_MAX = 2.6;
/** Pitch fixo da órbita (rad). O mouse só gira o yaw. 45° olhando para baixo. */
export const CAMERA3D_PITCH_ORBITA = Math.PI / 4;
/** Inclinação do cartão na terceira pessoa (rad). Negativo deita o topo para trás. */
export const BILLBOARD_INCLINACAO = -Math.PI / 4;
/** Suavidade só no follow vertical (Y). XZ é instantâneo. */
export const CAMERA3D_SUAVIDADE_Y = 6;
/** Quão rápido a câmera entra e sai da mira. */
export const CAMERA3D_MIRA_SUAVIDADE = 10;
/** Distância e deslocamento lateral da mira no ombro. */
export const CAMERA3D_MIRA_DIST = 2.4;
export const CAMERA3D_MIRA_OMBRO = 0.62;
/** rad/s — fallback teclado (legado); mouse usa sensibilidade. */
export const CAMERA3D_ROT_VEL = 2.4;
/** Mouse-look 3D (rad por pixel). */
export const CAMERA3D_MOUSE_SENS = 0.0022;
/** Negativo = mirar para cima (~-77°). A câmera não desce no chão. */
export const CAMERA3D_PITCH_MIN = -1.35;
export const CAMERA3D_PITCH_MAX = 1.15;
/** Pitch da mira (mais fechado que a órbita). */
export const CAMERA3D_MIRA_PITCH_MIN = -0.85;
export const CAMERA3D_MIRA_PITCH_MAX = 0.7;
/** Alinha o yaw nas costas enquanto anda (mecanismo “costas”). */
export const CAMERA3D_COSTAS_SUAVIDADE = 3.2;
/** Mistura perspectiva → ortográfica. Mais baixo = a mudança dura mais. */
export const CAMERA3D_PROJECAO_SUAVIDADE = 4;

/** Flecha da mira (unidades Three / s). Toque curto sai fraco; a carga chega em FLECHA_VEL. */
export const FLECHA_VEL = 36;
export const FLECHA_VEL_MIN = 16;
export const FLECHA_CARGA_TEMPO = 0.7;
export const FLECHA_GRAVIDADE = 8;
export const FLECHA_VIDA = 8;
export const FLECHA_MAX = 16;

export const CAMINHOS = {
  jogador: "assets/people/gold.png",
  asaDelta: "assets/items/asa_delta.png",
  grama: "assets/terrain/grass.png",
  terra: "assets/terrain/dirt.png",
  /**
   * Path principal 2D: grass-on-dirt 3×4 (Zerudez).
   * Rows 0–2 = chão com lip; row 3 = OUT_SW/EDGE_S/OUT_SE _UNDER (cliff).
   */
  grassOnDirt: "assets/terrain/grass-on-dirt.png",
  /** Fallback legado 5×N. */
  cliffSimples: "assets/terrain/cliff-autotile.png",
  cliffDuplo: "assets/terrain/double-cliff-autotile.png",
  /** Rocha 32×32 do tileset de overworld. Uma textura para todo penhasco, sem tinta. */
  penhascoDs: "assets/terrain/penhasco-ds.png",
  mata: "assets/vegetation/green-grass.png",
  arvore: "assets/trees/broadleaf.png",
};

/** Preferir tiles reais quando o atlas de terreno carregar; tecla T alterna. */
export const VISUAL_REAL_PADRAO = true;

/**
 * Árvore e mata, 2D e 3D. Tamanho mundo = (px do PNG / TILE) × escala.
 * Cutout no passe opaco (sem soft-alpha).
 */
export const VEG_ALPHA_TEST = 0.12;
export const VEG_ARVORE_ESCALA = 1;
export const VEG_MATA_ESCALA = 0.75;
/** Só reescreve instanceMatrix se o yaw mudou mais que isto (rad). */
export const VEG_YAW_EPS = 0.001;

export const JOGADOR_FRAME = 64;
export const JOGADOR_ESCALA = 0.5;
/**
 * Quadro do jogador no mundo (voxels).
 * 64 × 0.5 / 16 = 2, o mesmo tile de 16px do overworld do Pokémon AI.
 * Árvore e detalhe já usam (px / TILE) × escala.
 */
export const ALTURA_SPRITE_JOGADOR = (JOGADOR_FRAME * JOGADOR_ESCALA) / TILE;

/**
 * Sheets processados.
 *
 * grass-on-dirt (3×4, GOD_COLS): chão com lip + cliff UNDER na row 3.
 * Topo = 4 quartos de borda (solo / faixa V/H). Sem IN_*; sem faixa lateral W/E.
 *
 * Legado 5×N (SHEET_COLS): floor band + cliff single/double.
 */
export const TILE_ART = 16;
/** Sheet legado Pokemon AI (5 colunas). */
export const SHEET_COLS = 5;
export const FLOOR_ROW_OFFSET = 3;
/** Sheet grass-on-dirt (3 colunas). */
export const GOD_COLS = 3;
export const GOD_OUT_NW = 0;
export const GOD_EDGE_N = 1;
export const GOD_OUT_NE = 2;
export const GOD_EDGE_W = 3;
export const GOD_CENTER = 4;
export const GOD_EDGE_E = 5;
export const GOD_OUT_SW = 6;
export const GOD_EDGE_S = 7;
export const GOD_OUT_SE = 8;
export const GOD_OUT_SW_UNDER = 9;
export const GOD_EDGE_S_UNDER = 10;
export const GOD_OUT_SE_UNDER = 11;

export const ROLE_OUT_NW = 0;
export const ROLE_EDGE_N = 1;
export const ROLE_OUT_NE = 2;
export const ROLE_IN_SE = 3;
export const ROLE_IN_SW = 4;
export const ROLE_EDGE_W = 5;
export const ROLE_CENTER = 6;
export const ROLE_EDGE_E = 7;
export const ROLE_OUT_SW = 10;
export const ROLE_EDGE_S = 11;
export const ROLE_OUT_SE = 12;
export const ROLE_IN_NE = 13;
export const ROLE_IN_NW = 14;
/** Legado double-cliff. */
export const ROLE_OUT_SW_UNDER = 15;
export const ROLE_EDGE_S_UNDER = 16;
export const ROLE_OUT_SE_UNDER = 17;
/** @deprecated */
export const ROLE_CLIFF_CENTER = ROLE_EDGE_S;

/** Voxel / mundo infinito. O patch demo só entra com ?demo=1. */
export const USAR_PATCH_DEMO =
  typeof location !== "undefined" && new URLSearchParams(location.search).has("demo");
export const CHUNK_XZ = 16;
export const CHUNK_Y = 64;
/** Disco de chunks em volta do jogador. 5 ≈ 80 blocos. */
export const RAIO_STREAM = 5;
export const RAIO_STREAM_MIN = 0;
export const RAIO_STREAM_MAX = 10;
/** Disco externo da malha suave, em chunks. 0 desliga. A câmera ortográfica não mostra esse anel. */
export const RAIO_SUAVE = 0;
export const RAIO_SUAVE_MIN = 0;
export const RAIO_SUAVE_MAX = 20;
/** Distância entre vértices da malha suave, em blocos. */
export const PASSO_MALHA_SUAVE = 8;
/**
 * LOD horizonte terraced (estilo BOTW), em unidades de CHUNK_XZ.
 * 80 ≈ 1280 blocos de alcance. 0 desliga.
 */
export const RAIO_HORIZONTE = 80;
export const RAIO_HORIZONTE_MIN = 0;
export const RAIO_HORIZONTE_MAX = 160;
/** Célula da malha horizonte, em blocos (precisa dividir CHUNK_HORIZONTE). */
export const PASSO_HORIZONTE = 16;
/** Quantização de altura (blocos) para degraus. */
export const QUANT_ALTURA_HORIZONTE = 2;
/** Lado de um chunk de horizonte, em blocos. */
export const CHUNK_HORIZONTE = 128;
/** Blocos por repetição de tile no LOD horizonte (1 = mesmo tiling dos chunks detalhados). */
export const UV_ESCALA_HORIZONTE = 1;
/** Oceano do horizonte: 1 = mesmo tiling da água dos chunks detalhados. */
export const UV_ESCALA_MAR_HORIZONTE = 1;
/** Árvores billboard em todo o disco suave, fora dos chunks de bloco. */
export const IMPOSTOR_CAP = 256;
export const SEED_MUNDO = 1337;
export const ALCANCE_EDICAO = 5;
/** Cursor enxerga o chão com a câmera longe; editar continua no alcance curto. */
export const ALCANCE_MIRA = 320;
/** Chunks de malha 3D reconstruídos por frame (evita hitch de 200ms+ ao streamar). */
export const MESH_CHUNKS_POR_FRAME = 1;
/** Score: quanto menos, mais urgente. Boost grande = chunks na tela quase sempre primeiro. */
export const PRIORIDADE_BOOST_TELA = 40;
/** Peso do alinhamento com a direção prevista (0.5s/2s/8s). */
export const PRIORIDADE_PESO_DIR = 12;
/** Score acima disso + fora da tela + atrás → pode adiar se houver urgentes. */
export const PRIORIDADE_LIMIAR_ADIAR = 18;
/** Diferença de score pra preemptar fatia/malha em andamento. */
export const PRIORIDADE_LIMIAR_PREEMPT = 8;
/**
 * Inset do bevel só em voxels de borda de cliff (suaviza a aresta).
 * 0 = desliga; lados colados a sólido ficam flush.
 * `let` de propósito: a página de faces altera ao vivo e o mesher lê o valor na hora.
 */
export let TRONCO_INSET = 0.12;

export function definirTroncoInset(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return TRONCO_INSET;
  TRONCO_INSET = Math.max(0, Math.min(0.45, n));
  return TRONCO_INSET;
}
/** Raio (células) da grade de pathfinding em torno do centro. */
export const NAV_RAIO = 28;
/** Máx. pisos walkable por coluna no grafo de navegação. */
export const NAV_MAX_PISOS = 4;
/** Margem extra (células) no cull do terreno 2D. */
export const TERRENO_2D_MARGEM = 4;

/** Fade de cobertura 2D — tiles/props que desenham na frente do player. */
export const FADE_COBERTURA_ATIVO = false;
export const FADE_COBERTURA_ALPHA = 0.28;
/** Velocidade do lerp exponencial (1/s). */
export const FADE_COBERTURA_VEL = 10;
/**
 * Raio de visão (células de mundo) — janela circular onde o terreno
 * na frente do player fica transparente pra ele ver o que acontece.
 */
export const FADE_COBERTURA_RAIO = 8.6;
/** Meia-largura da query de peças em torno do player (células). */
export const FADE_COBERTURA_RAIO_X = 10;
/** Meia-altura da query (faces sul estendem na tela). */
export const FADE_COBERTURA_RAIO_Y = 20;
/**
 * Só fade se z da peça > z do player + isto.
 * 2 = cliffs de 1 e 2 degraus no chão do player ficam opacos.
 */
export const FADE_COBERTURA_DELTA_Z_MIN = 2;
/**
 * Sob teto (caverna/deck): fade só do teto/parede LOCAL (colunas sob a cabeça).
 * Exterior de cima fica opaco — sem X-ray do mundo acima.
 */
export const FADE_COBERTURA_SOB_TETO = true;
/** Cor de fundo na visão de caverna 2D (sem mundo exterior). */
export const CAVERNA_2D_FUNDO = "#07060a";

/**
 * Selvagens, party e combate. Números alinhados ao overworld de referência
 * (grama 0.14 / 2.5s / 4 ativos, desmaio 60s, aviso 7, agro 9).
 */
export const POKEMON = Object.freeze({
  CHANCE_GRAMA: 0.1,
  COOLDOWN_GRAMA: 3.2,
  MAX_GRAMA: 3,
  MAX_MORADORES: 10,
  LARES_POR_CHUNK: 1,
  RAIO_SIM: 42,
  RAIO_MANTER: 56,
  RAIO_MANTER_AGRO: 80,
  RAIO_LARES: 64,
  MIN_ESPACO_LARES: 20,
  MIN_ESPACO_GRAMA: 10,
  FOLGA_SPAWN: 14,
  RAIO_TERRITORIO: 10,
  RAIO_AVISO: 7,
  RAIO_AGRO: 9,
  RAIO_SOLTA: 13.5,
  ESPERA_MIN: 1.2,
  ESPERA_MAX: 3.8,
  RESPAWN: 60,
  RESPAWN_CAPTURA: 12,
  SHINY: 0.01,
  HOSTIL: 0.35,
  PARTY_MAX: 6,
  BOLAS: 999,
  RAIO_PICKUP: 1.5,
  PROJETEIS_MAX: 64,
  DROPS_MAX: 48,
  CACHE_ATLAS: 24,
  CACHE_RETRATO: 64,
  VEL_AGRO: 4.2,
  VEL_ROAM: 1.45,
});
