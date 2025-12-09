// src/utils/env.js

/**
 * 环境配置工具
 */
class EnvConfig {
  constructor() {
    this.env = import.meta.env
  }

  // 获取环境变量
  get(key, defaultValue = '') {
    return this.env[key] || defaultValue
  }

  // 是否是开发环境
  get isDev() {
    return this.env.MODE === 'development'
  }

  // 是否是生产环境
  get isProd() {
    return this.env.MODE === 'production'
  }

  // 是否是预发布环境
  get isStaging() {
    return this.env.MODE === 'staging'
  }

  // 当前环境名称
  get envName() {
    return this.env.VITE_APP_ENV || 'development'
  }

  // 应用名称
  get appName() {
    return this.env.VITE_APP_NAME || 'Veritas'
  }

  // 应用版本
  get appVersion() {
    return this.env.VITE_APP_VERSION || '1.0.0'
  }

  // API 基础 URL
  get apiBaseUrl() {
    return this.env.VITE_API_BASE_URL || '/api'
  }

  // 上传文件 URL
  get uploadsUrl() {
    return this.env.VITE_UPLOADS_URL || '/uploads'
  }

  // 日志级别
  get logLevel() {
    return this.env.VITE_LOG_LEVEL || 'info'
  }

  // 是否启用调试
  get debug() {
    return this.env.VITE_DEBUG === 'true' || false
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
      uploadsUrl: this.uploadsUrl,
      logLevel: this.logLevel,
      debug: this.debug
    }
  }

  // 打印环境配置（仅开发环境）
  logConfig() {
    if (this.isDev) {
      console.group('🌍 环境配置')
      console.table(this.config)
      console.groupEnd()
    }
  }
}

// 创建单例实例
const envConfig = new EnvConfig()

export default envConfig