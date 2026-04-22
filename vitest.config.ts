import { defineConfig } from "vite";   // ✅ FIX THIS
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  
  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});