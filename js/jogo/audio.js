/** Efeitos curtos. A música só entra quando existir arquivo em assets/musica. */

let ctx = null;
let mudo = false;

function audio() {
  if (ctx) return ctx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

export function destravarAudio() {
  const ac = audio();
  if (ac && ac.state === "suspended") ac.resume();
}

/** A chave continua sendo calculada. Sem arquivo, não sai som. */
export function definirBgm(_chave) {}

export function chaveBgm(zona, clima, interiorKind) {
  if (interiorKind === "heal") return "hub.center";
  if (interiorKind === "mart") return "hub.mart";
  if (interiorKind === "house") return "hub.house";
  if (clima && clima !== "limpo") return "chuva";
  if (zona?.tipo === "cidade") return "cidade";
  return "campo";
}

export function sfx(tipo) {
  const ac = audio();
  if (!ac || mudo) return;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.connect(g);
  g.connect(ac.destination);
  const agora = ac.currentTime;
  if (tipo === "porta") o.frequency.setValueAtTime(520, agora);
  else if (tipo === "cura") o.frequency.setValueAtTime(660, agora);
  else if (tipo === "cavar") o.frequency.setValueAtTime(140, agora);
  else if (tipo === "colher") o.frequency.setValueAtTime(780, agora);
  else o.frequency.setValueAtTime(440, agora);
  g.gain.setValueAtTime(0.04, agora);
  g.gain.exponentialRampToValueAtTime(0.001, agora + 0.12);
  o.start(agora);
  o.stop(agora + 0.14);
}

export function alternarMudo() {
  mudo = !mudo;
  return mudo;
}
