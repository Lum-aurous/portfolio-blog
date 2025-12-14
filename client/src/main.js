// src/main.js
import { createApp } from "vue";
import { createPinia } from "pinia";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";
import App from "./App.vue";
import router from "./router.js";
import scrollManager from "@/utils/scrollManager.js";
import AuthManager from "@/utils/auth.js";
import config from "@/config/index.js";
import "./style.css";
import { ErrorHandler } from "@/utils/error-handler.js";

// 初始化错误处理器
ErrorHandler.init();

// ==================== 处理浏览器扩展错误 ====================
if (typeof window !== "undefined") {
  // 监听全局错误
  const originalErrorHandler = window.onerror;
  window.onerror = function (message, source, lineno, colno, error) {
    // 过滤掉广告拦截扩展的错误
    if (
      typeof message === "string" &&
      (message.includes("adblock360") ||
        message.includes("filtering.adblock360.com") ||
        message.includes("CORS policy") ||
        (message.includes("Failed to fetch") &&
          source &&
          source.includes("adblock")))
    ) {
      console.log("🔕 忽略扩展相关错误:", message);
      return true; // 阻止错误冒泡
    }

    // 调用原来的错误处理器
    if (originalErrorHandler) {
      return originalErrorHandler(message, source, lineno, colno, error);
    }
    return false;
  };

  // 监听未处理的Promise拒绝
  const originalRejectionHandler = window.onunhandledrejection;
  window.onunhandledrejection = function (event) {
    if (
      event.reason &&
      (event.reason.message?.includes("adblock360") ||
        event.reason.message?.includes("Failed to fetch"))
    ) {
      console.log("🔕 忽略Promise中的扩展相关错误");
      event.preventDefault();
      return;
    }

    if (originalRejectionHandler) {
      return originalRejectionHandler(event);
    }
  };
}

const app = createApp(App);
const pinia = createPinia();

pinia.use(piniaPluginPersistedstate);

app.use(pinia);
app.use(router);

// 全局挂载配置
app.config.globalProperties.$config = config;

// 初始化环境配置
if (config.isDev) {
  console.group("🌍 环境配置");
  console.table(config);
  console.groupEnd();
}

// 初始化滚动管理器
scrollManager.init(router);

// 启动 token 监控
let tokenMonitor = null;
if (typeof window !== "undefined") {
  // 延迟启动监控，确保应用已加载
  setTimeout(() => {
    tokenMonitor = AuthManager.startTokenMonitor((reason) => {
      if (reason === "expired") {
        console.log("Token 过期，需要重新登录");
      }
    });
  }, 3000);
}

// Vue 错误处理配置
app.config.errorHandler = (err, instance, info) => {
  console.error("Vue 错误详情:", {
    error: err,
    component: instance?.$options?.name || "Unknown",
    info: info,
    stack: err.stack,
  });

  // 忽略已知错误类型
  const ignorableErrors = [
    "Cannot read properties of undefined",
    "path attribute d",
    "Failed to fetch",
    "adblock360",
    "CORS policy",
  ];

  if (
    err.message &&
    ignorableErrors.some((pattern) => err.message.includes(pattern))
  ) {
    console.warn("忽略已知错误:", err.message);
    return;
  }

  // 显示用户友好的错误提示（可选）
  if (config.isDev && !err.message.includes("adblock")) {
    // 在开发模式下显示错误弹窗
    const errorMsg = err.message || "未知错误";
    if (typeof window !== "undefined" && window.alert) {
      setTimeout(() => {
        alert(`应用程序错误: ${errorMsg}\n\n查看控制台获取详细信息。`);
      }, 100);
    }
  }
};

// 性能警告处理
app.config.warnHandler = (msg, vm, trace) => {
  console.warn("Vue 警告:", { message: msg, trace });

  // 忽略特定警告
  if (msg.includes("component is rendering non-reactive")) {
    return;
  }
};

// 挂载应用
try {
  app.mount("#app");
  console.log("✅ 应用挂载成功");
} catch (mountError) {
  console.error("❌ 应用挂载失败:", mountError);

  // 尝试恢复
  if (typeof window !== "undefined") {
    const appDiv = document.getElementById("app");
    if (appDiv) {
      appDiv.innerHTML = `
        <div style="padding: 20px; color: white; text-align: center;">
          <h2>😕 应用启动失败</h2>
          <p>请尝试以下步骤：</p>
          <ol style="text-align: left; display: inline-block;">
            <li>刷新页面</li>
            <li>清除浏览器缓存</li>
            <li>禁用广告拦截扩展</li>
            <li>检查控制台错误</li>
          </ol>
          <button onclick="window.location.reload()" style="margin-top: 20px; padding: 10px 20px;">
            刷新页面
          </button>
        </div>
      `;
    }
  }
}

// 应用卸载时清理
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    if (tokenMonitor) {
      AuthManager.stopTokenMonitor(tokenMonitor);
    }
  });
}

// 开发环境热重载错误处理
if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose(() => {
    console.log("🔄 热重载中...");
  });
}
