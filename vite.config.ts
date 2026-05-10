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
  base: "/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    // Use esbuild minification (default, no terser needed)
    minify: 'esbuild',
    rollupOptions: {
      output: {
        // Hash for cache busting
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            // Split vendor libraries
            if (id.includes('react-dom') || id.includes('react/jsx')) {
              return 'react-vendor';
            }
            if (id.includes('@supabase') || id.includes('supabase')) {
              return 'supabase';
            }
            if (id.includes('livekit') || id.includes('@livekit')) {
              return 'livekit';
            }
            if (id.includes('@tiptap')) {
              return 'editor';
            }
            if (id.includes('zustand')) {
              return 'store';
            }
            return 'vendor';
          }
          // App code goes to main chunk
          return 'app';
        }
      }
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
});