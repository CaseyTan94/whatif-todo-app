import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Resolve the `@/*` alias from tsconfig.json, same as Next does.
    tsconfigPaths: true,
  },
  test: {
    include: ['__tests__/**/*.test.{ts,tsx}'],
    // Pure lib tests run in Node. Component/hook tests can opt into jsdom
    // per file with a `// @vitest-environment jsdom` comment.
    environment: 'node',
  },
});
