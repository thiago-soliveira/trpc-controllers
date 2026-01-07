import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { watch: false, threads: false, hookTimeout: 30000, testTimeout: 30000 },
});
