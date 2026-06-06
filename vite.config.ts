import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base を相対パスにして、GitHub Pages / Cloudflare Pages いずれのサブパスでも動くようにする
export default defineConfig({
  base: "./",
  plugins: [react()],
});
