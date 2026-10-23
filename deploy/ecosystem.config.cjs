module.exports = {
  apps: [
    {
      name: "pokemon-wild-cry-3d",
      script: "servidor.mjs",
      cwd: "/var/www/pokemon-wild-cry-3d",
      env: {
        PORT: 8790,
        NODE_ENV: "production",
        MODO_PRODUCAO: "1",
        // Lê assets do Pokemon AI já instalado — somente leitura via servidor.
        RAIZ_REF: "/var/www/pokemon-ai",
      },
      autorestart: true,
      max_memory_restart: "512M",
    },
  ],
};
