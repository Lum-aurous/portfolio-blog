// src/utils/auth.js
import config from "@/config/index.js";
import { message } from "@/utils/message.js";

/**
 * JWT 认证工具类
 */
export class AuthManager {
  // 检查登录状态
  static checkAuthStatus() {
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");
    const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";

    // 验证 token
    const isTokenValid = token ? config.validateToken(token) : false;

    return {
      token,
      username,
      isLoggedIn,
      isTokenValid,
      user: token ? config.getUserFromToken(token) : null,
    };
  }

  // 登录
  static login(userData, token) {
    localStorage.setItem("token", token);
    localStorage.setItem("username", userData.username);
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("isLoggedIn", "true");

    console.log("✅ 用户登录成功:", userData.username);
    return true;
  }

  // 登出
  static logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("user");
    localStorage.removeItem("isLoggedIn");
    console.log("🚪 用户已登出");
    return true;
  }

  // 刷新 token（如果有刷新接口）
  static async refreshToken() {
    const token = localStorage.getItem("token");
    if (!token) return null;

    try {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.token) {
          localStorage.setItem("token", data.data.token);
          console.log("🔄 Token 刷新成功");
          return data.data.token;
        }
      }
    } catch (error) {
      console.error("刷新 token 失败:", error);
    }
    return null;
  }

  // 获取认证头
  static getAuthHeader() {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  // 定期检查 token 有效性
  static startTokenMonitor(callback) {
    const interval = config.get("jwt.refreshInterval") || 300000;

    const monitor = setInterval(() => {
      const authStatus = this.checkAuthStatus();

      if (authStatus.isLoggedIn && !authStatus.isTokenValid) {
        console.log("⚠️ Token 已过期，自动登出");
        message.warning("登录状态已过期，请重新登录");
        this.logout();
        if (callback) callback("expired");
      } else if (
        authStatus.isLoggedIn &&
        config.shouldRefreshToken(authStatus.token)
      ) {
        console.log("🔄 Token 即将过期，尝试刷新");
        this.refreshToken().then((newToken) => {
          if (!newToken) {
            console.log("刷新失败，保持现有 token");
          }
        });
      }
    }, interval);

    return monitor;
  }

  // 停止监控
  static stopTokenMonitor(monitorId) {
    if (monitorId) {
      clearInterval(monitorId);
    }
  }

  // 验证表单输入
  static validateRegisterForm(account, password, confirmPassword) {
    if (!account || !password) {
      return { valid: false, message: "请填写完整信息" };
    }

    // 手机号验证
    const isPhone = /^1[3-9]\d{9}$/.test(account);
    // 邮箱验证
    const isEmail = /^\S+@\S+\.\S+$/.test(account);

    if (!isPhone && !isEmail) {
      return { valid: false, message: "格式不正确，请输入有效的手机号或邮箱" };
    }

    if (password.length < 6) {
      return { valid: false, message: "密码长度至少需要6位" };
    }

    if (confirmPassword !== undefined && password !== confirmPassword) {
      return { valid: false, message: "两次输入的密码不一致" };
    }

    return { valid: true };
  }
}

export default AuthManager;
