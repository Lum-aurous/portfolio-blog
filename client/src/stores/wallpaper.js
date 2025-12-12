// stores/wallpaper.js
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
  const isInitialized = ref(false); // 🔥 新增：防止重复初始化

  // 缓存配置
  const wallpaperCache = ref({
    website: "",
    daily: "",
    random: [],
    userCustom: "",
  });

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

    return {
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
      transition: "filter 0.2s ease, opacity 0.3s ease-in-out", // 🔥 优化过渡
      opacity: url ? 1 : 0, // 🔥 平滑加载
      backgroundColor: wallpaperMask.value
        ? "rgba(0, 0, 0, 0.2)"
        : "transparent",
      backgroundBlendMode: wallpaperMask.value ? "overlay" : "normal",
    };
  });

  // ==================== 私有方法 ====================

  // 🔥 优化：快速预加载，超时控制
  const preloadImage = (url) => {
    return new Promise((resolve) => {
      if (!url || imageCache.has(url)) {
        resolve(true);
        return;
      }

      const img = new Image();
      const timeoutId = setTimeout(() => {
        logger.debug("图片预加载超时，继续执行");
        resolve(false);
      }, 1500); // 🔥 缩短超时时间

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

      img.src = url;
    });
  };

  // 获取全局壁纸配置（带缓存）
  const fetchGlobalConfig = async () => {
    try {
      const cacheKey = "global_wallpaper_config";
      const cached = sessionStorage.getItem(cacheKey); // 🔥 改用 sessionStorage

      if (cached) {
        try {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < 10 * 60 * 1000) {
            // 🔥 延长缓存时间到10分钟
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
      sessionStorage.setItem(
        cacheKey,
        JSON.stringify({
          data,
          timestamp: Date.now(),
        })
      );

      return data;
    } catch (err) {
      logger.error("获取全局配置失败:", err);
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
      const cached = sessionStorage.getItem(cacheKey); // 🔥 改用 sessionStorage

      if (cached) {
        try {
          const { url, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < 15 * 60 * 1000) {
            // 🔥 延长到15分钟
            logger.debug("使用缓存的用户壁纸");
            userHasCustom.value = true;
            wallpaperCache.value.userCustom = url;
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

        sessionStorage.setItem(
          cacheKey,
          JSON.stringify({
            url: cleanUrl,
            timestamp: Date.now(),
          })
        );

        userHasCustom.value = true;
        wallpaperCache.value.userCustom = cleanUrl;
        return cleanUrl;
      }
    } catch (err) {
      logger.error("获取用户壁纸失败:", err);
    }

    userHasCustom.value = false;
    return null;
  };

  // 🔥 优化：立即切换壁纸
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
      // 🔥 立即更新显示
      currentWallpaper.value = url;
      logger.debug("壁纸已切换:", mode, url);

      // 🔥 异步预加载（不阻塞）
      requestIdleCallback(() => {
        preloadImage(url).catch(() => {});
      });
    }

    return url;
  };

  // ==================== 公共方法 ====================

  // 🔥 优化：防止重复初始化
  const initialize = async () => {
    if (isInitialized.value || isLoading.value) {
      logger.info("壁纸已初始化，跳过重复请求");
      return;
    }

    isLoading.value = true;
    logger.info("🎨 初始化壁纸系统");

    try {
      // 1. 并行获取配置
      const [config, userCustomUrl] = await Promise.all([
        fetchGlobalConfig(),
        fetchUserWallpaper(),
      ]);

      logger.debug("全局配置:", config);
      logger.debug("用户壁纸:", userCustomUrl);

      // 2. 缓存配置
      wallpaperCache.value.website = config.websiteUrl || "";
      wallpaperCache.value.daily = config.dailyUrl || "";
      wallpaperCache.value.random = config.randomUrls || [];

      if (userCustomUrl) {
        wallpaperCache.value.userCustom = userCustomUrl;
      }

      // 3. 决定当前模式
      const savedMode = localStorage.getItem("preferredWallpaperMode");
      const effectiveMode = savedMode || config.mode || "website";

      logger.debug("壁纸模式:", effectiveMode);

      // 4. 🔥 立即切换壁纸
      await switchWallpaperImmediately(effectiveMode, config);
      wallpaperMode.value = effectiveMode;

      // 5. 🔥 确保壁纸已设置
      if (!currentWallpaper.value) {
        logger.warn("壁纸未设置，使用默认");
        currentWallpaper.value =
          config.websiteUrl ||
          "https://images.unsplash.com/photo-1493246507139-91e8fad9978e";
      }

      logger.info("✅ 壁纸初始化完成:", currentWallpaper.value);
      isInitialized.value = true;
    } catch (error) {
      logger.error("❌ 壁纸初始化失败:", error);
      // 使用默认壁纸
      const defaultUrl =
        "https://images.unsplash.com/photo-1493246507139-91e8fad9978e";
      currentWallpaper.value = defaultUrl;
      logger.info("使用默认壁纸:", defaultUrl);
    } finally {
      isLoading.value = false;
    }
  };

  // 切换壁纸
  const changeWallpaper = async (mode) => {
    if (mode === wallpaperMode.value && mode !== "random") {
      return;
    }

    wallpaperMode.value = mode;
    localStorage.setItem("preferredWallpaperMode", mode);

    try {
      const config = await fetchGlobalConfig();
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

        const cacheKey = `user_wallpaper_${userStore.user.id}`;
        sessionStorage.setItem(
          cacheKey,
          JSON.stringify({
            url: newUrl,
            timestamp: Date.now(),
          })
        );

        wallpaperCache.value.userCustom = newUrl;
        userHasCustom.value = true;

        currentWallpaper.value = newUrl;
        wallpaperMode.value = "userCustom";
        localStorage.setItem("preferredWallpaperMode", "userCustom");

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

  // 🔥 新增：重置初始化状态
  const resetInitialization = () => {
    isInitialized.value = false;
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

    const keys = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (
        key.startsWith("user_wallpaper_") ||
        key === "global_wallpaper_config"
      ) {
        keys.push(key);
      }
    }
    keys.forEach((key) => sessionStorage.removeItem(key));

    resetInitialization(); // 🔥 重置初始化状态
  };

  // 监听用户登录状态
  watch(
    () => useUserStore().isLoggedIn,
    (isLoggedIn) => {
      if (isLoggedIn) {
        fetchUserWallpaper().then((customUrl) => {
          if (customUrl && wallpaperMode.value === "userCustom") {
            currentWallpaper.value = customUrl;
          }
        });
      } else {
        userHasCustom.value = false;
        wallpaperCache.value.userCustom = "";

        if (wallpaperMode.value === "userCustom") {
          wallpaperMode.value = "website";
          localStorage.setItem("preferredWallpaperMode", "website");
          resetInitialization(); // 🔥 允许重新初始化
          initialize();
        }
      }
    }
  );

  return {
    currentWallpaper,
    wallpaperMode,
    wallpaperBlur,
    wallpaperMask,
    isLoading,
    userHasCustom,
    isInitialized, // 🔥 暴露初始化状态

    wallpaperStyle,

    initialize,
    changeWallpaper,
    uploadUserWallpaper,
    clearCache,
    resetInitialization, // 🔥 暴露重置方法
    fetchGlobalConfig,
    fetchUserWallpaper,
  };
});
