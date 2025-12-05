import { createRouter, createWebHistory } from 'vue-router'
import Home from './views/Home.vue'
import ArticleDetail from './views/ArticleDetail.vue'
import Admin from './views/Admin.vue'
import Login from './views/Login.vue'
import Register from './views/Register.vue' // 👈 1. 确保这一行在！

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Home },
    { path: '/article/:id', component: ArticleDetail },
    { path: '/login', component: Login },
    
    // 👇 2. 确保这一行也在！恢复注册页面的访问
    { path: '/register', component: Register }, 

    { 
      path: '/admin', 
      component: Admin,
      meta: { requiresAuth: true }
    }
  ]
})

// ... (下面的路由守卫代码保持不变) ...
router.beforeEach((to, from, next) => {
  if (to.meta.requiresAuth) {
    const isLoggedIn = localStorage.getItem('isLoggedIn')
    const role = localStorage.getItem('role')

    if (isLoggedIn && role === 'admin') { 
      next()
    } else {
      alert('🚫 只有管理员才能进入后台！')
      next('/') 
    }
  } else {
    next()
  }
})

export default router