import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";

export default defineConfig(({ mode }) => {
  // 加载环境变量
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
      host: true, // 允许局域网访问（手机测试必备）

      // 🔥 核心代理配置
      proxy: {
        // 1. API 接口代理 (涵盖了 /api/login, /api/upload 等)
        "/api": {
          target: env.VITE_API_TARGET || "http://127.0.0.1:3000",
          changeOrigin: true,
          secure: false,
          // 🔥 增强点：设置 10 分钟超时，防止 500MB 视频上传时前端报 timeout 错误
          timeout: 10 * 60 * 1000,
        },

        // 2. 静态资源代理 (涵盖了 /uploads/xxx.jpg)
        // 虽然我们在前端代码里加了 /api 前缀，但保留这个规则作为双重保险是非常好的
        "/uploads": {
          target: env.VITE_API_TARGET || "http://127.0.0.1:3000",
          changeOrigin: true,
          secure: false,
          // 💡 确保图片资源有缓存头，提升二次加载速度
          configure: (proxy, options) => {
            proxy.on("proxyRes", (proxyRes, req, res) => {
              res.setHeader("Cache-Control", "public, max-age=31536000");
            });
          },
        },
      },

      // HMR (热更新) 报错遮罩，开发时很有用
      hmr: {
        overlay: true,
      },
    },

    build: {
      outDir: "dist",
      sourcemap: mode === "development", // 生产环境关闭 sourcemap 减小体积
      assetsDir: "assets",

      // 💡 优化：调高阈值，防止小的 SVG/ICON 被内联导致主包过大
      assetsInlineLimit: 4096,

      rollupOptions: {
        output: {
          // 🔥 智能分包：将第三方库单独打包，利用浏览器缓存
          manualChunks: {
            vue_vendor: ["vue", "vue-router", "pinia"],
            tools_vendor: ["axios", "lodash-es"],
            // 如果你用了 UI 库，这里可以取消注释
            // ui_vendor: ["element-plus", "vant"],
          },

          // 整理打包后的文件名，分类存放，看着更清爽
          chunkFileNames: "assets/js/[name]-[hash].js",
          entryFileNames: "assets/js/[name]-[hash].js",
          assetFileNames: (assetInfo) => {
            if (assetInfo.name?.endsWith(".css")) {
              return "assets/css/[name]-[hash][extname]";
            }
            // 💡 媒体文件归类
            if (/\.(mp4|webm|ogg|mp3|wav|flac|aac)$/i.test(assetInfo.name)) {
              return "assets/media/[name]-[hash][extname]";
            }
            // 💡 图片文件归类
            if (/\.(png|jpe?g|gif|svg|webp|ico)$/i.test(assetInfo.name)) {
              return "assets/images/[name]-[hash][extname]";
            }
            return "assets/[name]-[hash][extname]";
          },
        },
      },

      // 生产环境移除 console 和 debugger
      minify: "terser",
      terserOptions: {
        compress: {
          drop_console: mode !== "development",
          drop_debugger: true,
        },
      },

      // 警告限制调大一点，避免打包时一直报警告
      chunkSizeWarningLimit: 1200,
    },

    // 预构建依赖优化
    optimizeDeps: {
      include: ["vue", "vue-router", "pinia", "axios"],
    },

    // 全局常量定义
    define: {
      __APP_VERSION__: JSON.stringify(env.VITE_APP_VERSION || "1.0.0"),
      __APP_ENV__: JSON.stringify(env.VITE_APP_ENV || "development"),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
  };
});
