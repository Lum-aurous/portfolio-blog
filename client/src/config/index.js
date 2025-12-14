// src/config/index.js

const config = {
  // 应用信息
  app: {
    name: import.meta.env.VITE_APP_NAME || "Veritas",
    version: import.meta.env.VITE_APP_VERSION || "1.0.0",
    env: import.meta.env.VITE_APP_ENV || "development",
  },

  // API 配置
  api: {
    baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
    target: import.meta.env.VITE_API_TARGET || "http://localhost:3000",
    timeout: 30000,
    uploadsURL: import.meta.env.VITE_UPLOADS_URL || "/uploads",
  },

  // JWT 配置
  jwt: {
    refreshInterval:
      parseInt(import.meta.env.VITE_JWT_REFRESH_INTERVAL) || 300000,
  },

  // 日志配置
  log: {
    level: import.meta.env.VITE_LOG_LEVEL || "info",
    enableDevTools: import.meta.env.DEV,
  },

  // 壁纸配置
  wallpaper: {
    defaultMode: "website",
    blurRange: {
      min: 0,
      max: 20,
      step: 1,
    },
  },

  // 环境判断
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,

  // 获取配置项
  get(key, defaultValue = null) {
    return key
      .split(".")
      .reduce(
        (obj, prop) =>
          obj && obj[prop] !== undefined ? obj[prop] : defaultValue,
        this
      );
  },

  // JWT 工具方法
  validateToken(token) {
    if (!token) return false;

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const expiry = payload.exp * 1000;
      const now = Date.now();

      return expiry > now;
    } catch (error) {
      console.error("解析 token 失败:", error);
      return false;
    }
  },

  getUserFromToken(token) {
    if (!token) return null;

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return {
        id: payload.id,
        username: payload.username,
        role: payload.role,
      };
    } catch (error) {
      console.error("从 token 获取用户信息失败:", error);
      return null;
    }
  },

  shouldRefreshToken(token) {
    if (!token) return false;

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const expiry = payload.exp * 1000;
      const now = Date.now();
      const refreshThreshold = 5 * 60 * 1000; // 提前5分钟刷新

      return expiry - now < refreshThreshold;
    } catch (error) {
      return false;
    }
  },
};

export default config;
