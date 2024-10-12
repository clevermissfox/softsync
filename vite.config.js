import { defineConfig } from "vite";
import envCompatible from "vite-plugin-env-compatible";
import react from "@vitejs/plugin-react";
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), envCompatible()],
  server: {
    proxy: {
      "/api": {
        target:
          "https://6af071b1511c548a40558a625f777d9d.r2.cloudflarestorage.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
