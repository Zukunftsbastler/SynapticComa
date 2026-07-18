import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Note: *.json must NOT appear in assetsInclude — level files are imported
  // as modules by LevelLoaderSystem; treating them as static assets makes the
  // vite:json plugin fail ("Failed to parse JSON file").
  assetsInclude: ['**/*.webp'],
});
