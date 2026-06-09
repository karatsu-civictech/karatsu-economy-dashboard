import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// civictech-karatsu.org/keizai 配下で配信する。
// ハブのルーター Worker が /keizai プレフィックスを除去して
// karatsu-economy-dashboard.pages.dev (このプロジェクト) へ転送するため、
// アセット・data.json のリンクは base:'/keizai/' で絶対パス化する。
export default defineConfig({
  base: "/keizai/",
  plugins: [react()],
});
