import {
  CAMINHOS,
  CHUNK_XZ,
  PASSO_HORIZONTE,
  PASSO_MALHA_SUAVE,
  RAIO_HORIZONTE_MAX,
  RAIO_HORIZONTE_MIN,
  RAIO_STREAM_MAX,
  RAIO_STREAM_MIN,
  RAIO_SUAVE_MAX,
  RAIO_SUAVE_MIN,
  ZOOM_PASSO,
  USAR_PATCH_DEMO,
} from "./config.js";
import { ligarEdicaoBlocos } from "./entrada/edicaoBlocos.js";
import { arcoNaMao } from "./jogo/blocos.js";
import { atualizarHoverBloco, ligarHoverBloco } from "./entrada/hoverBloco.js";
import {
  botaoDireitoSegurado,
  botaoEsquerdoSegurado,
  consumirMovimentoMouse,
  consumirSolturaEsquerda,
  definirPredicadoTravaMira,
  desligarPonteiro3d,
  ligarPonteiro3d,
  soltarTravaMira,
} from "./entrada/ponteiro3d.js";
import { iniciarTeclado, teclaAgora } from "./entrada/teclado.js";
import { avancarHora, obterClima, alternarClima } from "./render/3d/ceu/controleCeu.js";
import { forcarClimaPreset } from "./clima/amostra.js";
import { atualizarAgente, criarAgente, resetarNav } from "./fisica/agente.js";
import { atualizarMovimento, criarCorpo } from "./fisica/movimento.js";
import { definirCorposAtores, definirCorposFixos } from "./fisica/obstaculos.js";
import { iniciarStamina } from "./fisica/stamina.js";
import { AGENTE_DIST_SEGUIR, OFFSET_NPC } from "./navegacao/espacoSeguir.js";
import { tickFilaPath } from "./navegacao/filaPath.js";
import { atualizarPasseio, ligarBotaoPasseio, passeioAtivo } from "./debug/passeioKanto.js";
import { CAPS_PADRAO } from "./navegacao/capacidades.js";
import { carregarCatalogo } from "./mundo/bioma/catalogo.js";
import { carregarDetalhe } from "./mundo/bioma/detalhe.js";
import { carregarKits } from "./mundo/bioma/kits.js";
import { gravarRecorteAoRedor } from "./diagnostico/recorteFaces.js";
import { SPAWN as SPAWN_DEMO } from "./mundo/mapaDemo.js";
import { SPAWN_PALLET } from "./mundo/regiao/spawnKanto.js";
import {
  atualizarStreaming,
  atualizarStreamingDuplo,
  definirRaioStream,
  iniciarMundoAoRedor,
  marcarChunkSujo,
  obterRaioStream,
  paraCadaChunk,
} from "./mundo/voxel/storeMundo.js";
import { aplicarCascaNoChunk, carregarCascasCidade } from "./mundo/cidade/cascaCasa.js";
import { indexarColisaoCidade } from "./mundo/cidade/colisaoDecor.js";
import { invalidarNavCache } from "./navegacao/navGrade.js";
import { ligarControleModo, obterModo, alternarModo, aoMudarModo } from "./modoJogo.js";
import { alternarVisual, montarAtlas, usarTiles } from "./render/atlas.js";
import { carregarVisuaisKits } from "./render/visuaisKit.js";
import { ajustarZoom, criarCamera } from "./render/camera.js";
import { desenharCena2d, desenharHudSobre3d } from "./render/renderizador2d.js";
import { tickPoeiraPasso } from "./fx/poeiraPasso.js";
import { tickFxAgua } from "./fx/fxAgua.js";
import { tickAguaPulo } from "./jogo/som/aguaPulo.js";
import { tickPassos } from "./jogo/som/passos.js";
import { ligarAjudaAtalhos } from "./ui/ajudaAtalhos.js";
import { ligarMapaKanto, atualizarMapaKanto } from "./ui/mapaKanto.js";
import { ligarMapaMundo, mapaAberto, tickMapaMundo } from "./ui/mapa/mapaMundo.js";
import { ligarDicasPainel } from "./ui/dicasPainel.js";
import { ligarPainelCeu, sincronizarPainelCeu } from "./ui/painelCeu.js";
import { ligarPainelCamera, sincronizarPainelCamera } from "./ui/painelCamera.js";
import { ligarPainelDebug } from "./ui/painelDebug.js";
import { ligarHudCompanheiro, atualizarHudCompanheiro } from "./ui/hudCompanheiro.js";
import {
  ativarInputRelativoCamera,
  desativarInputRelativoCamera,
} from "./render/3d/adaptadorInput3d.js";
import { definirRaioSuave, obterRaioSuave } from "./render/3d/terrenoSuave.js";
import { definirRaioHorizonte, obterRaioHorizonte } from "./render/3d/terrenoHorizonte.js";
import {
  ajustarZoom3d,
  atualizarEDesenhar3d,
  aquecerProgramas3d,
  definirMira3d,
  definirPuxadaFlecha,
  entrarVistaCena,
  iniciarCenario3d,
  olharCamera3d,
  obterCenario3d,
  redimensionarCenario3d,
  resetarCamera3d,
} from "./render/3d/cenario3d.js";
import { aplicarScrollCena, enquadrarSelecaoCena } from "./cena/cameraCena.js";
import { alternarModoCena, aoMudarCena, definirModoCena, estaEmCena } from "./cena/modoCena.js";
import { ligarHierarquiaCena, sincronizarHierarquiaCena } from "./ui/cena/hierarquia.js";
import { ligarInspetorCena, sincronizarInspetorCena } from "./ui/cena/inspetor.js";
import { carregarDados } from "./pokemon/dados.js";
import { ligarPokemon, listarSolidosPokemon, tickPokemon } from "./pokemon/sistema.js";
import { despenetrarCorpos } from "./pokemon/locomocao.js";
import { jogoTravaMundo, montarJogo, tickJogo } from "./jogo/index.js";
import {
  focoStreaming,
  teleporteNaOrigem,
  teleporteOcupado,
  tickTeleporte,
} from "./jogo/teleporte.js";
import { tickHistorico, vetorPredicao } from "./jogo/movimento/historicoMovimento.js";
import { tickJornada } from "./jogo/jornada.js";
import { aabbCamera2d, aabbVisivelChao } from "./render/3d/frustumChao.js";
import { definirContextoPrioridade } from "./mundo/voxel/prioridadeChunk.js";
import { rolarCategoria } from "./jogo/roda.js";

