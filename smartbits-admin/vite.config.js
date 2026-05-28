import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/api/csv-proxy': {
        target: 'https://docs.google.com',
        changeOrigin: true,
        rewrite: (_path) => {
          // Extract the original Google URL from the query parameter
          const url = new URL(_path, 'http://localhost');
          const googleUrl = url.searchParams.get('url');
          if (googleUrl) {
            const parsed = new URL(googleUrl);
            return parsed.pathname + parsed.search;
          }
          return _path;
        },
      },
    },
  },
})
