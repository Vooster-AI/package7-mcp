import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/**",
        "dist/**",
        "**/*.config.{js,ts}",
        "**/*.d.ts",
        "**/types.ts",
      ],
    },
    include: ["src/**/*.test.ts", "src/**/__test__/**/*.test.ts"],
    exclude: ["node_modules", "dist"],
  },
});
