import { spawn, spawnSync } from "node:child_process";
import { createReadStream, existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEPLOY_HOST = process.env.DEPLOY_HOST || "root@191.101.78.194";
const APP_DIR = process.env.DEPLOY_APP_DIR || "/var/www/pokemon-wild-cry-3d";
const SSH_RETRIES = Number(process.env.DEPLOY_SSH_RETRIES || 15);
const SSH_CONNECT_TIMEOUT = Number(process.env.DEPLOY_SSH_CONNECT_TIMEOUT || 25);
const PUSH_RETRIES = Number(process.env.DEPLOY_PUSH_RETRIES || 8);

const args = new Set(process.argv.slice(2));
function npmFlag(name) {
  const key = `npm_config_${name.replace(/-/g, "_")}`;
  const v = process.env[key];
  return v === "true" || v === "1" || v === "";
}

if (args.has("--help") || args.has("-h") || npmFlag("help")) {
  console.log(`Uso:
  npm run deploy
  npm run deploy --allow-dirty
  npm run deploy --direct

  (sem flags)     exige working tree limpa, git push, depois install no VPS
  --skip-push     não faz git push (usa o que já está no origin)
  --allow-dirty   permite working tree suja
  --direct        envia arquivos via SSH pipe (sem GitHub)
  --branch=NOME   branch remota/git (default: branch atual)

Env:
  DEPLOY_HOST                default root@191.101.78.194
  DEPLOY_APP_DIR             default /var/www/pokemon-wild-cry-3d
  DEPLOY_SSH_RETRIES         default 15
  DEPLOY_SSH_CONNECT_TIMEOUT default 25
  DEPLOY_PUSH_RETRIES        default 8
`);
  process.exit(0);
}

const skipPush = args.has("--skip-push") || npmFlag("skip_push") || npmFlag("skip-push");
const allowDirty = args.has("--allow-dirty") || npmFlag("allow_dirty") || npmFlag("allow-dirty");
const direct = args.has("--direct") || npmFlag("direct");
const branchArg = process.argv.find((a) => a.startsWith("--branch="));
const branchOverride =
  (branchArg ? branchArg.slice("--branch=".length) : null) ||
  process.env.npm_config_branch ||
  null;

function run(cmd, cmdArgs, opts = {}) {
  const result = spawnSync(cmd, cmdArgs, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: opts.stdio ?? ["ignore", "pipe", "pipe"],
    shell: false,
    env: process.env,
  });
  return {
    status: result.status ?? 1,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
    error: result.error,
  };
}

function git(cmdArgs) {
  return run("git", cmdArgs);
}

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function sleepSync(ms) {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch {
    spawnSync(process.execPath, ["-e", `Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,${ms})`], {
      stdio: "ignore",
    });
  }
}

function currentBranch() {
  if (branchOverride) return branchOverride;
  const r = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  if (r.status !== 0) fail(r.stderr || "não consegui ler a branch atual");
  return r.stdout;
}

function assertCleanOrAllowed() {
  if (direct) return;
  const r = git(["status", "--porcelain"]);
  if (r.status !== 0) fail(r.stderr || "git status falhou");
  if (!r.stdout) return;

  const lines = r.stdout.split(/\r?\n/).filter(Boolean);
  const onlyMeta = lines.every((line) => {
    const path = line.replace(/^[MARCUD?! ]{1,2}\s+/, "").replace(/^.* -> /, "");
    return path === ".gitignore" || path.startsWith("docs/") || path === "README.md";
  });

  console.warn("WARN: working tree suja:");
  console.warn(r.stdout);
  if (onlyMeta && !allowDirty) {
    console.warn("WARN: só meta local (.gitignore/docs/README) — seguindo (VPS usa origin)");
    return;
  }
  if (!allowDirty) {
    fail("faça commit, ou use: npm run deploy --allow-dirty  |  npm run deploy --direct");
  }
  console.warn("WARN: seguindo com --allow-dirty (o VPS vai para origin/<branch>)");
}

function pushBranch(branch) {
  let lastDetail = "";
  for (let attempt = 1; attempt <= PUSH_RETRIES; attempt++) {
    console.log(`==> git push origin ${branch} (tentativa ${attempt}/${PUSH_RETRIES})`);
    const r = spawnSync("git", ["push", "-u", "origin", `HEAD:${branch}`], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: "inherit",
      shell: false,
    });
    if ((r.status ?? 1) === 0) return;
    lastDetail = r.error?.message || `exit ${r.status}`;
    console.warn(`WARN: git push falhou (${lastDetail})`);
    if (attempt < PUSH_RETRIES) {
      const waitMs = Math.min(30_000, 2_000 * attempt);
      console.log(`==> aguardando ${Math.round(waitMs / 1000)}s...`);
      sleepSync(waitMs);
    }
  }
  fail(
    `git push esgotou ${PUSH_RETRIES} tentativas (GitHub inacessível?).\n` +
      `    Tente de novo mais tarde, VPN, ou: npm run deploy --direct`,
  );
}

function sshArgs(extra = []) {
  return [
    "-o",
    "BatchMode=yes",
    "-o",
    `ConnectTimeout=${SSH_CONNECT_TIMEOUT}`,
    "-o",
    "ServerAliveInterval=5",
    "-o",
    "ServerAliveCountMax=3",
    "-o",
    "StrictHostKeyChecking=accept-new",
    ...extra,
    DEPLOY_HOST,
  ];
}

function sshOnce(remoteCommand) {
  return run("ssh", [...sshArgs(), remoteCommand], { stdio: ["ignore", "inherit", "inherit"] });
}

