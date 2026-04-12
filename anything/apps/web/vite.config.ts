import path from 'node:path';
import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';
import babel from 'vite-plugin-babel';
import tsconfigPaths from 'vite-tsconfig-paths';
import { addRenderIds } from './plugins/addRenderIds';
import { aliases } from './plugins/aliases';
import consoleToParent from './plugins/console-to-parent';
import { layoutWrapperPlugin } from './plugins/layouts';
import { loadFontsFromTailwindSource } from './plugins/loadFontsFromTailwindSource';
import { nextPublicProcessEnv } from './plugins/nextPublicProcessEnv';
import { restart } from './plugins/restart';
import { restartEnvFileChange } from './plugins/restartEnvFileChange';
import { vercelPreset } from '@vercel/react-router/vite';

export default defineConfig({
  envPrefix: 'NEXT_PUBLIC_',
  build: { target: 'esnext' },
  optimizeDeps: {
    include: ['fast-glob', 'lucide-react'],
    exclude: ['fsevents', 'lightningcss'],
  },
  logLevel: 'info',
  plugins: [
    nextPublicProcessEnv(),
    restartEnvFileChange(),
    babel({
      include: ['src/**/*.{js,jsx,ts,tsx}'],
      exclude: /node_modules/,
      babelConfig: { babelrc: false, configFile: false, plugins: ['styled-jsx/babel'] },
    }),
    restart({ restart: ['src/**/page.jsx','src/**/page.tsx','src/**/layout.jsx','src/**/layout.tsx','src/**/route.js','src/**/route.ts'] }),
    consoleToParent(),
    loadFontsFromTailwindSource(),
    addRenderIds(),
    reactRouter({ presets: [vercelPreset()] }),
    tsconfigPaths(),
    aliases(),
    layoutWrapperPlugin(),
  ],
  resolve: {
    alias: {
      lodash: 'lodash-es',
      'npm:stripe': 'stripe',
      stripe: path.resolve(__dirname, './src/__create/stripe'),
      '@auth/create/react': '@hono/auth-js/react',
      '@auth/create': path.resolve(__dirname, './src/__create/@auth/create'),
      '@': path.resolve(__dirname, 'src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  clearScreen: false,
  server: { allowedHosts: true, host: '0.0.0.0', port: 4000, hmr: { overlay: false } },
});
