import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5173
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          primevue: ['primevue'],
          charts: ['chart.js', 'vue-chartjs']
        }
      }
    }
  }
})
