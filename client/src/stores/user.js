// src/stores/user.js
import { ref, computed } from "vue";
import { defineStore } from "pinia";
import axios from "axios";

export const useUserStore = defineStore("user", () => {
  const user = ref(null);
  const location = ref(null); // 新增：地理位置信息
  const isLoadingLocation = ref(false); // 新增：加载状态

  const isLoggedIn = computed(() => !!user.value);

  const login = (userData) => {
    user.value = userData;
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("user", JSON.stringify(userData));

    // 登录成功后自动获取地理位置
    if (userData) {
      getLocation();
    }
  };

  const logout = () => {
    user.value = null;
    location.value = null; // 清除地理位置
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("user");
    localStorage.removeItem("userLocation"); // 清除缓存的位置
  };

  const updateUser = (updatedData) => {
    if (user.value) {
      user.value = { ...user.value, ...updatedData };
      localStorage.setItem("user", JSON.stringify(user.value));
      return true;
    }
    return false;
  };

  const refreshUserInfo = async () => {
    try {
      const currentUser = user.value;
      if (!currentUser?.username) return;

      const res = await axios.get("/api/user/profile", {
        params: { username: currentUser.username },
      });

      if (res.data.success) {
        user.value = res.data.user;
        localStorage.setItem("user", JSON.stringify(res.data.user));
        return res.data.user;
      }
    } catch (error) {
      console.error("刷新用户信息失败:", error);
    }
    return null;
  };

  // 检查登录状态
  const checkLoginStatus = () => {
    const loggedIn = localStorage.getItem("isLoggedIn");
    if (loggedIn === "true") {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        try {
          user.value = JSON.parse(storedUser);
          console.log("✅ 登录状态已恢复:", user.value.username);

          // 恢复登录状态时也恢复地理位置
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
          user.value = null;
        }
      }
    }
  };

  // ==================== 新增：地理位置相关方法 ====================

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
    location, // 新增
    isLoadingLocation, // 新增
    isLoggedIn,
    login,
    logout,
    checkLoginStatus,
    updateUser,
    refreshUserInfo,
    getLocation, // 新增
    refreshLocation, // 新增
    updateLocation, // 新增
    clearLocation, // 新增
  };
});