const SPAWN = USAR_PATCH_DEMO ? SPAWN_DEMO : SPAWN_PALLET;
const canvas = document.getElementById("canvas");
const canvas3d = document.getElementById("canvas-3d");
const viewport = document.querySelector(".palco__viewport");
const ctx = canvas.getContext("2d", { alpha: true });

let atlas;
let corpo;
let agente;
let camera;
let debug = false;
let ultimo = 0;
let cenario3dPronto = false;

function tamanhoViewport() {
  const rect = viewport?.getBoundingClientRect();
  const w = Math.max(320, Math.floor(rect?.width || window.innerWidth));
  const h = Math.max(240, Math.floor(rect?.height || window.innerHeight));
  return { w, h };
}

function redimensionarCena() {
  const { w, h } = tamanhoViewport();
  if (canvas.width === w && canvas.height === h) return;
  canvas.width = w;
  canvas.height = h;
  canvas3d.width = w;
  canvas3d.height = h;
  if (camera) {
    camera.largura = w;
    camera.altura = h;
  }
  if (cenario3dPronto) redimensionarCenario3d(w, h);
}

async function iniciar() {
  iniciarTeclado();
  redimensionarCena();
  await carregarKits();
  const visuaisKits = await Promise.all([
    montarAtlas(CAMINHOS),
    carregarVisuaisKits(),
    carregarCatalogo(),
    carregarDetalhe(),
  ]);
  atlas = visuaisKits[0];
  atlas.sprites = visuaisKits[1].sprites;
  atlas.centros = visuaisKits[1].centros;
  atlas.cliffs = visuaisKits[1].cliffs;
  window.__atlas = atlas;

  indexarColisaoCidade();
  iniciarMundoAoRedor(SPAWN.x, SPAWN.y);
  carregarCascasCidade().then((ok) => {
    if (!ok) return;
    paraCadaChunk((chunk) => {
      if (aplicarCascaNoChunk(chunk)) marcarChunkSujo(chunk);
    });
    invalidarNavCache();
  });
  // Nav só invalida em edição de bloco — streaming não deve rebuildar (era ~18s).

  corpo = criarCorpo(SPAWN);
  agente = criarAgente({
    x: SPAWN.x + OFFSET_NPC.x,
    y: SPAWN.y + OFFSET_NPC.y,
    z: SPAWN.z,
  });
  definirCorposFixos([corpo, agente]);
  camera = criarCamera(canvas.width, canvas.height);
  redimensionarCena();

  ligarHudCompanheiro(agente, CAPS_PADRAO);
  ligarRaioStream();
  ligarPainelCeu();
  ligarPainelCamera();
  ligarPainelDebug();
  ligarDicasPainel();
  ligarAjudaAtalhos();
  ligarMapaKanto();
  atualizarMapaKanto(SPAWN.x, SPAWN.y);
  ligarMapaMundo();
  ligarHierarquiaCena();
  ligarInspetorCena();
  try {
    const cat = await carregarDados();
    ligarPokemon();
    console.info(
      `Pokémon: ${cat.especies} espécies, ${cat.golpes} golpes, ${cat.biomas | 0} biomas de encontro`,
    );
  } catch (erro) {
    console.error("Pokémon não carregou", erro);
  }
  ligarControleModo(document.getElementById("btn-modo-3d"));
  ligarBotaoPasseio(document.getElementById("btn-passeio"), corpo);
  aoMudarModo(aoTrocarModo);
  aoMudarCena((ativo) => {
    if (ativo) {
      document.exitPointerLock?.();
      desligarPonteiro3d();
      entrarVistaCena(corpo);
    } else if (obterModo() === "3d") {
      ligarPonteiro3d(canvas3d);
    }
  });
  sincronizarCamadas(obterModo());
  if (obterModo() === "3d") aoTrocarModo("3d");
  // Tira o hitch de compile do 1º frame jogável (era ~700–1000 ms em render).
  if (obterModo() === "3d" && corpo) aquecerProgramas3d(corpo.x, corpo.y);

  const optsPonteiro = {
    canvas2d: canvas,
    canvas3d,
    obterCorpo: () => corpo,
    obterCamera2d: () => camera,
    obterCenario3d: () => (cenario3dPronto ? obterCenario3d() : null),
  };
  ligarEdicaoBlocos(optsPonteiro);
  ligarHoverBloco(optsPonteiro);

  const onWheel = (ev) => {
    ev.preventDefault();
    if (mapaAberto()) return;
    if (rolarCategoria(ev.deltaY)) return;
    if (obterModo() === "3d" && estaEmCena()) {
      aplicarScrollCena(ev.deltaY);
      return;
    }
    const fator = ev.deltaY < 0 ? ZOOM_PASSO : 1 / ZOOM_PASSO;
    if (obterModo() === "3d") ajustarZoom3d(fator);
    else ajustarZoom(camera, fator);
  };
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas3d.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("resize", redimensionarCena);

  window.__demo = {
    get corpo() {
      return corpo;
    },
    get camera() {
      return camera;
    },
    get modo() {
      return obterModo();
    },
    get agente() {
      return agente;
    },
    teleporte(x, y, z) {
      corpo.x = x;
      corpo.y = y;
      corpo.z = z;
      corpo.elevacao = z;
      corpo.vx = 0;
      corpo.vy = 0;
      corpo.vz = 0;
      corpo.pulo = null;
      corpo.escalada = null;
      corpo.mantle = null;
      corpo.pulando = false;
      corpo.planando = false;
      corpo.escalando = false;
      corpo.voando = false;
      corpo.nadando = false;
      corpo.afogandoT = 0;
      corpo.noChao = true;
      corpo.hopLift = 0;
      corpo.puloCortado = false;
      corpo.coyoteT = 0;
      corpo.puloBufferT = 0;
      corpo.tempoAr = 0;
      iniciarStamina(corpo);
      if (agente) {
        agente.x = x + OFFSET_NPC.x;
        agente.y = y + OFFSET_NPC.y;
        agente.z = z;
        agente.elevacao = z;
        agente.vx = 0;
        agente.vy = 0;
        agente.vz = 0;
        agente.hopLift = 0;
        agente.noChao = true;
        agente.pulando = false;
        agente.planando = false;
        agente.voando = false;
        agente.escalando = false;
        agente.nadando = false;
        agente.afogandoT = 0;
        agente.escalada = null;
        agente.mantle = null;
        agente.puloCortado = false;
        agente.coyoteT = 0;
        agente.tempoAr = 0;
        resetarNav(agente);
      }
      camera.pronta = false;
      resetarCamera3d();
      atualizarStreaming(x, y, undefined, true);
    },
  };

  ultimo = performance.now();
  montarJogo({ viewport, corpo });
  requestAnimationFrame(loop);
}

