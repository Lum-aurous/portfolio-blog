import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";
import { useUserStore } from "@/stores/user";
import logger from "@/utils/logger";

export const useWallpaperStore = defineStore("wallpaper", () => {
  // ==================== 状态定义 ====================
  const currentWallpaper = ref("");
  const wallpaperMode = ref("website");
  const wallpaperBlur = ref(0);
  const wallpaperMask = ref(true);
  const isLoading = ref(false);
  const userHasCustom = ref(false);

  // ⚡️ 新增：缓存壁纸URL
  const wallpaperCache = ref({
    website: "",
    daily: "",
    random: [],
    userCustom: "",
  });

  // ⚡️ 新增：预加载图片缓存
  const imageCache = new Map();

  // ==================== 计算属性 ====================
  const wallpaperStyle = computed(() => {
    let url = currentWallpaper.value;

    if (url && !url.startsWith("http") && !url.startsWith("/")) {
      url = "/" + url;
    }

    if (url) {
      url = encodeURI(url);
    }

    const style = {
      backgroundImage: url ? `url("${url}")` : "none",
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      backgroundAttachment: "fixed",
      filter: `blur(${wallpaperBlur.value}px)`,
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: -1,
      // ⚡️ 优化：更快的过渡动画
      transition: "background-image 0.3s ease-in-out, filter 0.2s ease",
    };

    if (wallpaperMask.value) {
      style.backgroundColor = "rgba(0, 0, 0, 0.2)";
      style.backgroundBlendMode = "overlay";
    }

    return style;
  });

  // ==================== 私有方法 ====================

  // ⚡️ 优化：异步预加载，不阻塞主线程
  const preloadImage = (url) => {
    return new Promise((resolve) => {
      if (!url || imageCache.has(url)) {
        resolve(true);
        return;
      }

      const img = new Image();
      const timestamp = Date.now();
      const finalUrl = url.includes("?")
        ? `${url}&t=${timestamp}`
        : `${url}?t=${timestamp}`;

      // 设置超时时间更短
      const timeoutId = setTimeout(() => {
        logger.debug("图片预加载超时，继续执行");
        resolve(false);
      }, 2000);

      img.onload = () => {
        clearTimeout(timeoutId);
        imageCache.set(url, img);
        logger.debug("图片预加载完成:", url);
        resolve(true);
      };

      img.onerror = () => {
        clearTimeout(timeoutId);
        logger.warn("图片预加载失败:", url);
        resolve(false);
      };

      img.src = finalUrl;
    });
  };

  // ⚡️ 优化：批量预加载
  const preloadWallpapers = async (urls) => {
    const promises = urls.map((url) => preloadImage(url));
    return Promise.allSettled(promises);
  };

  // 获取全局壁纸配置（带缓存）
  const fetchGlobalConfig = async () => {
    try {
      const cacheKey = "global_wallpaper_config";
      const cached = localStorage.getItem(cacheKey);

      // 检查缓存是否有效（5分钟）
      if (cached) {
        try {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < 5 * 60 * 1000) {
            logger.debug("使用缓存的全局配置");
            return data;
          }
        } catch (e) {
          // 缓存无效
        }
      }

      logger.debug("请求全局壁纸配置...");
      const res = await fetch("/api/wallpaper/global");
      if (!res.ok) throw new Error("Network response was not ok");

      const data = await res.json();

      // 缓存配置
      localStorage.setItem(
        cacheKey,
        JSON.stringify({
          data,
          timestamp: Date.now(),
        })
      );

      // 预加载所有壁纸
      const urlsToPreload = [];
      if (data.websiteUrl) urlsToPreload.push(data.websiteUrl);
      if (data.dailyUrl) urlsToPreload.push(data.dailyUrl);
      if (data.randomUrls && data.randomUrls.length > 0) {
        // 只预加载前3张随机壁纸
        urlsToPreload.push(...data.randomUrls.slice(0, 3));
      }

      // 异步预加载，不阻塞
      setTimeout(() => {
        preloadWallpapers(urlsToPreload).catch(() => {
          // 静默失败
        });
      }, 100);

      return data;
    } catch (err) {
      logger.error("获取全局配置失败:", err);

      // 返回默认配置
      return {
        mode: "website",
        websiteUrl:
          "https://images.unsplash.com/photo-1493246507139-91e8fad9978e",
        dailyUrl:
          "https://images.unsplash.com/photo-1493246507139-91e8fad9978e",
        randomUrls: [],
      };
    }
  };

  // 获取用户壁纸
  const fetchUserWallpaper = async () => {
    const userStore = useUserStore();

    if (!userStore.isLoggedIn) {
      return null;
    }

    try {
      const cacheKey = `user_wallpaper_${userStore.user.id}`;
      const cached = localStorage.getItem(cacheKey);

      // 检查用户壁纸缓存（10分钟）
      if (cached) {
        try {
          const { url, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < 10 * 60 * 1000) {
            logger.debug("使用缓存的用户壁纸");
            userHasCustom.value = true;
            wallpaperCache.value.userCustom = url;

            // 异步预加载
            setTimeout(() => {
              preloadImage(url).catch(() => {});
            }, 50);

            return url;
          }
        } catch (e) {
          // 缓存无效
        }
      }

      const res = await fetch(
        `/api/wallpaper/user?userId=${userStore.user.id}`
      );
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      if (data.hasCustom && data.url) {
        const cleanUrl = data.url.startsWith("/") ? data.url : "/" + data.url;

        // 缓存用户壁纸
        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            url: cleanUrl,
            timestamp: Date.now(),
          })
        );

        userHasCustom.value = true;
        wallpaperCache.value.userCustom = cleanUrl;

        // 异步预加载
        setTimeout(() => {
          preloadImage(cleanUrl).catch(() => {});
        }, 50);

        return cleanUrl;
      }
    } catch (err) {
      logger.error("获取用户壁纸失败:", err);
    }

    userHasCustom.value = false;
    return null;
  };

  // ⚡️ 优化：立即切换壁纸（使用缓存）
  const switchWallpaperImmediately = async (mode, config) => {
    let url = "";

    switch (mode) {
      case "userCustom":
        url = wallpaperCache.value.userCustom || "";
        break;
      case "daily":
        url =
          wallpaperCache.value.daily || config.dailyUrl || config.websiteUrl;
        break;
      case "random":
        const randomList = config.randomUrls || [];
        if (randomList.length > 0) {
          const randomIndex = Math.floor(Math.random() * randomList.length);
          url = randomList[randomIndex];
        } else {
          url = config.websiteUrl;
        }
        break;
      case "website":
      default:
        url = config.websiteUrl;
        break;
    }

    if (url) {
      // ⚡️ 立即更新显示，不等待预加载
      const timestamp = Date.now();
      const encodedUrl = encodeURI(url) + `?t=${timestamp}`;
      currentWallpaper.value = encodedUrl;

      // 异步预加载（用于下次切换）
      setTimeout(() => {
        preloadImage(url).catch(() => {});
      }, 100);

      logger.debug("壁纸已切换:", mode, url);
    }

    return url;
  };

  // ==================== 公共方法 ====================

  // 初始化壁纸系统
  const initialize = async () => {
    if (isLoading.value) return;

    isLoading.value = true;
    logger.info("初始化壁纸系统");

    try {
      // 1. 获取配置
      const config = await fetchGlobalConfig();

      // 2. 缓存配置
      wallpaperCache.value.website = config.websiteUrl || "";
      wallpaperCache.value.daily = config.dailyUrl || "";
      wallpaperCache.value.random = config.randomUrls || [];

      // 3. 获取用户壁纸（如果已登录）
      const userCustomUrl = await fetchUserWallpaper();
      if (userCustomUrl) {
        wallpaperCache.value.userCustom = userCustomUrl;
      }

      // 4. 决定当前模式
      const savedMode = localStorage.getItem("preferredWallpaperMode");
      const effectiveMode = savedMode || config.mode || "website";

      // 5. 立即切换壁纸
      await switchWallpaperImmediately(effectiveMode, config);
      wallpaperMode.value = effectiveMode;

      logger.info("壁纸初始化完成");
    } catch (error) {
      logger.error("壁纸初始化失败:", error);
      // 使用默认壁纸
      const defaultUrl =
        "https://images.unsplash.com/photo-1493246507139-91e8fad9978e";
      const timestamp = Date.now();
      currentWallpaper.value = encodeURI(defaultUrl) + `?t=${timestamp}`;
    } finally {
      isLoading.value = false;
    }
  };

  // 切换壁纸（优化版）
  const changeWallpaper = async (mode) => {
    if (mode === wallpaperMode.value && mode !== "random") {
      // 相同模式（随机模式除外）不重复切换
      return;
    }

    // 立即更新模式
    wallpaperMode.value = mode;
    localStorage.setItem("preferredWallpaperMode", mode);

    try {
      // 获取最新配置
      const config = await fetchGlobalConfig();

      // 立即切换
      await switchWallpaperImmediately(mode, config);

      logger.debug("壁纸切换完成:", mode);
    } catch (error) {
      logger.error("壁纸切换失败:", error);
    }
  };

  // 上传用户壁纸
  const uploadUserWallpaper = async (file) => {
    const userStore = useUserStore();

    if (!userStore.isLoggedIn) {
      throw new Error("请先登录才能上传自定义壁纸");
    }

    if (!file || !file.type.startsWith("image/")) {
      throw new Error("请选择有效的图片文件");
    }

    const formData = new FormData();
    formData.append("image", file);
    formData.append("userId", userStore.user.id);
    formData.append("username", userStore.user.username);

    try {
      const res = await fetch("/api/wallpaper/user", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        const newUrl = data.url;

        // 更新缓存
        const cacheKey = `user_wallpaper_${userStore.user.id}`;
        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            url: newUrl,
            timestamp: Date.now(),
          })
        );

        wallpaperCache.value.userCustom = newUrl;
        userHasCustom.value = true;

        // 立即切换
        const timestamp = Date.now();
        const encodedUrl = encodeURI(newUrl) + `?t=${timestamp}`;
        currentWallpaper.value = encodedUrl;
        wallpaperMode.value = "userCustom";
        localStorage.setItem("preferredWallpaperMode", "userCustom");

        // 异步预加载
        setTimeout(() => {
          preloadImage(newUrl).catch(() => {});
        }, 100);

        logger.success("壁纸上传成功");
        return data;
      } else {
        throw new Error(data.error || "上传失败");
      }
    } catch (err) {
      logger.error("上传壁纸失败:", err);
      throw err;
    }
  };

  // 清除缓存
  const clearCache = () => {
    wallpaperCache.value = {
      website: "",
      daily: "",
      random: [],
      userCustom: "",
    };
    imageCache.clear();

    // 清除localStorage中的壁纸缓存
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key.startsWith("user_wallpaper_") ||
        key === "global_wallpaper_config"
      ) {
        keys.push(key);
      }
    }
    keys.forEach((key) => localStorage.removeItem(key));
  };

  // 监听用户登录状态
  watch(
    () => useUserStore().isLoggedIn,
    (isLoggedIn) => {
      if (isLoggedIn) {
        // 用户登录时刷新用户壁纸
        fetchUserWallpaper().then((customUrl) => {
          if (customUrl && wallpaperMode.value === "userCustom") {
            // 如果当前是自定义模式，更新壁纸
            const timestamp = Date.now();
            const encodedUrl = encodeURI(customUrl) + `?t=${timestamp}`;
            currentWallpaper.value = encodedUrl;
          }
        });
      } else {
        userHasCustom.value = false;
        wallpaperCache.value.userCustom = "";

        if (wallpaperMode.value === "userCustom") {
          // 回退到网站背景
          wallpaperMode.value = "website";
          localStorage.setItem("preferredWallpaperMode", "website");
          initialize();
        }
      }
    }
  );

  return {
    // 状态
    currentWallpaper,
    wallpaperMode,
    wallpaperBlur,
    wallpaperMask,
    isLoading,
    userHasCustom,

    // 计算属性
    wallpaperStyle,

    // 方法
    initialize,
    changeWallpaper,
    uploadUserWallpaper,
    clearCache,
    fetchGlobalConfig,
    fetchUserWallpaper,
  };
});
