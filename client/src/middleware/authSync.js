// @/middleware/authSync.js
export const createAuthSync = (userStore) => {
  let syncTimeout = null;

  return {
    // 立即同步状态
    syncImmediate() {
      const token = localStorage.getItem("token");
      const userStr = localStorage.getItem("user");

      if (token && userStr) {
        try {
          const user = JSON.parse(userStr);
          if (!userStore.user || userStore.user.username !== user.username) {
            userStore.user = user;
            userStore.token = token;
            console.log("🔄 即时同步用户状态:", user.username);
          }
        } catch (error) {
          console.error("即时同步失败:", error);
        }
      }
    },

    // 延迟同步（用于事件处理）
    syncDelayed() {
      if (syncTimeout) clearTimeout(syncTimeout);

      syncTimeout = setTimeout(() => {
        this.syncImmediate();
        syncTimeout = null;
      }, 100);
    },

    // 清除
    cleanup() {
      if (syncTimeout) {
        clearTimeout(syncTimeout);
        syncTimeout = null;
      }
    },
  };
};
