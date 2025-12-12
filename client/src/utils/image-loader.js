// utils/image-loader.js
export class ImageLoader {
  constructor() {
    this.cache = new Map();
    this.preloadQueue = [];
    this.isProcessing = false;
  }

  // 快速加载图片（返回Promise）
  load(url, options = {}) {
    return new Promise((resolve, reject) => {
      // 检查缓存
      if (this.cache.has(url)) {
        resolve(this.cache.get(url));
        return;
      }

      const img = new Image();

      // 设置超时
      const timeout = options.timeout || 5000;
      const timeoutId = setTimeout(() => {
        reject(new Error(`图片加载超时: ${url.substring(0, 50)}...`));
        img.onload = img.onerror = null;
      }, timeout);

      img.onload = () => {
        clearTimeout(timeoutId);
        this.cache.set(url, img);
        resolve(img);
      };

      img.onerror = (err) => {
        clearTimeout(timeoutId);
        reject(new Error(`图片加载失败: ${url.substring(0, 50)}...`));
      };

      // 添加防缓存参数
      const finalUrl = this.addCacheBuster(url);
      img.src = finalUrl;
      img.crossOrigin = "anonymous";
    });
  }

  // 预加载图片（不阻塞）
  preload(urls) {
    urls.forEach((url) => {
      if (!this.cache.has(url) && !this.preloadQueue.includes(url)) {
        this.preloadQueue.push(url);
      }
    });

    // 如果不在处理中，开始处理队列
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  // 处理预加载队列
  async processQueue() {
    if (this.isProcessing || this.preloadQueue.length === 0) return;

    this.isProcessing = true;

    // 每次处理3张图片
    const batchSize = 3;
    while (this.preloadQueue.length > 0) {
      const batch = this.preloadQueue.splice(0, batchSize);

      // 并行加载批次
      const promises = batch.map((url) =>
        this.load(url, { timeout: 3000 }).catch(() => {
          // 静默失败，不影响其他图片
        })
      );

      await Promise.allSettled(promises);

      // 短暂延迟，避免阻塞主线程
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    this.isProcessing = false;
  }

  // 添加缓存破坏参数
  addCacheBuster(url) {
    if (!url) return url;

    const timestamp = Date.now();
    const separator = url.includes("?") ? "&" : "?";

    // 如果是Unsplash图片，添加优化参数
    if (url.includes("unsplash.com")) {
      const params = new URLSearchParams(
        url.includes("?") ? url.split("?")[1] : ""
      );
      params.set("auto", "format");
      params.set("fit", "crop");
      params.set("q", "85");
      params.set("w", "1920");
      params.set("t", timestamp.toString());

      const baseUrl = url.split("?")[0];
      return `${baseUrl}?${params.toString()}`;
    }

    return `${url}${separator}t=${timestamp}`;
  }

  // 清除缓存
  clearCache() {
    this.cache.clear();
    this.preloadQueue = [];
  }

  // 获取缓存状态
  getCacheStatus() {
    return {
      cached: this.cache.size,
      queued: this.preloadQueue.length,
      isProcessing: this.isProcessing,
    };
  }
}

// 创建全局实例
export const imageLoader = new ImageLoader();
