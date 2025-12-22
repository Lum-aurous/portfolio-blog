// src/router.js
import { createRouter, createWebHistory } from "vue-router";
import { useUserStore } from "@/stores/user.js"; // 引入 Pinia Store
import { message } from "@/utils/message.js"; // 引入消息提示

// 前台组件
import Home from "./views/Home.vue";
import Blog from "./views/Blog.vue";
import ArticleDetail from "./views/ArticleDetail.vue";
import Login from "./views/Login.vue";
import Register from "./views/Register.vue";
import Profile from "./views/Profile.vue";
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
    {
      path: "/column/:id",
      name: "ColumnDetail",
      component: () => import("@/views/ColumnDetail.vue"), // 稍后创建这个文件
      props: true, // 开启 props 传参，让组件直接接收 id
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
      path: "/profile/:username",
      name: "Profile",
      component: Profile,
      meta: {
        title: "个人主页",
        guestAccess: true, // 允许游客查看他人的主页
      },
    },
    {
      path: "/account",
      component: Account,
      meta: {
        title: "Veritas - 个人中心",
        requiresAuth: true,
      },
    },
    {
      path: "/copyright",
      name: "Copyright",
      // 建议使用异步加载，优化性能
      component: () => import("@/views/CopyrightDetail.vue"),
      meta: { title: "版权声明 - Veritas", guestAccess: true },
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
        {
          path: "copyright",
          name: "AdminCopyright",
          component: () => import("@/views/admin/CopyrightManage.vue"),
          meta: { title: "后台 - 版权管理", requiresRole: "admin" },
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

// ==================== 🛡️ 全局前置守卫 ====================
router.beforeEach(async (to, from, next) => {
  console.log(`🔄 路由跳转: ${from.path} -> ${to.path}`);

  // 1. 设置标题
  if (to.meta.title) {
    document.title = to.meta.title;
  }

  // 2. 获取 Store 和 Token
  const userStore = useUserStore();
  const token = localStorage.getItem("token");

  // 【关键优化】如果 Store 里没用户但有 Token，必须等待恢复状态
  // 在 cpolar 穿透环境下，网络较慢，这一步的 await 至关重要
  if (token && !userStore.user) {
    try {
      await userStore.checkLoginStatus();
    } catch (e) {
      console.error("恢复登录状态失败", e);
      // 如果 Token 失效，清理并去登录页（可选）
    }
  }

  const isLoggedIn = !!token;
  const isSwitchingAccount =
    sessionStorage.getItem("isSwitchingAccount") === "true";

  // 3. 防止已登录用户访问登录/注册页
  if (to.meta.preventIfLoggedIn && isLoggedIn) {
    if (isSwitchingAccount && to.path === "/login") return next();
    message.info("您已登录，无需重复操作");
    return next("/");
  }

  // 4. 不需要权限的页面直接放行
  if (to.meta.guestAccess) {
    return next();
  }

  // 5. 检查是否需要登录
  if (to.meta.requiresAuth) {
    if (!isLoggedIn) {
      message.warning("请先登录");
      if (to.path !== "/login")
        sessionStorage.setItem("redirectPath", to.fullPath);
      return next("/login");
    }

    // 6. 【核心修正】正确检查角色权限
    if (to.meta.requiresRole) {
      // 👈 这里改为从 userStore.user 获取真正的角色
      const currentUserRole = userStore.user?.role;

      if (currentUserRole !== to.meta.requiresRole) {
        console.warn(
          `🚫 权限不足: 需要 ${to.meta.requiresRole}, 当前 ${currentUserRole}`
        );
        message.error("您没有管理员权限，无法访问后台！");
        return next("/"); // 拦截并踢回首页
      }
    }
  }

  // 7. 顺利通过
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
