/**
 * Bundles the dashboard bridge into a single self-contained CJS file.
 * All fastify dependencies are inlined — no extra npm install needed by the user.
 * Output: dashboard/bridge/dist/bundle.cjs
 */
import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

await build({
  entryPoints: [path.join(root, 'dashboard/bridge/src/index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node22',
  // CJS so Fastify's internal require() calls work correctly
  format: 'cjs',
  outfile: path.join(root, 'dashboard/bridge/dist/bundle.cjs'),
  // Externalise all node built-ins
  external: ['node:*'],
  sourcemap: false,
  minify: false,
  // Inject __filename / __dirname and shim import.meta.url for the CJS bundle
  banner: {
    js: [
      '#!/usr/bin/env node',
      'const __importMetaUrl = require("url").pathToFileURL(__filename).href;',
    ].join('\n'),
  },
  // Replace import.meta.url with our CJS-safe shim
  define: {
    'import.meta.url': '__importMetaUrl',
  },
  logLevel: 'info',
});

console.log('[bundle-bridge] Done → dashboard/bridge/dist/bundle.cjs');
