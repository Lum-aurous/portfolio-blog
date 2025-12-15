// @/utils/debug.js
export const debugAuthState = () => {
  console.group("🔍 认证状态调试");

  console.log("1. LocalStorage 状态:");
  console.log("   token:", localStorage.getItem("token") ? "✓" : "✗");
  console.log("   user:", localStorage.getItem("user") ? "✓" : "✗");
  console.log("   username:", localStorage.getItem("username") || "无");
  console.log("   isLoggedIn:", localStorage.getItem("isLoggedIn") || "false");

  console.log("2. Store 状态（如果已初始化）:");
  try {
    const store = JSON.parse(localStorage.getItem("pinia") || "{}");
    const userStore = store.user || {};
    console.log("   user:", userStore.user ? "✓" : "✗");
    console.log("   token:", userStore.token ? "✓" : "✗");
  } catch (e) {
    console.log("   无法获取 store 状态");
  }

  console.groupEnd();
};

// 在控制台使用：debugAuthState()
