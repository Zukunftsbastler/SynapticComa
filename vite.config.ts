/// <reference types="vitest/config" />
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
  test: {
    // Headless ECS/network-protocol tests — no DOM needed (PixiDriver/HUD
    // etc. are UI-layer and out of scope here; see docs/roadmap.md §1).
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
