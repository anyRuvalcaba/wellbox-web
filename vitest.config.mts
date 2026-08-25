import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// .mts (no .ts): con sintaxis de módulos ES y sin "type": "module" en package.json
// (no se toca — afectaría al resto de la app Next), Vite avisaba que cargaba este
// archivo como CommonJS. La extensión .mts se lo deja claro sin ese efecto secundario.
//
// resolve.tsconfigPaths en vez del plugin vite-tsconfig-paths: Vite ya lo resuelve de
// forma nativa, así que la dependencia extra no hacía falta.
export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.mts"],
    exclude: ["node_modules/**", ".next/**", "supabase/**"],
  },
});
