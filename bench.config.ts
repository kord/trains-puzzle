import { defineConfig } from 'vitest/config'

// Dedicated config for the generation benchmark (`npm run bench`), so the
// benchmark lives outside the normal `src/**/*.test.ts` test suite.
export default defineConfig({
    test: {
        environment: 'node',
        include: ['bench/**/*.test.ts'],
        testTimeout: 600000,
    },
})
