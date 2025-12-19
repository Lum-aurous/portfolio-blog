// src/router.js
import { createRouter, createWebHistory } from "vue-router";
import { useUserStore } from "@/stores/user.js"; // 引入 Pinia Store
import { message } from "@/utils/message.js"; // 引入消息提示
import config from "@/config/index.js";

// 前台组件
import Home from "./views/Home.vue";
import Blog from "./views/Blog.vue";
import ArticleDetail from "./views/ArticleDetail.vue";
import Login from "./views/Login.vue";
import Register from "./views/Register.vue";
import Account from "./views/Account.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    // ==================== 核心页面 (前台) ====================
    {
      path: "/",
      component: Home,
      meta: { title: "Veritas - 首页", guestAccess: true },
    },
    {
      path: "/blog",
      component: Blog,
      meta: { title: "Veritas - 博客", guestAccess: true },
    },
    {
      path: "/article/:id",
      component: ArticleDetail,
      meta: { title: "Veritas - 文章详情", guestAccess: true },
    },

    // ==================== 用户系统 ====================
    {
      path: "/login",
      component: Login,
      meta: {
        title: "Veritas - 登录",
        guestAccess: true,
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
      path: "/account",
      component: Account,
      meta: {
        title: "Veritas - 个人账号中心",
        requiresAuth: true,
      },
    },

    // ==================== 🔥 后台管理系统 (Admin) ====================
    {
      path: "/admin",
      // 动态引入 Layout，实现懒加载
      component: () => import("@/views/admin/AdminLayout.vue"),
      meta: {
        title: "Veritas - 后台管理",
        requiresAuth: true,
        requiresRole: "admin", // 🔥 必须是管理员
      },
      children: [
        {
          path: "", // 访问 /admin 自动跳到 dashboard
          redirect: "/admin/dashboard",
        },
        {
          path: "dashboard",
          name: "AdminDashboard",
          component: () => import("@/views/admin/Dashboard.vue"),
          meta: { title: "后台 - 仪表盘" },
        },
        {
          path: "publish",
          name: "AdminPublish",
          // 这里指向我们刚刚重构的 ArticlePublish.vue
          component: () => import("@/views/admin/ArticlePublish.vue"),
          meta: { title: "后台 - 发布文章" },
        },
        {
          path: "articles",
          name: "AdminArticles",
          component: () => import("@/views/admin/ArticleList.vue"), // 🔥 新建的文件
          meta: { title: "后台 - 文章管理" },
        },
        {
          path: "comments", // 对应 /admin/comments
          name: "AdminComments",
          component: () => import("@/views/admin/CommentList.vue"), // 🔥
          meta: { title: "后台 - 评论管理", requiresRole: "admin" },
        },
        {
          path: "users", // 对应 /admin/users
          name: "AdminUsers",
          component: () => import("@/views/admin/UserList.vue"), // 🔥
          meta: { title: "后台 - 用户管理", requiresRole: "admin" },
        },
        {
          path: "notices",
          name: "AdminNotices",
          component: () => import("@/views/admin/NoticeList.vue"),
          meta: { title: "后台 - 公告管理", requiresRole: "admin" },
        },
        {
          path: "friends",
          name: "AdminFriendLink",
          component: () => import("@/views/admin/FriendLinkList.vue"),
          meta: { title: "后台 - 友链管理", requiresRole: "admin" },
        },
        {
          path: "wallpapers",
          name: "AdminWallpapers",
          component: () => import("@/views/admin/WallpaperManage.vue"),
          meta: { title: "后台 - 壁纸管理", requiresRole: "admin" },
        },
        // 未来可以继续添加：
        // { path: 'articles', component: ... },
        // { path: 'comments', component: ... },
      ],
    },

    // ==================== 404 页面 ====================
    {
      path: "/:pathMatch(.*)*",
      redirect: "/", // 或者跳转到一个专门的 NotFound 组件
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

// ==================== 🛡️ 全局前置守卫 (升级版) ====================
router.beforeEach(async (to, from, next) => {
  console.log(`🔄 路由跳转: ${from.path} -> ${to.path}`);

  // 1. 设置标题
  if (to.meta.title) {
    document.title = to.meta.title;
  }

  // 2. 获取用户状态 (使用 Pinia 更准确)
  const userStore = useUserStore();
  const token = localStorage.getItem("token");

  // 如果有 token 但 store 里没用户，尝试恢复一下 (防止刷新丢失)
  if (token && !userStore.user) {
    try {
      await userStore.checkLoginStatus();
    } catch (e) {
      console.error("恢复登录状态失败", e);
    }
  }

  const isLoggedIn = !!token;
  const userRole = userStore.user?.role;

  // 3. 防止已登录用户访问登录/注册页
  if (to.meta.preventIfLoggedIn && isLoggedIn) {
    message.info("您已登录，无需重复操作");
    return next("/");
  }

  // 4. 不需要权限的页面直接放行
  if (to.meta.guestAccess) {
    return next();
  }

  // 5. 检查是否需要登录 (requiresAuth)
  if (to.meta.requiresAuth) {
    if (!isLoggedIn) {
      message.warning("请先登录");
      // 保存当前路径，登录后跳转回来
      if (to.path !== "/login") {
        sessionStorage.setItem("redirectPath", to.fullPath);
      }
      return next("/login");
    }

    // 6. 检查角色权限 (requiresRole) -> 比如后台管理
    if (to.meta.requiresRole) {
      if (userRole !== to.meta.requiresRole) {
        console.warn(
          `🚫 权限不足: 需要 ${to.meta.requiresRole}, 当前 ${userRole}`
        );
        message.error("您没有权限访问此区域！");
        return next("/"); // 踢回首页
      }
    }
  }

  // 7. 通行
  next();
});

// ==================== 路由后置钩子 ====================
router.afterEach((to, from) => {
  // 登录后的重定向逻辑
  if (from.path === "/login" && to.path === "/") {
    const redirectPath = sessionStorage.getItem("redirectPath");
    if (redirectPath && redirectPath !== "/login") {
      sessionStorage.removeItem("redirectPath");
      setTimeout(() => {
        router.push(redirectPath);
      }, 100);
    }
  }
});

export default router;
