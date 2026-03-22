import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'index': 'src/index.ts',
    'models/index': 'src/models/index.ts',
    'tools/index': 'src/tools/index.ts',
    'cli/index': 'src/cli/index.ts'
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  outDir: 'dist',
  target: 'es2022',
  platform: 'node',
  banner: {
    js: '#!/usr/bin/env node'
  },
  esbuildOptions(options) {
    options.conditions = ['import', 'module', 'require'];
  }
});
