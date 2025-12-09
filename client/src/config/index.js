// src/config/index.js

const config = {
  // 应用信息
  app: {
    name: import.meta.env.VITE_APP_NAME || 'Veritas',
    version: '1.0.0',
    env: import.meta.env.VITE_APP_ENV || 'development'
  },
  
  // API 配置
  api: {
    baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
    timeout: 30000,
    uploadsURL: import.meta.env.VITE_UPLOADS_URL || '/uploads'
  },
  
  // 日志配置
  log: {
    level: import.meta.env.VITE_LOG_LEVEL || 'info',
    enableDevTools: import.meta.env.DEV
  },
  
  // 壁纸配置
  wallpaper: {
    defaultMode: 'website',
    blurRange: {
      min: 0,
      max: 20,
      step: 1
    }
  },
  
  // 是否开发环境
  isDev: import.meta.env.DEV,
  
  // 是否生产环境
  isProd: import.meta.env.PROD,
  
  // 获取配置项
  get(key, defaultValue = null) {
    return key.split('.').reduce((obj, prop) => 
      obj && obj[prop] !== undefined ? obj[prop] : defaultValue, this)
  }
}

export default config