# Billboards no 3D

Sprites no modo 3D não são malha com volume. São cartões com o PNG do 2D. Props e atores compartilham o mesmo pivô de base (pé no chão).

Núcleo: [`js/render/3d/billboard/`](../js/render/3d/billboard/)

| | Props (árvore, mata, grama, pedra, cristal) | Personagem e Pokémon |
|---|---|---|
| Arquivo | [`vegetacaoBillboard3d.js`](../js/render/3d/vegetacaoBillboard3d.js) | [`personagem3d.js`](../js/render/3d/personagem3d.js), [`pokemon/render3d.js`](../js/pokemon/render3d.js) |
| Objeto | `InstancedMesh` (um lote por sprite) | `Mesh` cartão (um por corpo) |
| Para quem olha | Yaw da câmera + inclinacao no X | Mesmo yaw + inclinacao |
| Pivô | Pé opaco (`pivoPe` + `assets/props/pivos.json`) | Pé do quadro + `assets/pokemon/pivos.json` |
| Sombra no chão | Outro cartão, virado para o sol | Elipse de contato |
| Cor | Luz da cena, normal trocada para o sol | Mesma irradiância (`aplicarCorSprite` / `aplicarLuzBillboard`) |

Placa não entra nesse caminho. Continua mesh em [`terrenoMalha.js`](../js/render/3d/terrenoMalha.js).

## Técnica do pivô de base

1. Posição mundo = contato com o terreno (centro da base).
2. Geometria: `geometriaNoPe(pivotX, pivotY)` — pé na origem local; o cartão sobe no +Y.
3. Pose: `poseCartao` com ordem `YXZ` — yaw para a câmera, depois `BILLBOARD_INCLINACAO` (topo para trás). O pe não sai do chão.
4. Centro visual fica acima da base (metade da altura). Serve para gizmos/editor; o depth continua no pe.
5. Depth: cartão inteiro escreve a profundidade do pe, puxada para a câmera (`FOLGA_PIVO` em [`luzBillboard.js`](../js/render/3d/ceu/luzBillboard.js)).

Na mira, o blend da câmera zera a inclinacao e o cartão fica em pe.

Editor de props: [`pivos-props.html`](../pivos-props.html) → `assets/props/pivos.json`.  
Editor de atores: [`pivos.html`](../pivos.html) → `assets/pokemon/pivos.json`.

## Ordem no frame

Em [`cenario3d.js`](../js/render/3d/cenario3d.js), `atualizarEDesenhar3d`:

1. A câmera segue o corpo.
2. `ceu.atualizar` posiciona sol/fill/rim e chama `atualizarLuzBillboard`.
3. Vegetação / prédios / FX recebem `(yaw, inclinacao)`.
4. Personagem, agente e Pokémon recebem o mesmo `(yaw, inclinacao)`.
5. O renderer desenha.

## Props

`recolherGrupos` junta `PROPS` do demo e a vegetação de bioma. Cada chave vira um `InstancedMesh` (máx. 4096). Um draw call por sprite.

```
largura = (px de largura / TILE) × escala
altura  = (px de altura  / TILE) × escala
```

| Tipo | Escala |
|---|---|
| `arvore` | `VEG_ARVORE_ESCALA` (1) |
| `mata`, `grama` e o resto | `VEG_MATA_ESCALA` (0.75) |
| `pedra`, `cristal` | 1 |

Dois cartões por lote: visível (yaw câmera + inclinacao) e sombra (yaw do sol, inclinacao 0).

O preview de bioma ([`preview3d.js`](../js/bioma/preview3d.js)) usa a mesma geo no pe e a mesma inclinacao.

## Personagem e Pokémon

Mesh unitário com pe na origem. O quadro do sheet atualiza a textura do canvas; o pivô do quadro atualiza a geo. Silhueta e véu d’água são meshes irmãos no mesmo pe.
