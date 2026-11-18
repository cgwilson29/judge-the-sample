import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative asset paths: works locally and on GitHub Pages (https://<user>.github.io/judge-the-sample/).
  base: "./",
});
