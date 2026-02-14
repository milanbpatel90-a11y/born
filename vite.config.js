import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    host: true,
    open: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization'
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          'mediapipe': ['@mediapipe/face_mesh', '@mediapipe/holistic'],
          'three': ['three']
        }
      }
    }
  },
  optimizeDeps: {
    include: ['@mediapipe/face_mesh', '@mediapipe/holistic', 'three'],
    exclude: ['opencv.js']
  },
  // Handle MediaPipe assets
  assetsInclude: ['**/*.wasm', '**/*.data'],
  // Proxy for MediaPipe assets to avoid CORS issues
  proxy: {
    '/mediapipe-assets': {
      target: 'https://cdn.jsdelivr.net/npm/@mediapipe/',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/mediapipe-assets/, '')
    }
  }
});
