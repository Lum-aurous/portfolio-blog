// src/utils/env.js

/**
 * 环境配置工具
 */
class EnvConfig {
  constructor() {
    this.env = import.meta.env;
  }

  // 获取环境变量
  get(key, defaultValue = "") {
    return this.env[key] || defaultValue;
  }

  // 是否是开发环境
  get isDev() {
    return this.env.MODE === "development";
  }

  // 是否是生产环境
  get isProd() {
    return this.env.MODE === "production";
  }

  // 是否是预发布环境
  get isStaging() {
    return this.env.MODE === "staging";
  }

  // 当前环境名称
  get envName() {
    return this.env.VITE_APP_ENV || "development";
  }

  // 应用名称
  get appName() {
    return this.env.VITE_APP_NAME || "Veritas";
  }

  // 应用版本
  get appVersion() {
    return this.env.VITE_APP_VERSION || "1.0.0";
  }

  // API 基础 URL
  get apiBaseUrl() {
    return this.env.VITE_API_BASE_URL || "/api";
  }

  // API 目标地址（用于代理）
  get apiTarget() {
    return this.env.VITE_API_TARGET || "http://localhost:3000";
  }

  // 上传文件 URL
  get uploadsUrl() {
    return this.env.VITE_UPLOADS_URL || "/uploads";
  }

  // 日志级别
  get logLevel() {
    return this.env.VITE_LOG_LEVEL || "info";
  }

  // 是否启用调试
  get debug() {
    return this.env.VITE_DEBUG === "true" || false;
  }

  // JWT token 刷新间隔（毫秒）
  get jwtRefreshInterval() {
    return parseInt(this.env.VITE_JWT_REFRESH_INTERVAL) || 300000; // 默认5分钟
  }

  // 获取完整的配置对象
  get config() {
    return {
      isDev: this.isDev,
      isProd: this.isProd,
      isStaging: this.isStaging,
      envName: this.envName,
      appName: this.appName,
      appVersion: this.appVersion,
      apiBaseUrl: this.apiBaseUrl,
      apiTarget: this.apiTarget,
      uploadsUrl: this.uploadsUrl,
      logLevel: this.logLevel,
      debug: this.debug,
      jwtRefreshInterval: this.jwtRefreshInterval,
    };
  }

  // 打印环境配置（仅开发环境）
  logConfig() {
    if (this.isDev) {
      console.group("🌍 环境配置");
      console.table(this.config);
      console.groupEnd();
    }
  }

  // JWT 相关工具方法
  static validateToken(token) {
    if (!token) return false;

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const expiry = payload.exp * 1000; // 转换为毫秒
      const now = Date.now();

      return expiry > now;
    } catch (error) {
      console.error("解析 token 失败:", error);
      return false;
    }
  }

  static getUserFromToken(token) {
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
  }

  // 检查是否需要刷新 token
  static shouldRefreshToken(token) {
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
  }
}

// 创建单例实例
const envConfig = new EnvConfig();

export default envConfig;
