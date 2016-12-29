var config = {
  ui: "tape",
  tunnel: {
    type: 'localtunnel',
    https: true
  },

  // to speed up tests
  capabilities: {
    'record-video': false,
    'video-upload-on-pass': false,
    'record-screenshots': false
  },

  browsers: [
    {
      name: "chrome",
      version: "latest"
    }
  ],
  server: "tsc --watch",
};

module.exports = config;