function sshWithRetries(remoteCommand) {
  let last = null;
  for (let attempt = 1; attempt <= SSH_RETRIES; attempt++) {
    console.log(`==> SSH tentativa ${attempt}/${SSH_RETRIES} → ${DEPLOY_HOST}`);
    last = sshOnce(remoteCommand);
    if (last.status === 0) return last;

    const detail = last.error?.message || `exit ${last.status}`;
    console.warn(`WARN: SSH falhou (${detail})`);
    if (attempt < SSH_RETRIES) {
      const waitMs = Math.min(30_000, 2_000 * attempt);
      console.log(`==> aguardando ${Math.round(waitMs / 1000)}s e tentando de novo...`);
      sleepSync(waitMs);
    }
  }
  fail(
    `SSH esgotou ${SSH_RETRIES} tentativas para ${DEPLOY_HOST}.\n` +
      `    O painel pode mostrar o VPS ativo, mas a porta 22 está inacessível da sua rede agora.`,
  );
}

function pipeArchiveViaSsh(archive, remoteArchive) {
  return new Promise((resolvePromise, reject) => {
    const remoteCmd = `cat > '${remoteArchive}'`;
    const child = spawn("ssh", [...sshArgs(), remoteCmd], {
      stdio: ["pipe", "inherit", "inherit"],
      shell: false,
    });
    const stream = createReadStream(archive);
    stream.on("error", reject);
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`ssh pipe exit ${code}`));
    });
    stream.pipe(child.stdin);
  });
}

async function syncDirectToVps() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const tmp = mkdtempSync(join(tmpdir(), "pwc3d-deploy-"));
  const archive = join(tmp, `pokemon-wild-cry-3d-${stamp}.tgz`);
  console.log("==> Empacotando (sem node_modules / .git / zips de modelo / treino)");

  const tarCreate = spawnSync(
    "tar",
    [
      "--force-local",
      "-czf",
      archive,
      "--exclude=node_modules",
      "--exclude=.git",
      "--exclude=.cursor",
      "--exclude=treino",
      "--exclude=assets/models/*.zip",
      "--exclude=assets/models/**/*.zip",
      "-C",
      ROOT,
      ".",
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  if ((tarCreate.status ?? 1) !== 0) {
    rmSync(tmp, { recursive: true, force: true });
    fail(tarCreate.stderr || "tar create falhou (precisa do tar do Windows/Git)");
  }
  if (!existsSync(archive)) {
    rmSync(tmp, { recursive: true, force: true });
    fail("arquivo .tgz não foi criado");
  }

  const mb = (statSync(archive).size / (1024 * 1024)).toFixed(1);
  console.log(`==> Arquivo: ${mb} MB (envio via SSH pipe)`);

  const remoteArchive = `/tmp/pokemon-wild-cry-3d-deploy-${stamp}.tgz`;
  let uploaded = false;
  for (let attempt = 1; attempt <= SSH_RETRIES; attempt++) {
    console.log(`==> pipe tentativa ${attempt}/${SSH_RETRIES} → ${DEPLOY_HOST}:${remoteArchive}`);
    try {
      await pipeArchiveViaSsh(archive, remoteArchive);
      uploaded = true;
      break;
    } catch (err) {
      console.warn(`WARN: pipe falhou (${err?.message || err})`);
      if (attempt < SSH_RETRIES) sleepSync(Math.min(30_000, 2_000 * attempt));
    }
  }
  rmSync(tmp, { recursive: true, force: true });
  if (!uploaded) fail("envio via SSH pipe esgotou as tentativas");

  const remoteCmd = [
    `mkdir -p '${APP_DIR}'`,
    `tar -xzf '${remoteArchive}' -C '${APP_DIR}'`,
    `rm -f '${remoteArchive}'`,
    `chmod +x '${APP_DIR}/deploy/install.sh'`,
    `SKIP_GIT=1 bash '${APP_DIR}/deploy/install.sh'`,
  ].join(" && ");
  sshWithRetries(remoteCmd);
}

async function main() {
  const branch = currentBranch();
  console.log(`==> Deploy Pokémon Wild Cry 3D`);
  console.log(`    mode:   ${direct ? "direct (SSH pipe)" : "git push + install"}`);
  console.log(`    branch: ${branch}`);
  console.log(`    host:   ${DEPLOY_HOST}`);
  console.log(`    app:    ${APP_DIR}`);

  if (!existsSync(join(ROOT, "deploy", "install.sh"))) {
    fail("falta deploy/install.sh neste projeto");
  }
  if (!existsSync(join(ROOT, "servidor.mjs"))) {
    fail("falta servidor.mjs");
  }

  assertCleanOrAllowed();

  if (direct) {
    await syncDirectToVps();
  } else {
    if (!skipPush) {
      pushBranch(branch);
    } else {
      console.log("==> pulando git push (--skip-push)");
    }
    const remote = `bash ${APP_DIR}/deploy/install.sh ${branch}`;
    // Primeira vez: clone se a pasta ainda não existe.
    const bootstrap = [
      `if [ ! -d '${APP_DIR}/.git' ] && [ ! -f '${APP_DIR}/deploy/install.sh' ]; then`,
      `  git clone --branch '${branch}' https://github.com/huras/demistificando-high-top-down-terrain-and-cliffs-physics-and-depth-sorting.git '${APP_DIR}';`,
      `fi`,
      `bash '${APP_DIR}/deploy/install.sh' '${branch}'`,
    ].join(" ");
    sshWithRetries(bootstrap);
  }

  console.log("==> Deploy ok");
  console.log("    https://pokemon-wild-cry-3d.hurast.com");
}

main().catch((err) => {
  fail(err?.stack || String(err));
});
