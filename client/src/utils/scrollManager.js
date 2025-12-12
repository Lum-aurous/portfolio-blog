// utils/scrollManager.js
class ScrollManager {
  constructor() {
    this.homePagePath = "/";
    this.scrollPositions = new Map();
  }

  // 全局启用滚动
  enableGlobalScroll() {
    // 恢复html和body的正常滚动
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
    document.documentElement.style.height = "";
    document.body.style.height = "";

    // 移除no-scroll类
    document.documentElement.classList.remove("no-scroll");
    document.body.classList.remove("no-scroll");

    console.log("🔓 全局滚动已启用");
  }

  // 全局禁用滚动
  disableGlobalScroll() {
    // 保存当前滚动位置
    this.saveScrollPosition();

    // 禁用滚动
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.documentElement.style.height = "100vh";
    document.body.style.height = "100vh";

    // 添加no-scroll类
    document.documentElement.classList.add("no-scroll");
    document.body.classList.add("no-scroll");

    console.log("🔒 全局滚动已禁用");
  }

  // 保存当前页面的滚动位置
  saveScrollPosition() {
    const path = window.location.pathname;
    const position = {
      x: window.scrollX,
      y: window.scrollY,
      time: Date.now(),
    };
    this.scrollPositions.set(path, position);
  }

  // 恢复页面的滚动位置
  restoreScrollPosition(path) {
    const position = this.scrollPositions.get(path);
    if (position && Date.now() - position.time < 30000) {
      // 30秒内有效
      window.scrollTo(position.x, position.y);
    }
  }

  // 根据路由自动管理滚动
  handleRouteChange(to, from) {
    console.log(`🔄 路由变化: ${from?.path} -> ${to.path}`);

    if (to.path === this.homePagePath) {
      // 如果是首页，禁用滚动
      this.disableGlobalScroll();
    } else {
      // 其他页面，启用滚动
      this.enableGlobalScroll();

      // 恢复之前的位置（如果存在）
      setTimeout(() => {
        this.restoreScrollPosition(to.path);
      }, 50);
    }
  }

  // 初始化
  init(router) {
    // 监听路由变化
    router.afterEach((to, from) => {
      this.handleRouteChange(to, from);
    });

    // 初始状态：根据当前路由设置滚动
    const currentPath = router.currentRoute.value.path;
    this.handleRouteChange({ path: currentPath }, null);

    console.log("✅ 滚动管理器已初始化");
  }
}

// 单例模式导出
const scrollManager = new ScrollManager();
export default scrollManager;
