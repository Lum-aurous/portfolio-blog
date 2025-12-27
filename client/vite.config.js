import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 5173,
      host: true, // 允许局域网访问，方便手机端调试
      proxy: {
        // 1. API 接口代理
        "/api": {
          target: env.VITE_API_TARGET || "http://127.0.0.1:3000",
          changeOrigin: true,
          secure: false,
          // 移除 configure 里的 console 输出可以提升一点开发环境性能，如果需要调试再开启
        },
        // 2. 🔥 核心优化：静态资源（封面、视频）代理
        "/uploads": {
          target: env.VITE_API_TARGET || "http://127.0.0.1:3000",
          changeOrigin: true,
          secure: false,
          // 💡 关键：确保响应头允许缓存，加快图片加载速度
          configure: (proxy, options) => {
            proxy.on("proxyRes", (proxyRes, req, res) => {
              res.setHeader("Cache-Control", "public, max-age=31536000");
            });
          },
        },
      },
      hmr: {
        overlay: true,
      },
    },
    build: {
      outDir: "dist",
      sourcemap: mode === "development",
      assetsDir: "assets",
      // 💡 优化：将视频和图片文件的压缩阈值调高，防止小视频被打包成 Base64 导致主包过大
      assetsInlineLimit: 4096,
      rollupOptions: {
        output: {
          manualChunks: {
            vue_vendor: ["vue", "vue-router", "pinia"],
            tools_vendor: ["axios", "lodash-es"],
            ui_vendor: ["element-plus", "vant"],
          },
          chunkFileNames: "assets/js/[name]-[hash].js",
          entryFileNames: "assets/js/[name]-[hash].js",
          assetFileNames: (assetInfo) => {
            if (assetInfo.name?.endsWith(".css"))
              return "assets/css/[name]-[hash][extname]";
            // 💡 增强：增加对视频文件后缀的分类处理
            if (/\.(mp4|webm|ogg|mp3|wav|flac|aac)$/i.test(assetInfo.name)) {
              return "assets/media/[name]-[hash][extname]";
            }
            if (/\.(png|jpe?g|gif|svg|webp|ico)$/i.test(assetInfo.name)) {
              return "assets/images/[name]-[hash][extname]";
            }
            return "assets/[name]-[hash][extname]";
          },
        },
      },
      minify: "terser",
      terserOptions: {
        compress: {
          drop_console: mode !== "development",
          drop_debugger: true,
        },
      },
      chunkSizeWarningLimit: 1200,
    },
    optimizeDeps: {
      include: ["vue", "vue-router", "pinia", "axios", "element-plus"],
    },
    define: {
      __APP_VERSION__: JSON.stringify(env.VITE_APP_VERSION || "1.0.0"),
      __APP_ENV__: JSON.stringify(env.VITE_APP_ENV || "development"),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
  };
});
