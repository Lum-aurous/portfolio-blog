import { createRouter, createWebHistory } from "vue-router";
import { useUserStore } from "@/stores/user.js"; // ⚡️ 导入 Store
import Home from "./views/Home.vue";
import Blog from "./views/Blog.vue";
import ArticleDetail from "./views/ArticleDetail.vue";
import Admin from "./views/Admin.vue";
import Login from "./views/Login.vue";
import Register from "./views/Register.vue";
import Account from "./views/Account.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    // ==================== 核心页面 ====================
    {
      path: "/",
      component: Home,
      meta: { title: "Veritas - 首页" },
    },
    {
      path: "/blog",
      component: Blog,
      meta: { title: "Veritas - 博客" },
    },
    {
      path: "/article/:id",
      component: ArticleDetail,
      meta: { title: "Veritas - 文章详情" },
    },

    // ==================== 用户系统 ====================
    {
      path: "/login",
      component: Login,
      meta: { title: "Veritas - 登录" },
    },
    {
      path: "/register",
      component: Register,
      meta: { title: "Veritas - 注册" },
    },
    {
      path: "/admin",
      component: Admin,
      meta: {
        requiresAuth: true,
        title: "Veritas - 后台管理",
      },
    },
    {
      path: "/account",
      component: Account,
      meta: {
        requiresAuth: true,
        title: "Veritas - 个人账号中心",
      },
    },

    // ==================== 功能页面（暂时用 Home 占位）====================
    {
      path: "/travel",
      component: Home,
      meta: { title: "Veritas - 游记" },
    },
    {
      path: "/toolkit",
      component: Home,
      meta: { title: "Veritas - 百宝箱" },
    },
    {
      path: "/comments",
      component: Home,
      meta: { title: "Veritas - 留言" },
    },
    {
      path: "/contact",
      component: Home,
      meta: { title: "Veritas - 联系我" },
    },

    // ==================== 记录子菜单 ====================
    {
      path: "/records",
      component: Home,
      meta: { title: "Veritas - 记录" },
    },
    {
      path: "/records/life",
      component: Home,
      meta: { title: "Veritas - 生活倒影" },
    },
    {
      path: "/records/media",
      component: Home,
      meta: { title: "Veritas - 视听盛宴" },
    },
    {
      path: "/records/study",
      component: Home,
      meta: { title: "Veritas - 学习人生" },
    },
    {
      path: "/records/travel",
      component: Home,
      meta: { title: "Veritas - 海外趣事" },
    },
    {
      path: "/records/resources",
      component: Home,
      meta: { title: "Veritas - 爱心资源" },
    },

    // ==================== 404 页面 ====================
    {
      path: "/:pathMatch(.*)*",
      redirect: "/",
    },
  ],

  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition;
    } else {
      return { top: 0, behavior: "smooth" };
    }
  },
});

// ==================== 全局前置守卫 ====================
router.beforeEach((to, from, next) => {
  // 1. 更新页面标题
  if (to.meta.title) {
    document.title = to.meta.title;
  }

  // 2. 权限验证（仅后台需要）
  if (to.meta.requiresAuth) {
    // ⚡️ 关键修复：改用 Pinia 检查登录状态
    const userStore = useUserStore();

    // 检查是否登录且是管理员
    if (userStore.isLoggedIn && userStore.user?.role === "admin") {
      next(); // 管理员放行
    } else if (userStore.isLoggedIn && userStore.user?.role !== "admin") {
      // 已登录但不是管理员
      alert("🚫 只有管理员才能进入后台！");
      next("/"); // 跳转首页
    } else {
      // 未登录
      alert("🚫 请先登录！");
      next("/login"); // 跳转登录页
    }
  } else {
    next(); // 无需验证的页面直接放行
  }
});

export default router;
