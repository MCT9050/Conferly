import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/", // Root path for custom domain www.conferly.site
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
          livekit: ['@livekit/components-react', '@livekit/components-styles', 'livekit-client'],
          editor: ['@tiptap/extension-collaboration', '@tiptap/extension-highlight', '@tiptap/extension-placeholder', '@tiptap/extension-task-item', '@tiptap/extension-task-list', '@tiptap/extension-typography', '@tiptap/react', '@tiptap/starter-kit'],
        }
      }
    }
  }
});