function textoRaioSuave(n) {
  if (n === 0) return "desligado";
  if (n <= obterRaioStream()) return "sem anel";
  return `${n} · ${n * CHUNK_XZ} blocos`;
}

function textoRaioHorizonte(n) {
  if (n === 0) return "desligado";
  return `${n} · ${n * CHUNK_XZ} blocos`;
}

function ligarRaioSuave() {
  const input = document.getElementById("raio-suave");
  const valor = document.getElementById("raio-suave-valor");
  const dica = document.getElementById("raio-suave-dica");
  if (dica) {
    dica.textContent = `Fora dos blocos, uma malha espaçada (vértices a cada ${PASSO_MALHA_SUAVE} blocos) cobre até esse raio.`;
  }
  if (!input) return () => {};
  input.min = String(RAIO_SUAVE_MIN);
  input.max = String(RAIO_SUAVE_MAX);
  input.value = String(obterRaioSuave());

  const aplicar = () => {
    const n = definirRaioSuave(Number(input.value));
    input.value = String(n);
    if (valor) valor.textContent = textoRaioSuave(n);
  };

  input.addEventListener("input", aplicar);
  aplicar();
  return aplicar;
}

function ligarRaioHorizonte() {
  const input = document.getElementById("raio-horizonte");
  const valor = document.getElementById("raio-horizonte-valor");
  const dica = document.getElementById("raio-horizonte-dica");
  if (dica) {
    dica.textContent = `Relevo terraced longe (células a cada ${PASSO_HORIZONTE} blocos), além do disco de blocos.`;
  }
  if (!input) return () => {};
  input.min = String(RAIO_HORIZONTE_MIN);
  input.max = String(RAIO_HORIZONTE_MAX);
  input.value = String(obterRaioHorizonte());

  const aplicar = () => {
    const n = definirRaioHorizonte(Number(input.value));
    input.value = String(n);
    if (valor) valor.textContent = textoRaioHorizonte(n);
  };

  input.addEventListener("input", aplicar);
  aplicar();
  return aplicar;
}

