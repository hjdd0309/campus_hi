import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    host: "127.0.0.1",
    proxy: {
      "/api":
        process.env.API_TARGET ||
        `http://127.0.0.1:${process.env.API_PORT || 8000}`,
    },
  },
  preview: {
    host: "127.0.0.1",
    proxy: {
      "/api":
        process.env.API_TARGET ||
        `http://127.0.0.1:${process.env.API_PORT || 8000}`,
    },
  },
});
