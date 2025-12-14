// src/router.js
import { createRouter, createWebHistory } from "vue-router";
import config from "@/config/index.js";
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
      meta: {
        title: "Veritas - 首页",
        guestAccess: true,
      },
    },
    {
      path: "/blog",
      component: Blog,
      meta: {
        title: "Veritas - 博客",
        guestAccess: true,
      },
    },
    {
      path: "/article/:id",
      component: ArticleDetail,
      meta: {
        title: "Veritas - 文章详情",
        guestAccess: true,
      },
    },

    // ==================== 用户系统 ====================
    {
      path: "/login",
      component: Login,
      meta: {
        title: "Veritas - 登录",
        guestAccess: true,
        preventIfLoggedIn: true,
        noAuthRequired: true,
      },
    },
    {
      path: "/register",
      component: Register,
      meta: {
        title: "Veritas - 注册",
        guestAccess: true,
        preventIfLoggedIn: true,
        noAuthRequired: true,
      },
    },
    {
      path: "/admin",
      component: Admin,
      meta: {
        title: "Veritas - 后台管理",
        requiresAuth: true,
        requiresRole: "admin",
      },
    },
    {
      path: "/account",
      component: Account,
      meta: {
        title: "Veritas - 个人账号中心",
        requiresAuth: true,
      },
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

// ==================== 全局前置守卫（JWT版） ====================
router.beforeEach(async (to, from, next) => {
  console.log(`🔄 路由跳转: ${from.path} -> ${to.path}`);

  // 1. 设置页面标题
  if (to.meta.title) {
    document.title = to.meta.title;
  }

  // 2. 检查 Token 和登录状态
  const token = localStorage.getItem("token");
  const username = localStorage.getItem("username");
  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";

  // 简单的token存在性检查，不验证有效性（由API验证）
  const hasToken = !!token && token.trim().length > 0;

  // 3. 防止已登录用户访问登录/注册页
  if (to.meta.preventIfLoggedIn && hasToken && username) {
    console.log("✅ 已登录用户，跳转到首页");
    next("/");
    return;
  }

  // 4. 不需要权限的页面直接放行
  if (to.meta.guestAccess || to.meta.noAuthRequired) {
    console.log("✅ 公开页面，直接放行");
    next();
    return;
  }

  // 5. 检查是否需要登录
  if (to.meta.requiresAuth) {
    if (!hasToken || !username) {
      console.log("🚫 需要登录才能访问:", to.path);
      // 保存当前路径，登录后可以跳转回来
      if (to.path !== "/login") {
        sessionStorage.setItem("redirectPath", to.fullPath);
      }
      next("/login");
      return;
    }

    // 检查角色权限（如果需要）
    if (to.meta.requiresRole) {
      try {
        // 从token中解码用户信息
        const userFromToken =
          config.getUserFromToken && config.getUserFromToken(token);
        if (!userFromToken || userFromToken.role !== to.meta.requiresRole) {
          console.log("🚫 权限不足，无法访问该页面！");
          alert("权限不足，无法访问该页面！");
          next("/");
          return;
        }
      } catch (error) {
        console.error("解析token失败:", error);
        next("/login");
        return;
      }
    }
  }

  // 6. 所有检查通过，放行
  console.log("✅ 路由守卫检查通过");
  next();
});

// 路由后的钩子
router.afterEach((to, from) => {
  console.log(`✅ 路由完成: ${to.path}`);

  // 清除滚动位置缓存
  if (from.meta.keepScrollPosition) {
    sessionStorage.removeItem(`scroll_${from.path}`);
  }

  // 登录成功后跳转回原来的页面
  if (to.path === "/" && from.path === "/login") {
    const redirectPath = sessionStorage.getItem("redirectPath");
    if (redirectPath && redirectPath !== "/login") {
      console.log(`🔀 登录后重定向到: ${redirectPath}`);
      sessionStorage.removeItem("redirectPath");
      // 使用setTimeout避免循环
      setTimeout(() => {
        router.push(redirectPath);
      }, 100);
    }
  }
});

export default router;
