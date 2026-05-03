// pm2 ecosystem for taars on EC2
// Usage:
//   pm2 start ecosystem.config.cjs
//   pm2 save && pm2 startup
//   pm2 logs <name> | pm2 restart <name>

const path = require('path');
const repoRoot = __dirname;

module.exports = {
  apps: [
    {
      name: 'taars-server',
      cwd: repoRoot,
      script: 'pnpm',
      args: '--filter @taars/server start',
      interpreter: 'none',
      env: { NODE_ENV: 'production', PORT: '8080' },
      max_memory_restart: '1G',
      out_file: '/var/log/taars/server.out.log',
      error_file: '/var/log/taars/server.err.log',
      time: true,
    },
    {
      name: 'taars-discord',
      cwd: repoRoot,
      script: 'pnpm',
      args: '--filter @taars/discord-bot start',
      interpreter: 'none',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '512M',
      out_file: '/var/log/taars/discord.out.log',
      error_file: '/var/log/taars/discord.err.log',
      time: true,
    },
    // OpenVoice runs on the dev machine (Tailscale 100.82.90.55:5005).
    // EC2 nginx proxies voice.taars.crevn.xyz -> that host. See deploy/nginx/taars.conf.
  ],
};
