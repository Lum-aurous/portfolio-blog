// src/stores/user.js
import { ref, computed } from "vue";
import { defineStore } from "pinia";
import axios from "axios"; // 添加 axios 用于获取用户信息

export const useUserStore = defineStore("user", () => {
  const user = ref(null);
  const isLoggedIn = computed(() => !!user.value); // 改为计算属性

  const login = (userData) => {
    user.value = userData;
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("user", JSON.stringify(userData));
  };

  const logout = () => {
    user.value = null;
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("user");
  };

  // 👇 改进：更完善的更新用户数据方法
  const updateUser = (updatedData) => {
    if (user.value) {
      // 合并更新（只更新传入的字段）
      user.value = { ...user.value, ...updatedData };
      // 同步到 localStorage
      localStorage.setItem("user", JSON.stringify(user.value));
      return true;
    }
    return false;
  };

  // 👇 新增：从后端获取最新用户信息
  const refreshUserInfo = async () => {
    try {
      const currentUser = user.value;
      if (!currentUser?.username) return;

      const res = await axios.get("/api/user/profile", {
        params: { username: currentUser.username }
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
        } catch (e) {
          console.error("解析用户信息失败:", e);
          user.value = null;
        }
      }
    }
  };

  return { 
    user, 
    isLoggedIn, 
    login, 
    logout, 
    checkLoginStatus, 
    updateUser,
    refreshUserInfo // 👈 暴露新方法
  };
});