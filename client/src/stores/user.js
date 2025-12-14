// src/stores/user.js
import { ref, computed } from "vue";
import { defineStore } from "pinia";
import axios from "axios";

export const useUserStore = defineStore("user", () => {
  const user = ref(null);
  const token = ref(localStorage.getItem("token") || ""); // 新增：JWT token
  const location = ref(null); // 地理位置信息
  const isLoadingLocation = ref(false); // 加载状态

  const isLoggedIn = computed(() => !!user.value && !!token.value);

  // 修改：现在接收 token 和 userData
  const login = (userData, userToken) => {
    user.value = userData;
    token.value = userToken;

    // 存储到 localStorage
    localStorage.setItem("token", userToken);
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("username", userData.username);
    localStorage.setItem("isLoggedIn", "true");

    console.log("✅ 用户登录成功:", userData.username);

    // 登录成功后自动获取地理位置
    getLocation();
  };

  const logout = () => {
    user.value = null;
    token.value = "";
    location.value = null; // 清除地理位置

    // 清除所有存储
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("username");
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("userLocation");

    console.log("🚪 用户已登出");
  };

  // 修改：现在也更新 token（如果需要的话）
  const updateUser = (updatedData) => {
    if (user.value) {
      user.value = { ...user.value, ...updatedData };
      localStorage.setItem("user", JSON.stringify(user.value));

      // 如果用户名有更新，也更新 localStorage
      if (updatedData.username) {
        localStorage.setItem("username", updatedData.username);
      }

      return true;
    }
    return false;
  };

  // 设置 token（主要用于外部设置）
  const setToken = (newToken) => {
    token.value = newToken;
    localStorage.setItem("token", newToken);
  };

  // 刷新用户信息（从后端获取最新）
  const refreshUserInfo = async () => {
    try {
      const currentUsername =
        user.value?.username || localStorage.getItem("username");

      if (!currentUsername) {
        console.warn("无法刷新用户信息：没有用户名");
        return null;
      }

      const res = await axios.get("/api/user/profile", {
        params: { username: currentUsername },
      });

      if (res.data.success && res.data.data) {
        const userData = res.data.data;
        user.value = userData;
        localStorage.setItem("user", JSON.stringify(userData));
        localStorage.setItem("username", userData.username);
        console.log("✅ 用户信息刷新成功:", userData.username);
        return userData;
      }
    } catch (error) {
      console.error("刷新用户信息失败:", error);

      // 如果 token 过期，自动登出
      if (error.response && error.response.status === 401) {
        console.warn("Token 过期，自动登出");
        logout();
      }
    }
    return null;
  };

  // 检查登录状态（从 localStorage 恢复）
  const checkLoginStatus = () => {
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");
    const loggedIn = localStorage.getItem("isLoggedIn") === "true";

    if (loggedIn && storedToken && storedUser) {
      try {
        user.value = JSON.parse(storedUser);
        token.value = storedToken;
        console.log("✅ 登录状态已恢复:", user.value?.username);

        // 恢复地理位置
        const storedLocation = localStorage.getItem("userLocation");
        if (storedLocation) {
          try {
            location.value = JSON.parse(storedLocation);
          } catch (e) {
            console.warn("解析缓存位置失败:", e);
          }
        }
      } catch (e) {
        console.error("解析用户信息失败:", e);
        logout(); // 解析失败，清除所有状态
      }
    } else {
      // 如果 token 存在但没有用户数据，尝试用 token 获取用户信息
      if (storedToken && !storedUser) {
        restoreUserFromToken(storedToken);
      }
    }
  };

  // 从 token 恢复用户信息
  const restoreUserFromToken = async (tokenToRestore) => {
    try {
      // 解码 JWT token 获取用户信息
      const payload = JSON.parse(atob(tokenToRestore.split(".")[1]));
      const username = payload.username;

      if (username) {
        const res = await axios.get("/api/user/profile", {
          params: { username: username },
        });

        if (res.data.success && res.data.data) {
          const userData = res.data.data;
          login(userData, tokenToRestore);
          console.log("✅ 从 token 恢复用户成功:", userData.username);
        }
      }
    } catch (error) {
      console.error("从 token 恢复用户失败:", error);

      // 如果 token 无效，清除
      if (error.response && error.response.status === 401) {
        console.warn("Token 无效，清除存储");
        logout();
      }
    }
  };

  // ==================== 地理位置相关方法（保持不变） ====================

  // 获取地理位置
  async function getLocation() {
    if (location.value || isLoadingLocation.value) return;

    isLoadingLocation.value = true;

    try {
      // 检查是否已有缓存
      const cachedLocation = localStorage.getItem("userLocation");
      if (cachedLocation) {
        location.value = JSON.parse(cachedLocation);
        isLoadingLocation.value = false;
        return;
      }

      // 首先尝试IP定位（不需要用户授权）
      const ipLocation = await getLocationByIP();
      if (ipLocation) {
        location.value = ipLocation;
        localStorage.setItem("userLocation", JSON.stringify(ipLocation));
        isLoadingLocation.value = false;
        return;
      }

      // IP定位失败，设置默认值
      location.value = {
        country: "中国",
        region: "未知",
        city: "未知",
        text: "位置获取失败，点击刷新",
      };
    } catch (error) {
      console.warn("获取地理位置失败:", error);
      location.value = {
        country: "中国",
        region: "未知",
        city: "未知",
        text: "位置获取失败，点击刷新",
      };
    } finally {
      isLoadingLocation.value = false;
    }
  }

  // 通过IP获取位置（免费服务）
  async function getLocationByIP() {
    try {
      // 方法1：使用ipapi.co（每月1000次免费请求）
      const response1 = await fetch("https://ipapi.co/json/");
      if (response1.ok) {
        const data = await response1.json();
        if (data.country_name) {
          return {
            country: data.country_name || "中国",
            region: data.region || data.region_code || "未知省份",
            city: data.city || "未知城市",
            latitude: data.latitude,
            longitude: data.longitude,
            ip: data.ip,
            text: `${data.city || "未知城市"}, ${data.region || "未知省份"}, ${
              data.country_name || "中国"
            }`,
            source: "ipapi",
          };
        }
      }

      // 方法2：使用ip-api.com（备用）
      const response2 = await fetch("http://ip-api.com/json/?lang=zh-CN");
      if (response2.ok) {
        const data = await response2.json();
        if (data.status === "success") {
          return {
            country: data.country || "中国",
            region: data.regionName || "未知省份",
            city: data.city || "未知城市",
            latitude: data.lat,
            longitude: data.lon,
            ip: data.query,
            text: `${data.city || "未知城市"}, ${
              data.regionName || "未知省份"
            }, ${data.country || "中国"}`,
            source: "ip-api",
          };
        }
      }

      // 方法3：使用本地服务（如果有）
      try {
        const response3 = await fetch("/api/user/location");
        if (response3.ok) {
          const data = await response3.json();
          if (data.country || data.city) {
            return {
              country: data.country || "中国",
              region: data.region || data.province || "未知省份",
              city: data.city || "未知城市",
              text: `${data.city || "未知城市"}, ${
                data.region || data.province || "未知省份"
              }, ${data.country || "中国"}`,
              source: "local-api",
            };
          }
        }
      } catch (localError) {
        console.log("本地位置API不可用:", localError);
      }

      throw new Error("所有IP定位服务都失败");
    } catch (error) {
      console.warn("IP定位失败:", error);
      throw error;
    }
  }

  // 刷新位置（强制重新获取）
  async function refreshLocation() {
    // 清除缓存
    localStorage.removeItem("userLocation");
    location.value = null;

    // 重新获取
    return getLocation();
  }

  // 更新位置信息（用于手动设置）
  function updateLocation(newLocation) {
    location.value = newLocation;
    localStorage.setItem("userLocation", JSON.stringify(newLocation));
  }

  // 清除位置信息
  function clearLocation() {
    location.value = null;
    localStorage.removeItem("userLocation");
  }

  return {
    user,
    token, // 新增
    location,
    isLoadingLocation,
    isLoggedIn,
    login,
    logout,
    checkLoginStatus,
    updateUser,
    setToken, // 新增
    refreshUserInfo,
    getLocation,
    refreshLocation,
    updateLocation,
    clearLocation,
  };
});
