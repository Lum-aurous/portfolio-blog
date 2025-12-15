// @/utils/api.js
import axios from "axios";
import { message } from "./message.js";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api",
  timeout: 10000,
  withCredentials: true, // 确保发送凭据
  headers: {
    "Content-Type": "application/json",
  },
});

// 请求拦截器：自动添加 Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    if (response.data && response.data.success === false) {
      // 处理业务逻辑错误
      message.error(response.data.message || "请求失败");
      return Promise.reject(new Error(response.data.message));
    }
    return response;
  },
  (error) => {
    if (error.response) {
      switch (error.response.status) {
        case 401:
          message.error("登录已过期，请重新登录");
          // 清除用户状态
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          window.location.href = "/login";
          break;
        case 403:
          message.error("权限不足或令牌失效");
          break;
        default:
          message.error(error.response.data?.message || "请求失败");
      }
    } else {
      message.error("网络错误或服务器无响应");
    }
    return Promise.reject(error);
  }
);

export { api };
