module.exports = {
  apps: [{
    name: 'slack-claude-bridge',
    script: 'index.js',
    cwd: '/Users/tpc/.claude/slack-bridge/server',
    exec_mode: 'fork',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '200M',
    env: {
      NODE_ENV: 'production'
    },
    error_file: '/Users/tpc/.claude/slack-bridge/server/logs/error.log',
    out_file: '/Users/tpc/.claude/slack-bridge/server/logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
