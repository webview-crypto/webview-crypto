#!/usr/bin/env node
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const entryPoint = join(root, 'src', 'WebViewWorker.ts');
const bundlePath = join(root, 'src', 'webViewWorkerDist.js');
const stringPath = join(root, 'src', 'webViewWorkerString.ts');

const writeWorkerString = () => {
  const bundle = readFileSync(bundlePath, 'utf8');
  const escaped = bundle
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\\${');
  const content = `export default \`${escaped}\`\n`;
  writeFileSync(stringPath, content);
};

const buildOptions = {
  entryPoints: [entryPoint],
  bundle: true,
  outfile: bundlePath,
  format: 'iife',
  globalName: 'WebViewWorker',
  target: ['es2017'],
  platform: 'browser',
  minify: true,
  sourcemap: false
};

const args = process.argv.slice(2);
const watch = args.includes('--watch');

if (watch) {
  buildOptions.watch = {
    onRebuild(error) {
      if (error) {
        console.error('[webview-crypto] worker rebuild failed', error);
        return;
      }
      writeWorkerString();
      console.log('[webview-crypto] worker rebuilt');
    }
  };
}

build(buildOptions)
  .then(() => {
    writeWorkerString();
    if (watch) {
      console.log('[webview-crypto] watching WebView worker bundle...');
    }
  })
  .catch((error) => {
    console.error('[webview-crypto] worker build failed', error);
    process.exit(1);
  });
