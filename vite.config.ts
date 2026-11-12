import { defineConfig } from 'vitest/config';

// Relative base: the same build runs on GitHub Pages (sub-path) and from
// file:// inside a desktop wrapper (Electron/Tauri) for a future Steam build.
export default defineConfig({
  base: './',
  build: { target: 'es2022' },
  test: { include: ['tests/unit/**/*.test.ts'] },
});
