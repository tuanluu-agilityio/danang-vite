import { defineConfig } from 'vite';

export default defineConfig({
  // Đường dẫn tương đối: dist/ chạy được ở thư mục con (GitHub Pages) lẫn tên miền gốc
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Three.js tách riêng: đổi code cầu không làm trình duyệt tải lại thư viện
        manualChunks: (id) => (id.includes('node_modules/three') ? 'three' : undefined)
      }
    }
  }
});
