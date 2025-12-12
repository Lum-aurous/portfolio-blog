// utils/cache-manager.js
export class CacheManager {
  constructor() {
    this.prefix = "wallpaper_";
    this.ttl = 5 * 60 * 1000; // 5分钟
  }

  // 设置缓存
  set(key, data, ttl = null) {
    const cacheKey = this.prefix + key;
    const cacheData = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.ttl,
    };

    try {
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      return true;
    } catch (e) {
      console.warn("缓存设置失败:", e);
      return false;
    }
  }

  // 获取缓存
  get(key) {
    const cacheKey = this.prefix + key;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return null;

      const { data, timestamp, ttl } = JSON.parse(cached);

      // 检查是否过期
      if (Date.now() - timestamp > ttl) {
        this.remove(key);
        return null;
      }

      return data;
    } catch (e) {
      console.warn("缓存读取失败:", e);
      this.remove(key);
      return null;
    }
  }

  // 删除缓存
  remove(key) {
    const cacheKey = this.prefix + key;
    try {
      localStorage.removeItem(cacheKey);
    } catch (e) {
      console.warn("缓存删除失败:", e);
    }
  }

  // 清除所有缓存
  clearAll() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(this.prefix)) {
        keys.push(key);
      }
    }

    keys.forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.warn("清除缓存失败:", key, e);
      }
    });
  }

  // 获取缓存状态
  getStatus() {
    const caches = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(this.prefix)) {
        try {
          const cached = localStorage.getItem(key);
          const { timestamp, ttl } = JSON.parse(cached);
          const age = Date.now() - timestamp;
          const expired = age > ttl;

          caches.push({
            key: key.replace(this.prefix, ""),
            age,
            ttl,
            expired,
            size: cached.length,
          });
        } catch (e) {
          // 跳过无效缓存
        }
      }
    }

    return caches;
  }

  // 预加载关键资源
  preloadCriticalResources(resources) {
    return Promise.all(
      resources.map((resource) => {
        return new Promise((resolve) => {
          if (resource.type === "image") {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = resource.url;
          } else {
            resolve(false);
          }
        });
      })
    );
  }
}

// 创建全局实例
export const cacheManager = new CacheManager();
