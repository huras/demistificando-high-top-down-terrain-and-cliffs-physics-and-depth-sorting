import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extrairCatalogo } from "./js/pokemon/extrairCatalogo.mjs";

const raiz = path.dirname(fileURLToPath(import.meta.url));
const raizRef = path.resolve(raiz, "..", "Pokemon AI");
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
  ".mtl": "text/plain; charset=utf-8",
};

const EXT_REF = new Set([".png", ".json", ".webp"]);

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

function enviarArquivo(req, res, arquivo) {
  fs.stat(arquivo, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404);
      res.end("nao encontrado");
      return;
    }
    const ext = path.extname(arquivo).toLowerCase();
    res.writeHead(200, {
      "Content-Type": tipos[ext] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
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
