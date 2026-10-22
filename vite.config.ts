import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const base = process.env.VITE_BASE ?? "/";

export default defineConfig({
  // GitHub project pages are served from /HIT-timer/, not the domain root.
  base,
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
