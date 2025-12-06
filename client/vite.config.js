import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    // 👇 新增：开发服务器代理配置
    // 意思是：在 npm run dev 模式下，如果遇到 /api 开头的请求，
    // 自动帮我转发给 localhost:3000
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      },
      '/uploads': { // 图片也要代理
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      }
    }
  }
})