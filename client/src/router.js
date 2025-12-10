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
      meta: {
        title: "Veritas - 首页",
        guestAccess: true, // 明确标记允许游客访问
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
        // 已登录用户不能访问登录/注册页
        preventIfLoggedIn: true,
      },
    },
    {
      path: "/register",
      component: Register,
      meta: {
        title: "Veritas - 注册",
        guestAccess: true,
        preventIfLoggedIn: true,
      },
    },
    {
      path: "/admin",
      component: Admin,
      meta: {
        title: "Veritas - 后台管理",
        requiresAuth: true,
        requiresRole: "admin", // 明确指定需要管理员角色
      },
    },
    {
      path: "/account",
      component: Account,
      meta: {
        title: "Veritas - 个人账号中心",
        requiresAuth: true, // 只需登录，不需要特定角色
      },
    },

    // ==================== 功能页面（暂时用 Home 占位）====================
    {
      path: "/travel",
      component: Home,
      meta: {
        title: "Veritas - 游记",
        guestAccess: true,
      },
    },
    {
      path: "/toolkit",
      component: Home,
      meta: {
        title: "Veritas - 百宝箱",
        guestAccess: true,
      },
    },
    {
      path: "/comments",
      component: Home,
      meta: {
        title: "Veritas - 留言",
        guestAccess: true,
      },
    },
    {
      path: "/contact",
      component: Home,
      meta: {
        title: "Veritas - 联系我",
        guestAccess: true,
      },
    },

    // ==================== 记录子菜单 ====================
    {
      path: "/records",
      component: Home,
      meta: {
        title: "Veritas - 记录",
        guestAccess: true,
      },
    },
    {
      path: "/records/life",
      component: Home,
      meta: {
        title: "Veritas - 生活倒影",
        guestAccess: true,
      },
    },
    {
      path: "/records/media",
      component: Home,
      meta: {
        title: "Veritas - 视听盛宴",
        guestAccess: true,
      },
    },
    {
      path: "/records/study",
      component: Home,
      meta: {
        title: "Veritas - 学习人生",
        guestAccess: true,
      },
    },
    {
      path: "/records/travel",
      component: Home,
      meta: {
        title: "Veritas - 海外趣事",
        guestAccess: true,
      },
    },
    {
      path: "/records/resources",
      component: Home,
      meta: {
        title: "Veritas - 爱心资源",
        guestAccess: true,
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

// ==================== 全局前置守卫 ====================
router.beforeEach((to, from, next) => {
  const userStore = useUserStore();
  const isLoggedIn = userStore.isLoggedIn;
  const userRole = userStore.user?.role;

  // 1. 设置页面标题
  if (to.meta.title) {
    document.title = to.meta.title;
  }

  // 2. 防止已登录用户访问登录/注册页
  if (to.meta.preventIfLoggedIn && isLoggedIn) {
    next("/");
    return;
  }

  // 3. 不需要权限的页面直接放行
  if (to.meta.guestAccess) {
    next();
    return;
  }

  // 4. 检查是否需要登录
  if (to.meta.requiresAuth && !isLoggedIn) {
    alert("🚫 请先登录！");
    next("/login");
    return;
  }

  // 5. 检查角色权限
  if (to.meta.requiresRole && to.meta.requiresRole !== userRole) {
    alert("🚫 权限不足，无法访问该页面！");
    next("/");
    return;
  }

  // 6. 所有检查通过，放行
  next();
});

export default router;
