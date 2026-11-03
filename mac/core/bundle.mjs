// Bundles entry.js + the server modules into one plain script for JavaScriptCore:
//   node mac/core/bundle.mjs <out.js>
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const shims = { 'node:events': 'events', 'node:path': 'path', 'node:fs': 'fs', 'node:os': 'os' };

await build({
  entryPoints: [path.join(here, 'entry.js')],
  inject: [path.join(here, 'shims', 'timers.js')],
  outfile: process.argv[2] || path.join(here, '..', 'build', 'core.js'),
  bundle: true,
  format: 'iife',
  platform: 'neutral',
  target: 'safari16',
  logLevel: 'warning',
  plugins: [{
    name: 'node-shims',
    setup(b) {
      b.onResolve({ filter: /^node:/ }, (args) => {
        const name = shims[args.path];
        if (!name) throw new Error(`no shim for ${args.path}`);
        return { path: path.join(here, 'shims', `${name}.js`) };
      });
    },
  }],
});
