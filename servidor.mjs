import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extrairCatalogo } from "./js/pokemon/extrairCatalogo.mjs";
import { garantirAtlasPmd, interpretarPedidoAtlas } from "./js/pokemon/assarAtlas.mjs";

const raiz = path.dirname(fileURLToPath(import.meta.url));
const raizRef = path.resolve(raiz, "..", "Pokemon AI");
const cacheAtlas = path.join(raiz, ".cache", "pmd-atlas", "v9");
const porta = 4177;

const tipos = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".obj": "text/plain; charset=utf-8",
  ".glb": "model/gltf-binary",
  ".mtl": "text/plain; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
};

const EXT_REF = new Set([".png", ".json", ".webp", ".mp3", ".ogg", ".wav"]);

function caminhoNaRaiz(base, rel) {
  if (!rel || rel.includes("\0")) return null;
  const cheio = path.resolve(base, rel);
  const relativo = path.relative(base, cheio);
  if (relativo.startsWith("..") || path.isAbsolute(relativo)) return null;
  return cheio;
}

function caminhoRef(pathname) {
  let rel = decodeURIComponent(pathname).replace(/^\/ref\/?/, "");
  if (!rel || rel.includes("..")) return null;
  const cheio = caminhoNaRaiz(raizRef, rel);
  if (!cheio) return null;
  const ext = path.extname(cheio).toLowerCase();
  if (!EXT_REF.has(ext)) return null;
  return cheio;
}

function caminhoSeguro(pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === "/") rel = "index.html";
  else rel = rel.replace(/^\/+/, "");
  if (!rel || rel.includes("..")) return null;
  const cheio = path.normalize(path.join(raiz, rel));
  const base = raiz.endsWith(path.sep) ? raiz : raiz + path.sep;
  if (cheio !== raiz && !cheio.startsWith(base)) return null;
  return cheio;
}

