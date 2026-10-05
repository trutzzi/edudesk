// The two processes pm2 keeps running on the server. Paths go through the `current` link, so a
// reload after a deploy starts the new release. APP_DIR is set by remote-deploy.sh.
const appDir = process.env.APP_DIR ?? '/var/www/edudesk';

module.exports = {
  apps: [
    {
      name: 'edudesk-api',
      cwd: `${appDir}/current/backend`,
      // Settings, PORT included, come from .env (a link to shared/backend.env)
      script: 'dist/index.js',
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'edudesk-web',
      cwd: `${appDir}/current/web`,
      script: 'server.js',
      // Only the reverse proxy talks to it
      env: { NODE_ENV: 'production', PORT: 3000, HOSTNAME: '127.0.0.1' },
    },
  ],
};
