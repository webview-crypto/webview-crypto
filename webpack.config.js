var failPlugin = require('webpack-fail-plugin');
var webpack = require('webpack');
var WebpackShellPlugin = require('webpack-shell-plugin');

module.exports = {
  entry: ['./src/WebViewWorker'],
  output: {
    filename: "src/webViewWorkerDist.js",

    libraryTarget: "var",
    library: "WebViewWorker"
  },

  resolve: {
    // Add '.ts' and '.tsx' as resolvable extensions.
    extensions: ["", ".webpack.js", ".web.js", ".ts", ".tsx", ".js"]
  },

  module: {
    loaders: [
      // All files with a '.ts' or '.tsx' extension will be handled by 'ts-loader'.
      { test: /\.tsx?$/, loader: "ts-loader" }
    ]
  },
  ts: {
    configFile: "tsconfig.webViewWorker.json"
  },
  plugins: [
    failPlugin,
    new webpack.optimize.UglifyJsPlugin({
      compress: true,
      mangle: true,
      comments: false,
      sourceMap: false
    }),
    new WebpackShellPlugin({
      onBuildEnd:['./build-webViewWorkerString.bash'],
      dev: false
    })
	]
};