const servidor = http.createServer((req, res) => {
  const url = new URL(req.url || "/", "http://localhost");

  if (url.pathname === "/favicon.ico") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/biomas") {
    const pedacos = [];
    let total = 0;
    req.on("data", (parte) => {
      total += parte.length;
      if (total > 1_000_000) {
        res.writeHead(413);
        res.end();
        req.destroy();
        return;
      }
      pedacos.push(parte);
    });
    req.on("end", () => {
      try {
        const texto = Buffer.concat(pedacos).toString("utf8");
        const obj = JSON.parse(texto);
        if (!obj || !Array.isArray(obj.biomas) || !obj.biomas.length) {
          throw new Error("arquivo sem biomas");
        }
        for (let i = 0; i < obj.biomas.length; i++) {
          const b = obj.biomas[i];
          if (!b.id || !Array.isArray(b.nos)) throw new Error("bioma incompleto");
          const temSaida = b.nos.some((n) => n.tipo === "saida");
          if (!temSaida) throw new Error(`${b.nome || b.id} sem nó de saída`);
        }
        const dest = path.join(raiz, "biomas", "mundo.json");
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, JSON.stringify(obj, null, 2));
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end('{"ok":true}');
      } catch (erro) {
        res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: false, erro: String(erro.message || erro) }));
      }
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/detalhe") {
    const pedacos = [];
    let total = 0;
    req.on("data", (parte) => {
      total += parte.length;
      if (total > 2_000_000) {
        res.writeHead(413);
        res.end();
        req.destroy();
        return;
      }
      pedacos.push(parte);
    });
    req.on("end", () => {
      try {
        const obj = JSON.parse(Buffer.concat(pedacos).toString("utf8"));
        if (!obj || typeof obj !== "object" || !obj.grama || !obj.arvore || !obj.mar) {
          throw new Error("detalhe sem portas");
        }
        const dest = path.join(raiz, "biomas", "detalhe.json");
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, JSON.stringify(obj, null, 2));
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end('{"ok":true}');
      } catch (erro) {
        res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: false, erro: String(erro.message || erro) }));
      }
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/luzes") {
    const pedacos = [];
    let total = 0;
    req.on("data", (parte) => {
      total += parte.length;
      if (total > 1_000_000) {
        res.writeHead(413);
        res.end();
        req.destroy();
        return;
      }
      pedacos.push(parte);
    });
    req.on("end", () => {
      try {
        const obj = JSON.parse(Buffer.concat(pedacos).toString("utf8"));
        validarCatalogoLuzes(obj);
        const dest = path.join(raiz, "assets", "luzes", "catalogo.json");
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, JSON.stringify(obj, null, 2));
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end('{"ok":true}');
      } catch (erro) {
        res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: false, erro: String(erro.message || erro) }));
      }
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/pivos") {
    const pedacos = [];
    let total = 0;
    req.on("data", (parte) => {
      total += parte.length;
      if (total > 200_000) {
        res.writeHead(413);
        res.end();
        req.destroy();
        return;
      }
      pedacos.push(parte);
    });
    req.on("end", () => {
      try {
        const obj = JSON.parse(Buffer.concat(pedacos).toString("utf8"));
        validarPivos(obj);
        const dest = path.join(raiz, "assets", "pokemon", "pivos.json");
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, JSON.stringify(obj, null, 2));
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end('{"ok":true}');
      } catch (erro) {
        res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: false, erro: String(erro.message || erro) }));
      }
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/partes") {
    const pedacos = [];
    let total = 0;
    req.on("data", (parte) => {
      total += parte.length;
      if (total > 2_000_000) {
        res.writeHead(413);
        res.end();
        req.destroy();
        return;
      }
      pedacos.push(parte);
    });
    req.on("end", () => {
      try {
        const obj = JSON.parse(Buffer.concat(pedacos).toString("utf8"));
        validarPartes(obj);
        const dest = path.join(raiz, "assets", "models", "partes.json");
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, JSON.stringify(obj, null, 2));
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end('{"ok":true}');
      } catch (erro) {
        res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: false, erro: String(erro.message || erro) }));
      }
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/colisores") {
    const pedacos = [];
    let total = 0;
    req.on("data", (parte) => {
      total += parte.length;
      if (total > 200_000) {
        res.writeHead(413);
        res.end();
        req.destroy();
        return;
      }
      pedacos.push(parte);
    });
    req.on("end", () => {
      try {
        const obj = JSON.parse(Buffer.concat(pedacos).toString("utf8"));
        validarColisores(obj);
        const dest = path.join(raiz, "assets", "models", "colisores.json");
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, JSON.stringify(obj, null, 2));
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end('{"ok":true}');
      } catch (erro) {
        res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: false, erro: String(erro.message || erro) }));
      }
    });
    return;
  }

  if (
    (req.method === "GET" || req.method === "HEAD") &&
    url.pathname === "/ref/catalogo.json"
  ) {
    extrairCatalogo(raizRef)
      .then((cat) => {
        const corpo = JSON.stringify(cat);
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        });
        res.end(req.method === "HEAD" ? undefined : corpo);
      })
      .catch((erro) => {
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: false, erro: String(erro?.message || erro) }));
      });
    return;
  }

  const pedidoAtlas = interpretarPedidoAtlas(url.pathname);
  if (pedidoAtlas && (req.method === "GET" || req.method === "HEAD")) {
    garantirAtlasPmd(raizRef, cacheAtlas, pedidoAtlas.id)
      .then((pasta) => enviarArquivo(req, res, path.join(pasta, pedidoAtlas.arquivo)))
      .catch((erro) => {
        console.error("atlas pmd", pedidoAtlas.id, erro?.message || erro);
        res.writeHead(404);
        res.end("nao encontrado");
      });
    return;
  }

  if (
    (req.method === "GET" || req.method === "HEAD") &&
    url.pathname.startsWith("/ref/")
  ) {
    const arquivoRef = caminhoRef(url.pathname);
    if (!arquivoRef) {
      res.writeHead(403);
      res.end();
      return;
    }
    enviarArquivo(req, res, arquivoRef);
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405);
    res.end();
    return;
  }

  const arquivo = caminhoSeguro(url.pathname);
  if (!arquivo) {
    res.writeHead(403);
    res.end();
    return;
  }
  enviarArquivo(req, res, arquivo);
});

function validarCatalogoLuzes(obj) {
  if (!obj || typeof obj.modelos !== "object" || Array.isArray(obj.modelos)) {
    throw new Error("arquivo sem modelos");
  }
  const ids = Object.keys(obj.modelos);
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (!/^[a-zA-Z0-9_-]{1,48}$/.test(id)) throw new Error(`modelo inválido: ${id}`);
    const item = obj.modelos[id];
    if (!item || !Array.isArray(item.pontos) || item.pontos.length > 12) {
      throw new Error(`${id} sem pontos`);
    }
    for (let p = 0; p < item.pontos.length; p++) {
      const ponto = item.pontos[p];
      for (const chave of ["x", "y", "z", "raio", "intensidade"]) {
        const n = Number(ponto?.[chave]);
        if (!Number.isFinite(n)) throw new Error(`${id} ponto ${p} sem ${chave}`);
        ponto[chave] = n;
      }
      if (typeof ponto.cor !== "string" || !/^#[0-9a-fA-F]{6}$/.test(ponto.cor)) {
        throw new Error(`${id} ponto ${p} sem cor`);
      }
      if (ponto.raio < 0.2 || ponto.raio > 16) throw new Error(`${id} raio fora`);
      if (ponto.intensidade < 0 || ponto.intensidade > 4) throw new Error(`${id} intensidade fora`);
    }
  }
}