function ligarRaioStream() {
  const atualizarSuave = ligarRaioSuave();
  ligarRaioHorizonte();
  const input = document.getElementById("raio-stream");
  const valor = document.getElementById("raio-stream-valor");
  if (!input) return;
  input.min = String(RAIO_STREAM_MIN);
  input.max = String(RAIO_STREAM_MAX);
  input.value = String(obterRaioStream());

  const aplicar = () => {
    const n = definirRaioStream(Number(input.value));
    input.value = String(n);
    if (valor) {
      valor.textContent =
        n === 0 ? "só este chunk" : `${n} · ${n * CHUNK_XZ} blocos`;
    }
    atualizarSuave();
    if (corpo) atualizarStreaming(corpo.x, corpo.y, undefined, true);
  };

  input.addEventListener("input", aplicar);
  aplicar();
}

function garantir3d() {
  if (cenario3dPronto) return obterCenario3d();
  const cen = iniciarCenario3d(canvas3d, atlas);
  cenario3dPronto = true;
  return cen;
}

function aoTrocarModo(modo) {
  if (modo !== "3d") definirModoCena(false);
  sincronizarCamadas(modo);
  if (modo === "3d") {
    const cen = garantir3d();
    resetarCamera3d();
    ativarInputRelativoCamera(() => cen.yaw());
    ligarPonteiro3d(canvas3d);
    definirPredicadoTravaMira(
      () => obterModo() === "3d" && !estaEmCena() && !jogoTravaMundo() && arcoNaMao(),
    );
  } else {
    definirPredicadoTravaMira(null);
    desligarPonteiro3d();
    desativarInputRelativoCamera();
    definirMira3d(false);
    if (corpo) corpo.mirando = false;
    camera.pronta = false;
  }
}

