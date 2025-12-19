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
  let isFetchingUserWallpaper = false;

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
      const cached = sessionStorage.getItem(cacheKey);

      if (cached) {
        try {
          const { data, timestamp } = JSON.parse(cached);
          // 🔥 缩短每日壁纸的缓存时间（1小时）
          const isDailyMode = wallpaperMode.value === "daily";
          const cacheDuration = isDailyMode ? 60 * 60 * 1000 : 10 * 60 * 1000;

          if (Date.now() - timestamp < cacheDuration) {
            logger.debug("使用缓存的全局配置");
            return data;
          }
        } catch (e) {}
      }

      logger.debug("请求全局壁纸配置...");
      const res = await fetch("/api/wallpaper/global");
      if (!res.ok) throw new Error("Network response was not ok");

      const json = await res.json();
      const data = json.data;

      // 🔥 新增：每日壁纸模式下的特殊日志
      if (wallpaperMode.value === "daily") {
        logger.info(`📅 获取每日壁纸: ${data.dailyUrl ? "已设置" : "未设置"}`);
      }

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
    if (isFetchingUserWallpaper) {
      console.log("⏸️ 用户壁纸获取已在进行中，跳过");
      return null;
    }

    isFetchingUserWallpaper = true;
    const userStore = useUserStore();
    if (!userStore.isLoggedIn) return null;

    try {
      const cacheKey = `user_wallpaper_${userStore.user.id}`;
      const cached = sessionStorage.getItem(cacheKey);

      if (cached) {
        try {
          const { url, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < 15 * 60 * 1000) {
            logger.debug("使用缓存的用户壁纸");
            userHasCustom.value = true;
            wallpaperCache.value.userCustom = url;
            return url;
          }
        } catch (e) {}
      }

      const res = await fetch(
        `/api/wallpaper/user?userId=${userStore.user.id}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // 🔥 修复点：剥离外层包装
      const json = await res.json();
      const data = json.data; // 获取真正的 data

      if (json.success && data && data.hasCustom && data.url) {
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
    } finally {
      isFetchingUserWallpaper = false;
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
  // 🔥 新增：强制刷新全局配置（跳过缓存）
  // 强制刷新全局配置
  const forceRefreshGlobalConfig = async () => {
    try {
      sessionStorage.removeItem("global_wallpaper_config");
      logger.debug("强制刷新全局配置...");

      const res = await fetch("/api/wallpaper/global?t=" + Date.now());
      if (!res.ok) throw new Error("Network response was not ok");

      // 🔥 修复点：剥离外层包装
      const json = await res.json();
      const data = json.data;

      sessionStorage.setItem(
        "global_wallpaper_config",
        JSON.stringify({
          data,
          timestamp: Date.now(),
        })
      );

      wallpaperCache.value.website = data.websiteUrl || "";
      wallpaperCache.value.daily = data.dailyUrl || "";
      wallpaperCache.value.random = data.randomUrls || [];

      return data;
    } catch (err) {
      logger.error("强制刷新全局配置失败:", err);
      return null;
    }
  };

  // 🔥 修改 initialize 函数，添加强制刷新选项
  const initialize = async (forceRefresh = false) => {
    if (isInitialized.value && !forceRefresh) {
      logger.info("壁纸已初始化，跳过重复请求");
      return;
    }

    isLoading.value = true;
    logger.info("🎨 初始化壁纸系统" + (forceRefresh ? "（强制刷新）" : ""));

    try {
      // 1. 并行获取配置（如果强制刷新，则不使用缓存）
      let config;
      if (forceRefresh) {
        config = await forceRefreshGlobalConfig();
      } else {
        config = await fetchGlobalConfig();
      }

      const userCustomUrl = await fetchUserWallpaper();

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

      // 4. 立即切换壁纸
      await switchWallpaperImmediately(effectiveMode, config);
      wallpaperMode.value = effectiveMode;

      // 5. 确保壁纸已设置
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
  const changeWallpaper = async (mode, forceRefresh = false) => {
    if (mode === wallpaperMode.value && mode !== "random" && !forceRefresh) {
      return;
    }

    wallpaperMode.value = mode;
    localStorage.setItem("preferredWallpaperMode", mode);

    try {
      let config;
      if (forceRefresh) {
        config = await forceRefreshGlobalConfig();
      } else {
        config = await fetchGlobalConfig();
      }
      await switchWallpaperImmediately(mode, config);
      logger.debug("壁纸切换完成:", mode);
    } catch (error) {
      logger.error("壁纸切换失败:", error);
    }
  };

  // 🔥 新增：手动刷新壁纸函数
  const refreshWallpaper = async () => {
    logger.info("🔄 手动刷新壁纸");

    // 清除所有缓存
    clearCache();

    // 重新初始化
    await initialize(true);

    return currentWallpaper.value;
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
    // 后端其实可以从 Token 解析 id，但传了也没事
    formData.append("userId", userStore.user.id);
    formData.append("username", userStore.user.username);

    // 🔥 获取 Token (假设存在 userStore.token 中)
    const token = userStore.token || localStorage.getItem("token");

    try {
      const res = await fetch("/api/wallpaper/user", {
        method: "POST",
        headers: {
          // ⚠️ 注意：上传文件(FormData)时，千万不要手动设置 'Content-Type'
          // 浏览器会自动设置 multipart/form-data 并加上 boundary

          // 🔥 必须带上 Token
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      // 🔥 修复点：剥离外层包装 (你的写法是对的)
      const json = await res.json();

      if (json.success) {
        // 注意这里取 json.data.url
        const newUrl = json.data.url;

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
        return json;
      } else {
        throw new Error(json.message || "上传失败");
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
  // 监听用户登录状态
  watch(
    () => useUserStore().isLoggedIn,
    (isLoggedIn) => {
      if (isLoggedIn) {
        // 用户登录：获取用户壁纸
        fetchUserWallpaper().then((customUrl) => {
          // 只有当用户有自定义壁纸且当前模式是 userCustom 时才更新
          if (customUrl && wallpaperMode.value === "userCustom") {
            currentWallpaper.value = customUrl;
          }
        });
      } else {
        // 用户登出：清除用户自定义壁纸
        userHasCustom.value = false;
        wallpaperCache.value.userCustom = "";

        // 如果当前是用户自定义模式，切换为网站默认
        if (wallpaperMode.value === "userCustom") {
          wallpaperMode.value = "website";
          localStorage.setItem("preferredWallpaperMode", "website");
          resetInitialization(); // 🔥 允许重新初始化
          initialize(); // 重新初始化壁纸
        }
      }
    },
    { immediate: false } // 🔥 正确的语法：作为 watch 的第三个参数
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

    forceRefreshGlobalConfig, // 🔥 新增
    refreshWallpaper, // 🔥 新增

    initialize,
    changeWallpaper,
    uploadUserWallpaper,
    clearCache,
    resetInitialization, // 🔥 暴露重置方法
    fetchGlobalConfig,
    fetchUserWallpaper,
  };
});
