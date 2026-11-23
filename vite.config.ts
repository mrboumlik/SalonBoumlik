import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {transform as lightningTransform} from 'lightningcss';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {defineConfig, type Plugin} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));

function stripAtSupportsColorMix(input: string): string {
  let out = '';
  let i = 0;
  const marker = '@supports (color:color-mix(';
  while (i < input.length) {
    const idx = input.indexOf(marker, i);
    if (idx === -1) {
      out += input.slice(i);
      break;
    }
    out += input.slice(i, idx);
    const braceStart = input.indexOf('{', idx);
    if (braceStart === -1) {
      out += input.slice(idx);
      break;
    }
    let depth = 0;
    let j = braceStart;
    while (j < input.length) {
      if (input[j] === '{') depth++;
      else if (input[j] === '}') {
        depth--;
        if (depth === 0) {
          j++;
          break;
        }
      }
      j++;
    }
    i = j;
  }
  return out;
}

function unwrapAtLayers(input: string): string {
  const cleaned = input.replace(/@layer\s+[a-zA-Z0-9_,\s-]+;/g, '');
  let out = '';
  let i = 0;
  while (i < cleaned.length) {
    const idx = cleaned.indexOf('@layer ', i);
    if (idx === -1) {
      out += cleaned.slice(i);
      break;
    }
    out += cleaned.slice(i, idx);
    const braceStart = cleaned.indexOf('{', idx);
    if (braceStart === -1) {
      out += cleaned.slice(idx);
      break;
    }
    let depth = 0;
    let j = braceStart;
    while (j < cleaned.length) {
      if (cleaned[j] === '{') depth++;
      else if (cleaned[j] === '}') {
        depth--;
        if (depth === 0) {
          out += cleaned.slice(braceStart + 1, j);
          j++;
          break;
        }
      }
      j++;
    }
    i = j;
  }
  return out;
}

function downlevelLegacyCss(rawCss: string, filename: string, minify: boolean): string {
  let css = stripAtSupportsColorMix(rawCss);
  css = unwrapAtLayers(css);
  // Make space-*/divide-* utilities work on Chrome < 88 without :where()
  css = css.replace(/:where\((\.(?:space|divide)-[xy]-[^)]+>:not\(:last-child\))\)/g, '$1');

  const result = lightningTransform({
    filename,
    code: Buffer.from(css, 'utf8'),
    minify,
    targets: {
      chrome: 79 << 16,
      safari: 13 << 16,
      firefox: 78 << 16,
    },
  });
  return Buffer.from(result.code).toString('utf8');
}

function legacyCssCompatibilityPlugin(): Plugin {
  return {
    name: 'salon-boumlik-legacy-css-compat',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'asset' && fileName.endsWith('.css')) {
          const sourceText =
            typeof chunk.source === 'string'
              ? chunk.source
              : Buffer.from(chunk.source).toString('utf8');
          chunk.source = downlevelLegacyCss(sourceText, fileName, true);
        }
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      legacyCssCompatibilityPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'icon.svg',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
          'sw-push.js',
        ],
        manifest: {
          id: '/',
          name: 'Salon Boumlik — Taroudant',
          short_name: 'Boumlik',
          description:
            'Salon Boumlik - Réservation en ligne, suivi de ticket en temps réel et programme de fidélité à Taroudant.',
          theme_color: '#08090C',
          background_color: '#08090C',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          importScripts: ['/sw-push.js'],
          cleanupOutdatedCaches: true,
          skipWaiting: true,
          clientsClaim: true,
          maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'google-fonts-stylesheets',
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-webfonts',
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
              },
            },
            {
              urlPattern: /\.(?:png|jpg|jpeg|svg|webp)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'images-cache',
                expiration: {
                  maxEntries: 60,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
        },
      }),
    ],
    build: {
      target: ['es2020', 'chrome79', 'safari14', 'firefox78'],
      cssTarget: ['chrome79', 'safari13', 'firefox78'],
    },
    resolve: {
      alias: {
        '@': ROOT_DIR,
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
