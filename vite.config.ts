import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { visualizer } from "rollup-plugin-visualizer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(),
  ],
  base: "/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: { 
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        // ENFORCE SYNCHRONOUS VENDOR CHUNKING
        // Force core dependencies into dedicated chunks to execute synchronously
        manualChunks: {
          // React core - must load first
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Supabase auth - dedicated chunk
          'supabase': ['@supabase/supabase-js'],
          // LiveKit - dedicated chunk
          'livekit': ['@livekit/components-react', '@livekit/components-styles', 'livekit-client', 'livekit-server-sdk'],
          // Editor - Tiptap
          'editor': ['@tiptap/react', '@tiptap/starter-kit', '@tiptap/extension-collaboration', '@tiptap/extension-highlight', '@tiptap/extension-placeholder', '@tiptap/extension-task-item', '@tiptap/extension-task-list', '@tiptap/extension-typography'],
          // General vendor
          'vendor': ['yjs', 'y-webrtc', 'uuid', 'clsx', 'tailwind-merge', 'lucide-react']
        }
      }
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
});
