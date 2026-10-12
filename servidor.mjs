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
