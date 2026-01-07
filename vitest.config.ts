import { defineConfig } from 'vitest/config';

const includeDist = process.env.VITEST_INCLUDE_DIST === '1';
const baseExclude = [
  '**/node_modules/**',
  '**/cypress/**',
  '**/.{idea,git,cache,output,temp}/**',
  '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*'
];

export default defineConfig({
  test: {
    environment: 'node',
    exclude: includeDist ? baseExclude : undefined
  }
});
