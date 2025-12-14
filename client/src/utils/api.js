// src/utils/api.js
import axios from "axios";
import { message } from "./message.js";
import { useUserStore } from "@/stores/user.js";

// 创建 axios 实例
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    // 获取 token
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // 添加时间戳避免缓存
    if (config.method === "get") {
      config.params = {
        ...config.params,
        _t: Date.now(),
      };
    }

    // 调试日志
    if (import.meta.env.DEV) {
      console.log(
        `📡 ${config.method.toUpperCase()} ${config.url}`,
        config.params || config.data
      );
    }

    return config;
  },
  (error) => {
    console.error("❌ 请求配置错误:", error);
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    // 成功的响应
    if (import.meta.env.DEV) {
      console.log(`✅ ${response.status} ${response.config.url}`);
    }
    return response;
  },
  async (error) => {
    if (!error.response) {
      // 网络错误或无响应
      console.error("❌ 网络错误:", error.message);
      message.error("网络连接失败，请检查网络");
      return Promise.reject(error);
    }

    const { status, data } = error.response;
    const url = error.config?.url || "unknown";

    console.error(`❌ ${status} ${url}:`, data?.message || error.message);

    // 处理特定状态码
    switch (status) {
      case 400:
        // 验证错误，不显示通用消息，由调用方处理具体错误
        break;
      case 401:
        // Token 过期或无效
        message.warning("登录已过期，请重新登录");

        // 清除本地存储
        localStorage.removeItem("token");
        localStorage.removeItem("username");
        localStorage.removeItem("isLoggedIn");

        // 跳转到登录页
        if (window.location.pathname !== "/login") {
          setTimeout(() => {
            window.location.href = "/login";
          }, 1500);
        }
        break;
      case 403:
        message.error("权限不足，无法访问");
        break;
      case 404:
        message.error("请求的资源不存在");
        break;
      case 429:
        message.error("请求过于频繁，请稍后重试");
        break;
      case 500:
        message.error("服务器内部错误，请稍后重试");
        break;
      case 502:
      case 503:
      case 504:
        message.error("服务器暂时不可用，请稍后重试");
        break;
      default:
        if (data?.message) {
          message.error(data.message);
        } else {
          message.error(`请求失败 (${status})`);
        }
    }

    return Promise.reject(error);
  }
);

export { api };