function sincronizarCamadas(modo) {
  const em3d = modo === "3d";
  canvas3d.classList.toggle("palco__camada--ativa", em3d);
  canvas3d.classList.toggle("palco__camada--oculta", !em3d);
  canvas.classList.toggle("palco__camada--hud", em3d);
  canvas.classList.toggle("palco__camada--ativa", !em3d);
  document.body.dataset.modo = modo;
}

function campoFocado() {
  const tag = document.activeElement?.tagName;
  return tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";
}

function loop(agora) {
  const dt = Math.min(0.05, (agora - ultimo) / 1000);
  ultimo = agora;
  let trava = false;
  try {
    tickJogo(dt, corpo);
    trava = jogoTravaMundo();
  } catch (err) {
    console.error("Erro na interface:", err);
  }

  if (teclaAgora("Backquote")) debug = !debug;
  if (teclaAgora("KeyT")) alternarVisual(atlas);
  if (teclaAgora("Numpad3")) alternarModo();

  const horaMenos = teclaAgora("BracketLeft");
  const horaMais = teclaAgora("BracketRight");
  const climaTecla = teclaAgora("KeyG");

  const modo = obterModo();
  if (modo === "3d") {
    garantir3d();
    if (!campoFocado()) {
      if (horaMenos) avancarHora(-0.5);
      if (horaMais) avancarHora(0.5);
      if (climaTecla) {
        alternarClima();
        forcarClimaPreset(obterClima());
      }
      if (teclaAgora("KeyC")) alternarModoCena();
      if (estaEmCena() && teclaAgora("Escape")) definirModoCena(false);
      if (estaEmCena() && teclaAgora("KeyF")) enquadrarSelecaoCena();
    }
    if (!estaEmCena() && !trava) {
      const mouse = consumirMovimentoMouse();
      const comArco = arcoNaMao();
      const mirando = comArco && botaoDireitoSegurado();
      definirMira3d(mirando);
      if (!mirando) soltarTravaMira();
      olharCamera3d(mouse.dx, mouse.dy);
      definirPuxadaFlecha(mirando && botaoEsquerdoSegurado(), mirando && consumirSolturaEsquerda());
      if (teclaAgora("Equal") || teclaAgora("NumpadAdd")) ajustarZoom3d(ZOOM_PASSO);
      if (teclaAgora("Minus") || teclaAgora("NumpadSubtract")) {
        ajustarZoom3d(1 / ZOOM_PASSO);
      }
    } else {
      definirMira3d(false);
      soltarTravaMira();
      consumirSolturaEsquerda();
      definirPuxadaFlecha(false, false);
    }
  } else {
    soltarTravaMira();
    consumirSolturaEsquerda();
    definirPuxadaFlecha(false, false);
    if (!trava && (teclaAgora("Equal") || teclaAgora("NumpadAdd"))) ajustarZoom(camera, ZOOM_PASSO);
    if (!trava && (teclaAgora("Minus") || teclaAgora("NumpadSubtract"))) {
      ajustarZoom(camera, 1 / ZOOM_PASSO);
    }
  }

  if (!passeioAtivo() && !trava) atualizarMovimento(corpo, dt);
  tickFilaPath();
  if (passeioAtivo() && !trava) atualizarPasseio(corpo, dt);
  atualizarAgente(agente, corpo, dt, 0, AGENTE_DIST_SEGUIR);

  tickHistorico(corpo, dt);
  const pred = vetorPredicao();
  const elev = corpo.elevacao ?? corpo.z ?? 0;
  const cam3d = obterCenario3d()?.camera3d;
  const aabbTela =
    (modo === "3d" && cam3d ? aabbVisivelChao(cam3d, elev) : null) ||
    aabbCamera2d(camera);
  const foco = focoStreaming();
  const focoX = foco?.x ?? corpo.x;
  const focoY = foco?.y ?? corpo.y;
  definirContextoPrioridade({
    px: focoX,
    py: focoY,
    pcx: Math.floor(focoX / CHUNK_XZ),
    pcy: Math.floor(focoY / CHUNK_XZ),
    predX: pred.x,
    predY: pred.y,
    predLen: pred.len,
    aabbTela,
  });

  if (foco && teleporteNaOrigem()) {
    atualizarStreamingDuplo(corpo.x, corpo.y, foco.x, foco.y);
  } else if (foco) {
    atualizarStreaming(foco.x, foco.y);
  } else {
    atualizarStreaming(corpo.x, corpo.y);
  }
  tickJornada(corpo.x, corpo.y, dt);
  definirCorposAtores(listarSolidosPokemon());
  atualizarMapaKanto(corpo.x, corpo.y);
  tickMapaMundo(corpo.x, corpo.y, dt);
  tickPokemon(corpo, dt, agente.perfil);
  tickTeleporte(dt, {
    corpo,
    agente,
    camera,
    camera3d: cam3d,
    modo,
  });
  if (!trava) tickPoeiraPasso(dt, corpo, agente);
  if (!trava) tickFxAgua(dt, corpo, agente);
  if (corpo._renasceu) {
    corpo._renasceu = false;
    agente.x = corpo.x + OFFSET_NPC.x;
    agente.y = corpo.y + OFFSET_NPC.y;
    agente.z = corpo.z;
    agente.elevacao = corpo.z;
    agente.vx = 0;
    agente.vy = 0;
    agente.vz = 0;
    agente.hopLift = 0;
    agente.noChao = true;
    agente.pulando = false;
    agente.planando = false;
    agente.voando = false;
    agente.escalando = false;
    agente.nadando = false;
    agente.afogandoT = 0;
    agente.escalada = null;
    agente.mantle = null;
    agente.puloCortado = false;
    agente.coyoteT = 0;
    agente.tempoAr = 0;
    resetarNav(agente);
    camera.pronta = false;
    // Teleporte já drenou o destino em pousarCorpo; evita sync duplo.
    if (!teleporteOcupado()) {
      atualizarStreaming(corpo.x, corpo.y, undefined, true);
    }
  }
  if (!trava) tickPassos(dt, corpo, agente);
  if (!trava) tickAguaPulo(dt, corpo, agente);
  despenetrarCorpos();
  atualizarHudCompanheiro(agente);
  atualizarHoverBloco();
  sincronizarPainelCeu();
  sincronizarPainelCamera();
  sincronizarHierarquiaCena();
  sincronizarInspetorCena(dt);

  try {
    if (modo === "3d") {
      garantir3d();
      const cen = atualizarEDesenhar3d(corpo, dt, atlas, agente);
      const modoVisual = usarTiles(atlas) ? "real" : "cubos";
      desenharHudSobre3d(ctx, canvas, {
        corpo,
        camera3d: cen,
        debug,
        modoVisual,
        emCena: estaEmCena(),
      });
    } else {
      desenharCena2d(ctx, canvas, { atlas, corpo, camera, debug, dt, agente });
    }
  } catch (err) {
    console.error("Erro no frame:", err);
  }

  requestAnimationFrame(loop);
}

function ligarBotaoFaces() {
  const link = document.getElementById("btn-faces");
  if (!link) return;
  link.addEventListener("click", (ev) => {
    if (!corpo) return;
    ev.preventDefault();
    gravarRecorteAoRedor(corpo.x, corpo.y, corpo.elevacao ?? corpo.z ?? 0);
    window.location.href = link.getAttribute("href") || "faces.html";
  });
}

ligarBotaoFaces();

iniciar().catch((err) => {
  console.error(err);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#200";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.font = "14px monospace";
  ctx.fillText("Falha ao carregar assets. Sirva a pasta via HTTP.", 24, 40);
  ctx.fillText(String(err), 24, 64);
});
