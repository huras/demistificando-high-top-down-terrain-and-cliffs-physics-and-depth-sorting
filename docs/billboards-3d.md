# Billboards no 3D

Sprites no modo 3D são cartões. Props e atores usam a mesma técnica de pivô elevado (high top-down).

Núcleo: [`js/render/3d/billboard/`](../js/render/3d/billboard/)

## Técnica (pivô elevado + DZ)

A arte é high top-down: o **centro do chão do objeto na pintura não é o pixel de baixo**.

1. Posição mundo `(x, chão, z)` = centro onde o objeto deve aparecer.
2. Na textura, `pivotX/pivotY` marca o **centro da base na arte** (cruz no editor).
3. Esse ponto vira a origem da geo. O cartão gira no YXZ em torno dele (yaw + `BILLBOARD_INCLINACAO`).
4. O Y sobe com `(opacoY - pivotY) * altura * cos(inclinacao)` pra o último pixel **opaco** cair no chão (padding transparente do PNG não conta).
5. **dz** empurra o cartão no +Z local (pra frente do billboard), pra o pivô elevado projetar certo apesar da perspectiva da arte.
6. Depth continua achatado no pivô (`FOLGA_PIVO`).

Diagrama mental: linha azul vertical no centro mundo → pivô; cartão vermelho inclinado; base toca o chão à frente.

Editor de props: [`pivos-props.html`](../pivos-props.html)  
- Esquerda 2D: marca o centro na arte (dx/dy).  
- Direita 3D: billboard **fixo** (+Z); câmera de órbita **independente** pra estudar o efeito.  
- Slider **dz**.

Editor de atores: [`pivos.html`](../pivos.html) → `assets/pokemon/pivos.json`.

## Ordem no frame

Em [`cenario3d.js`](../js/render/3d/cenario3d.js): luz → vegetação/prédios/FX com `(yaw, inclinacao)` → personagem/Pokémon com o mesmo par → render.
