import { build } from 'esbuild';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiDir = join(__dirname, 'src/app/api');
const outDir = join(__dirname, 'build/api');

function findRouteFiles(dir) {
  const files = readdirSync(dir);
  let routes = [];
  for (const file of files) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    if (stat.isDirectory()) {
      routes = routes.concat(findRouteFiles(filePath));
    } else if (file === 'route.js') {
      routes.push(filePath);
    }
  }
  return routes;
}

const routeFiles = findRouteFiles(apiDir);
console.log(`Building ${routeFiles.length} API routes...`);

await build({
  entryPoints: routeFiles,
  bundle: true,
  platform: 'node',
  format: 'esm',
  outdir: outDir,
  outbase: apiDir,
  packages: 'external',
  alias: {
    '@/app': join(__dirname, 'src/app'),
    '@/utils': join(__dirname, 'src/utils'),
    '@/components': join(__dirname, 'src/components'),
    '@/hooks': join(__dirname, 'src/hooks'),
    '@/auth': join(__dirname, 'src/auth.js'),
    '@': join(__dirname, 'src'),
  },
});

console.log('API routes built successfully!');