function validarPartes(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    throw new Error("arquivo sem partes");
  }
  const ids = Object.keys(obj);
  if (ids.length > 200) throw new Error("muitos modelos");
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (!/^[a-z0-9.'-]{1,80}$/i.test(id)) throw new Error(`modelo inválido: ${id}`);
    const item = obj[id];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`${id} sem partes`);
    }
    const limpo = {};
    const vistos = { porta: new Set(), janela: new Set() };
    for (const papel of ["porta", "janela"]) {
      const lista = item[papel] || [];
      if (!Array.isArray(lista) || lista.length > 400) throw new Error(`${id} ${papel}`);
      const saida = [];
      for (let k = 0; k < lista.length; k++) {
        const n = lista[k];
        if (!Number.isInteger(n) || n < 0 || n > 200_000) throw new Error(`${id} face`);
        if (vistos.porta.has(n) || vistos.janela.has(n)) continue;
        vistos[papel].add(n);
        saida.push(n);
      }
      if (saida.length) limpo[papel] = saida;
    }
    if (!limpo.porta && !limpo.janela) delete obj[id];
    else obj[id] = limpo;
  }
}

function caixaLimpa(caixa, id, nome) {
  if (!caixa || typeof caixa !== "object" || Array.isArray(caixa)) {
    throw new Error(`${id} ${nome}`);
  }
  const saida = {};
  for (const chave of ["x", "y", "lx", "ly"]) {
    const n = Number(caixa[chave]);
    if (!Number.isFinite(n)) throw new Error(`${id} ${nome}`);
    saida[chave] = Math.round(n * 100) / 100;
  }
  if (saida.lx < 0.15 || saida.lx > 30 || saida.ly < 0.15 || saida.ly > 30) {
    throw new Error(`${id} ${nome} tamanho`);
  }
  if (Math.abs(saida.x) > 20 || Math.abs(saida.y) > 20) throw new Error(`${id} ${nome} offset`);
  return saida;
}

function validarColisores(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    throw new Error("arquivo sem colisores");
  }
  const ids = Object.keys(obj);
  if (ids.length > 80) throw new Error("muitos colisores");
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (!/^[a-z0-9.'-]{1,80}$/i.test(id)) throw new Error(`modelo inválido: ${id}`);
    const item = obj[id];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`${id} sem ajuste`);
    }
    const limpo = {};
    if (item.corpo != null) limpo.corpo = caixaLimpa(item.corpo, id, "corpo");
    if (Object.prototype.hasOwnProperty.call(item, "porta")) {
      limpo.porta = item.porta == null ? null : caixaLimpa(item.porta, id, "porta");
    }
    if (!limpo.corpo && !Object.prototype.hasOwnProperty.call(limpo, "porta")) {
      throw new Error(`${id} vazio`);
    }
    obj[id] = limpo;
  }
}

function validarPivos(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    throw new Error("arquivo sem pivôs");
  }
  const ids = Object.keys(obj);
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new Error(`espécie inválida: ${id}`);
    const item = obj[id];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`${id} sem ajuste`);
    }
    for (const chave of ["offsetY", "dx", "dy"]) {
      const n = Number(item[chave]);
      if (!Number.isFinite(n)) throw new Error(`${id} sem ${chave}`);
      item[chave] = n;
    }
    if (item.offsetY < -4 || item.offsetY > 4) throw new Error(`${id} altura fora`);
    if (Math.abs(item.dx) > 256 || Math.abs(item.dy) > 256) throw new Error(`${id} pivô fora`);
  }
}

function faixaBytes(range, total) {
  if (!range) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!m || total <= 0) return "invalida";
  let ini = m[1] ? Number(m[1]) : NaN;
  let fim = m[2] ? Number(m[2]) : total - 1;
  if (m[1] === "") {
    const n = Number(m[2]);
    if (!Number.isFinite(n) || n <= 0) return "invalida";
    ini = Math.max(0, total - n);
    fim = total - 1;
  }
  if (!Number.isFinite(ini) || !Number.isFinite(fim)) return "invalida";
  if (ini < 0 || ini >= total || fim < ini) return "invalida";
  return { ini, fim: Math.min(fim, total - 1) };
}

function enviarArquivo(req, res, arquivo) {
  fs.stat(arquivo, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404);
      res.end("nao encontrado");
      return;
    }
    const ext = path.extname(arquivo).toLowerCase();
    const tipo = tipos[ext] || "application/octet-stream";
    const total = st.size;
    const comum = {
      "Content-Type": tipo,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
    };
    const faixa = faixaBytes(req.headers.range, total);
    if (faixa === "invalida") {
      res.writeHead(416, { "Content-Range": `bytes */${total}` });
      res.end();
      return;
    }
    if (faixa) {
      res.writeHead(206, {
        ...comum,
        "Content-Length": faixa.fim - faixa.ini + 1,
        "Content-Range": `bytes ${faixa.ini}-${faixa.fim}/${total}`,
      });
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      fs.createReadStream(arquivo, { start: faixa.ini, end: faixa.fim }).pipe(res);
      return;
    }
    res.writeHead(200, { ...comum, "Content-Length": total });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    fs.createReadStream(arquivo).pipe(res);
  });
}

servidor.listen(porta, () => {
  console.log(`http://localhost:${porta}`);
});
