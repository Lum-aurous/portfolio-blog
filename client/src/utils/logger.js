// src/utils/logger.js
import envConfig from './env.js'

// 日志级别映射
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4
}

// 获取当前日志级别
const getCurrentLogLevel = () => {
  const level = envConfig.logLevel.toLowerCase()
  return LOG_LEVELS[level] || LOG_LEVELS.info
}

const CURRENT_LEVEL = getCurrentLogLevel()

/**
 * 格式化日志消息
 */
const formatMessage = (level, ...args) => {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`
  return [prefix, ...args]
}

/**
 * 高级日志工具
 */
const logger = {
  // 检查日志级别是否启用
  isLevelEnabled(level) {
    const levelValue = LOG_LEVELS[level.toLowerCase()]
    return CURRENT_LEVEL <= levelValue
  },

  // 调试日志（最详细）
  debug(...args) {
    if (this.isLevelEnabled('debug')) {
      console.debug(...formatMessage('debug', ...args))
    }
  },

  // 信息日志
  info(...args) {
    if (this.isLevelEnabled('info')) {
      console.info(...formatMessage('info', ...args))
    }
  },

  // 成功日志
  success(...args) {
    if (this.isLevelEnabled('info')) {
      console.log('✅', ...args)
    }
  },

  // 警告日志
  warn(...args) {
    if (this.isLevelEnabled('warn')) {
      console.warn('⚠️', ...args)
    }
  },

  // 错误日志
  error(...args) {
    if (this.isLevelEnabled('error')) {
      console.error('❌', ...args)
    }
  },

  // 开发专用日志（只在开发环境显示）
  dev(...args) {
    if (envConfig.isDev && this.isLevelEnabled('debug')) {
      console.log('🔧', ...args)
    }
  },

  // 生产专用日志（只在生产环境显示）
  prod(...args) {
    if (envConfig.isProd && this.isLevelEnabled('info')) {
      console.log('🚀', ...args)
    }
  },

  // 分组日志
  group(label) {
    if (this.isLevelEnabled('debug')) {
      console.group(label)
    }
  },

  groupCollapsed(label) {
    if (this.isLevelEnabled('debug')) {
      console.groupCollapsed(label)
    }
  },

  groupEnd() {
    if (this.isLevelEnabled('debug')) {
      console.groupEnd()
    }
  },

  // 性能计时
  time(label) {
    if (this.isLevelEnabled('debug')) {
      console.time(label)
    }
  },

  timeEnd(label) {
    if (this.isLevelEnabled('debug')) {
      console.timeEnd(label)
    }
  },

  // 表格日志
  table(data) {
    if (this.isLevelEnabled('debug')) {
      console.table(data)
    }
  },

  // 样式化日志
  styled(style, ...args) {
    if (this.isLevelEnabled('debug')) {
      console.log(`%c${args.join(' ')}`, style)
    }
  },

  // 壁纸相关专用日志
  wallpaper(label, ...args) {
    if (this.isLevelEnabled('info')) {
      console.log(`🎨 ${label}:`, ...args)
    }
  },

  // 上传相关专用日志
  upload(label, ...args) {
    if (this.isLevelEnabled('info')) {
      console.log(`📤 ${label}:`, ...args)
    }
  },

  // 用户相关专用日志
  user(label, ...args) {
    if (this.isLevelEnabled('info')) {
      console.log(`👤 ${label}:`, ...args)
    }
  },

  // 获取当前日志级别
  getLevel() {
    return Object.keys(LOG_LEVELS).find(
      key => LOG_LEVELS[key] === CURRENT_LEVEL
    )
  }
}

export default logger