/** Textos da opening (pt-BR). */

export const TXT = Object.freeze({
  visitLab: "Vá ao laboratório do Professor Carvalho em Pallet.",
  checkLab: "Fale com o Professor no laboratório.",
  rescueRoute: "Algo aconteceu na Rota 1 — vá ajudar o Professor!",
  rescueHelp: [
    "Socorro! Esses Rattata me cercaram!",
    "Há uma bolsa com Pokébolas ali — pegue uma e me ajude!",
  ],
  rescuePointBag: ["Aquela caixa! As Pokébolas de teste estão dentro."],
  rescueChoice: ["Escolha uma Pokébola de emergência!"],
  outroThanks: ["Você salvou minha pesquisa… e a mim!"],
  outroPraise: ["Esse Pokémon confia em você. Sinto um potencial raro."],
  outroLabInvite: ["Volte ao laboratório. Preciso apresentar você a três treinadores."],
  sceneThreeBriefing: [
    "Red, Blue e Leaf também buscaram Pokémon iniciais.",
    "Assista — e depois escolha o seu de verdade.",
  ],
  redVow: ["Eu vou ser o melhor treinador do mundo!"],
  blueVow: ["Hmph. Não me atrapalhe, novato."],
  leafVow: ["Vamos cuidar bem dos nossos Pokémon, ok?"],
  parcelAsk: [
    "Leve este pacote até Viridian para mim.",
    "Quando voltar, escolha seu Pokémon inicial permanente.",
  ],
  parcelDone: ["Entregue! Obrigado. Agora escolha seu inicial na mesa."],
  finalChoice: ["Escolha com cuidado — este Pokémon será seu parceiro."],
  scientistBrief: [
    "O Professor saiu para a Rota 1 e ainda não voltou…",
    "Você poderia verificar se ele está bem?",
  ],
  oakIdleLab: [
    "Bem-vindo ao laboratório!",
    "Os Pokémon iniciais estão na mesa… mas primeiro preciso da sua ajuda na Rota 1.",
  ],
  jennyReport: [
    "Armazéns da Equipe Rocket? Conte-me tudo.",
    "Limpe os 8 esconderijos e reporte a cada um que limpar.",
  ],
  jennyTurnIn: ["Ótimo trabalho. Continue assim — a região depende de você."],
  jennyDone: ["Todos os armazéns limpos. Viridian agradece."],
  rocketOverhearA: ["Giovanni falhou… mas os depósitos ainda estão ativos."],
  rocketOverhearB: ["Calado! Tem alguém ouvindo… vamos embora!"],
});

export function retratoOak(emotion) {
  const base = "/assets/people/retratos/dp-prof-oak";
  if (emotion === "pinch") return `${base}/in-a-pinch.png`;
  if (emotion === "serious") return `${base}/serious-shot.png`;
  if (emotion === "thinking") return `${base}/thinking-shot.png`;
  return `${base}/frontal-shot.png`;
}

export function retratoRival(id) {
  if (id === "red") return "/assets/people/retratos/red/frontal-shot.png";
  if (id === "blue") return "/assets/people/retratos/blue/frontal-shot.png";
  if (id === "leaf") return "/assets/people/retratos/leaf/frontal-shot.png";
  return "";
}

export function retratoRocket(sexo) {
  // Só há asset feminino no repo; masculino usa Galactic grunt até o swap.
  if (sexo === "m") return "/assets/people/retratos/dp-team-galactic-male/frontal-shot.png";
  return "/assets/people/retratos/hgss-female-rocket-grunt/frontal-shot.png";
}
