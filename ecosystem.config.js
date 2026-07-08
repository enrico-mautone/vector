module.exports = {
  apps: [
    {
      name: 'vector',
      script: 'src/server.js',
      cwd: __dirname,
      env: {
        PORT: 8420,
      },
    },
  ],
};
