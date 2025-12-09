import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";

// https://vitejs.dev/config/
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
      proxy: {
        "/api": {
          target: env.VITE_API_TARGET || "http://localhost:3000",
          changeOrigin: true,
          secure: false,
        },
        "/uploads": {
          target: env.VITE_API_TARGET || "http://localhost:3000",
          changeOrigin: true,
          secure: false,
        },
      },
    },
    // 定义全局常量
    define: {
      __APP_VERSION__: JSON.stringify(env.VITE_APP_VERSION || "1.0.0"),
      __APP_ENV__: JSON.stringify(env.VITE_APP_ENV || "development"),
    },
    // 构建配置
    build: {
      // 输出目录
      outDir: "dist",
      // 是否生成 sourcemap
      sourcemap: mode === "development",
      // 资源文件输出目录
      assetsDir: "assets",
      // 资源文件命名
      rollupOptions: {
        output: {
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
    },
  };
});
                                                                                                                                                                                                                  