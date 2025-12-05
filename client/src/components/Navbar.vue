<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router' // 引入路由工具

const router = useRouter()
const route = useRoute() // 引入当前路由信息
const isDark = ref(false)
const isLoggedIn = ref(false) // 1. 定义一个变量来存登录状态


const isAdmin = ref(false)
// 2. 检查登录状态的函数
const checkLoginStatus = () => {
  isLoggedIn.value = !!localStorage.getItem('isLoggedIn')
  // 👇 检查是不是管理员
  isAdmin.value = localStorage.getItem('role') === 'admin'
}

// 3. 退出登录函数
const handleLogout = () => {
  if (confirm('确定要退出登录吗？')) {
    localStorage.removeItem('isLoggedIn') // 销毁通行证
    localStorage.removeItem('username')   // 清除用户名
    localStorage.removeItem('token')      // 如果以后有token也清除

    isLoggedIn.value = false // 更新状态
    router.push('/login') // 跳转回登录页
  }
}

// 切换深色模式
const toggleTheme = () => {
  isDark.value = !isDark.value
  if (isDark.value) {
    document.documentElement.classList.add('dark')
    localStorage.setItem('theme', 'dark')
  } else {
    document.documentElement.classList.remove('dark')
    localStorage.setItem('theme', 'light')
  }
}

onMounted(() => {
  // 初始化主题
  const savedTheme = localStorage.getItem('theme')
  if (savedTheme === 'dark') {
    isDark.value = true
    document.documentElement.classList.add('dark')
  }

  // 初始化登录状态
  checkLoginStatus()
})

// 4. 监听路由变化：每次页面跳转，都重新检查一下登录状态
// 这样当你从登录页跳到后台时，按钮会自动变
watch(() => route.path, () => {
  checkLoginStatus()
})
</script>

<template>
  <nav class="navbar">
    <div class="nav-content">
      <router-link to="/" class="logo">🚀 My Portfolio</router-link>

      <div class="menu">
        <router-link to="/" class="nav-item">首页</router-link>

        <router-link v-if="isAdmin" to="/admin" class="nav-item">写作后台</router-link>

        <button v-if="isLoggedIn" @click="handleLogout" class="nav-item btn-logout">
          退出
        </button>
        <router-link v-else to="/login" class="nav-item">
          登录
        </router-link>

        <button @click="toggleTheme" class="theme-btn">
          {{ isDark ? '🌞' : '🌙' }}
        </button>
      </div>
    </div>
  </nav>
</template>

<style scoped>
/* 导航栏样式 */
.navbar {
  background: var(--card-bg);
  /* 使用变量，会自动变色 */
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
  transition: background 0.3s;
}

.nav-content {
  max-width: 900px;
  margin: 0 auto;
  padding: 15px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  font-size: 1.5rem;
  font-weight: bold;
  color: #42b883;
  text-decoration: none;
}

.menu {
  display: flex;
  align-items: center;
  gap: 20px;
}

.nav-item {
  text-decoration: none;
  color: var(--text-color);
  font-weight: 500;
  transition: color 0.3s;
}

.nav-item:hover {
  color: #42b883;
}

/* 按钮样式 */
.theme-btn {
  background: none;
  border: 1px solid var(--border-color);
  padding: 5px 10px;
  border-radius: 20px;
  cursor: pointer;
  font-size: 1.2rem;
  transition: 0.3s;
}

.theme-btn:hover {
  background: var(--bg-color);
}

/* 新增一个简单的退出按钮样式 */
.btn-logout {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  padding: 0;
  color: #ff6b6b;
  /* 用红色警示退出 */
}

.btn-logout:hover {
  color: #e55050;
  text-decoration: underline;
}

/* 之前定义的样式复制过来保持完整性... */
.navbar {
  background: var(--card-bg);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
  transition: background 0.3s;
}

.nav-content {
  max-width: 900px;
  margin: 0 auto;
  padding: 15px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  font-size: 1.5rem;
  font-weight: bold;
  color: #42b883;
  text-decoration: none;
}

.menu {
  display: flex;
  align-items: center;
  gap: 20px;
}

.nav-item {
  text-decoration: none;
  color: var(--text-color);
  font-weight: 500;
  transition: color 0.3s;
}

.nav-item:hover {
  color: #42b883;
}

.theme-btn {
  background: none;
  border: 1px solid var(--border-color);
  padding: 5px 10px;
  border-radius: 20px;
  cursor: pointer;
  font-size: 1.2rem;
  transition: 0.3s;
  color: var(--text-color);
}

.theme-btn:hover {
  background: var(--bg-color);
}
</style>