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
      host: "0.0.0.0",
      proxy: {
        "/api": {
          // 建议1: 使用 127.0.0.1 避免 DNS 解析问题
          target: env.VITE_API_TARGET || "http://127.0.0.1:3000",
          changeOrigin: true,
          secure: false,
          // 建议2: 你的后端路由定义里包含了 /api，所以这里不需要 rewrite
          // 默认情况下 proxy 会把 /api/xxx 原样发给后端，这正是你需要的

          // 保留你的日志配置，非常有价值
          configure: (proxy, options) => {
            proxy.on("error", (err, req, res) => {
              console.log("❌ 代理错误:", err);
            });
            proxy.on("proxyReq", (proxyReq, req, res) => {
              // 在终端显示真实发出的请求
              console.log(
                "📡 发送请求到后端:",
                req.method,
                req.url,
                " => ",
                proxyReq.path
              );
            });
            proxy.on("proxyRes", (proxyRes, req, res) => {
              console.log("📦 后端响应状态:", proxyRes.statusCode, req.url);
            });
          },
        },
        "/uploads": {
          target: env.VITE_API_TARGET || "http://127.0.0.1:3000",
          changeOrigin: true,
          secure: false,
        },
      },
      // 添加 HMR 配置
      hmr: {
        overlay: true, // 显示错误覆盖层
      },
    },
    // 构建配置
    build: {
      outDir: "dist",
      sourcemap: mode === "development",
      assetsDir: "assets",
      // 优化依赖项分割
      rollupOptions: {
        output: {
          manualChunks: {
            vue: ["vue", "vue-router", "pinia"],
            vendor: ["axios", "country-state-city", "lodash-es"],
            ui: ["element-plus", "vant"],
          },
          chunkFileNames: "assets/js/[name]-[hash].js",
          entryFileNames: "assets/js/[name]-[hash].js",
          assetFileNames: (assetInfo) => {
            if (assetInfo.name?.endsWith(".css")) {
              return "assets/css/[name]-[hash][extname]";
            }
            if (/\.(png|jpe?g|gif|svg|webp|ico)$/.test(assetInfo.name)) {
              return "assets/images/[name]-[hash][extname]";
            }
            if (/\.(woff2?|eot|ttf|otf)$/.test(assetInfo.name)) {
              return "assets/fonts/[name]-[hash][extname]";
            }
            return "assets/[name]-[hash][extname]";
          },
        },
      },
      // 构建优化
      minify: "terser",
      terserOptions: {
        compress: {
          drop_console: mode !== "development", // 生产环境移除console
          drop_debugger: true,
        },
      },
      // 分块策略
      chunkSizeWarningLimit: 1000,
    },
    // 预加载和预取
    optimizeDeps: {
      include: ["vue", "vue-router", "pinia", "axios"],
      exclude: [],
    },
    // 全局常量定义
    define: {
      __APP_VERSION__: JSON.stringify(env.VITE_APP_VERSION || "1.0.0"),
      __APP_ENV__: JSON.stringify(env.VITE_APP_ENV || "development"),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
  };
});
