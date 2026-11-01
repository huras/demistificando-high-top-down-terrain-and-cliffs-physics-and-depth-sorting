/**
 * Expande template + âncora → instância congelada do sítio.
 */
import { CASA_SITE, raioDoPropSite } from "./catalogo.js";
import { montarLabirintoCemiterio } from "./cemiterio.js";
import { hash3 } from "./hash.js";

function tintCasa(seed) {
  const paleta = ["#c4a574", "#b8956a", "#a8a29e", "#9ca3af", "#d6b88a", "#a18072"];
  return paleta[seed % paleta.length];
}

/**
 * @param {object} template
 * @param {number} ax
 * @param {number} ay
 * @param {number} ancoraX local da área
 * @param {number} ancoraY local da área
 * @param {string} siteId
 * @param {{ x:number, y:number }} origemMundo canto NW da área em coords mundiais
 */
export function expandirTemplate(template, ax, ay, ancoraX, ancoraY, siteId, origemMundo) {
  const ox = origemMundo.x;
  const oy = origemMundo.y;
  const edificios = [];
  let slot = 0;
  for (const b of template.edificios ?? []) {
    const cols = b.cols ?? CASA_SITE.cols;
    const rows = b.rows ?? CASA_SITE.rows;
    const seed = hash3(ax, ay, slot + 17);
    const lx = ancoraX + b.dx + cols * 0.5;
    const ly = ancoraY + b.dy + rows * 0.5;
    edificios.push(
      Object.freeze({
        id: `${siteId}-casa-${slot}`,
        slot,
        modelo: b.modelo,
        x: ox + lx,
        y: oy + ly,
        lx,
        ly,
        cols,
        rows,
        tint: tintCasa(seed),
        r: Math.max(cols, rows) * 0.42,
      })
    );
    slot += 1;
  }

  let propSpecs = [...(template.props ?? [])];
  let navegacao = null;
  if (template.labirintoLapides) {
    const maze = montarLabirintoCemiterio({
      ax,
      ay,
      siteId,
      mazeDx: template.labirintoDx ?? 1,
      mazeDy: template.labirintoDy ?? 6,
      cellCols: template.labirintoCols ?? 13,
      cellRows: template.labirintoRows ?? 9,
      cellPitch: template.labirintoPasso ?? 2,
    });
    propSpecs = [...propSpecs, ...maze.props];
    navegacao = Object.freeze({
      bounds: Object.freeze({
        x0: ox + ancoraX + maze.navegacao.bounds.x0,
        y0: oy + ancoraY + maze.navegacao.bounds.y0,
        x1: ox + ancoraX + maze.navegacao.bounds.x1,
        y1: oy + ancoraY + maze.navegacao.bounds.y1,
      }),
      entrada: Object.freeze({
        x: ox + ancoraX + maze.navegacao.entrada.x,
        y: oy + ancoraY + maze.navegacao.entrada.y,
      }),
      solucao: Object.freeze(
        maze.navegacao.solucao.map((p) =>
          Object.freeze({ x: ox + ancoraX + p.x, y: oy + ancoraY + p.y })
        )
      ),
    });
  }

  const props = propSpecs.map((p, i) =>
    Object.freeze({
      id: `${siteId}-prop-${i}`,
      propId: p.propId,
      x: ox + ancoraX + p.dx,
      y: oy + ancoraY + p.dy,
      r: raioDoPropSite(p.propId),
      kind: p.kind || null,
    })
  );

  const mapX =
    edificios.length > 0
      ? edificios.reduce((s, h) => s + h.x, 0) / edificios.length
      : ox + ancoraX + template.largura * 0.5;
  const mapY =
    edificios.length > 0
      ? edificios.reduce((s, h) => s + h.y, 0) / edificios.length
      : oy + ancoraY + template.altura * 0.5;

  return Object.freeze({
    id: siteId,
    ax,
    ay,
    tipo: template.tipo,
    templateId: template.id,
    ancoraX,
    ancoraY,
    largura: template.largura,
    altura: template.altura,
    limpaVeg: template.limpaVeg ?? 1,
    mapX,
    mapY,
    x0: ox + ancoraX,
    y0: oy + ancoraY,
    x1: ox + ancoraX + template.largura,
    y1: oy + ancoraY + template.altura,
    edificios: Object.freeze(edificios),
    props: Object.freeze(props),
    navegacao,
  });
}
