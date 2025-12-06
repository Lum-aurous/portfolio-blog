<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()
const isDark = ref(false)
const isLoggedIn = ref(false)
const isAdmin = ref(false)

// 检查登录状态
const checkLoginStatus = () => {
  isLoggedIn.value = !!localStorage.getItem('isLoggedIn')
  isAdmin.value = localStorage.getItem('role') === 'admin'
}

// 退出登录
const handleLogout = () => {
  if (confirm('确定要退出登录吗？')) {
    localStorage.removeItem('isLoggedIn')
    localStorage.removeItem('username')
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    isLoggedIn.value = false
    router.push('/login')
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

// 导航栏数据
const navItems = [
  { name: '首页', path: '/', isDropdown: false },
  { name: '博客', path: '/blog', isDropdown: false },
  { name: '游记', path: '/travel', isDropdown: false },
  {
    name: '记录',
    path: '/records',
    isDropdown: true,
    children: [
      { name: '生活倒影', path: '/records/life' },
      { name: '视听盛宴', path: '/records/media' },
      { name: '学习人生', path: '/records/study' },
      { name: '海外趣事', path: '/records/travel' },
      { name: '爱心资源', path: '/records/resources' }
    ]
  },
  { name: '百宝箱', path: '/toolkit', isDropdown: false },
  { name: '留言', path: '/comments', isDropdown: false },
  { name: '联系我', path: '/contact', isDropdown: false },
]

const activeDropdown = ref(null)
const isHovering = ref(false)
const showBackground = ref(false)

// 鼠标进入导航栏
const handleMouseEnter = () => {
  isHovering.value = true
  showBackground.value = true
}

// 鼠标离开导航栏
const handleMouseLeave = () => {
  isHovering.value = false
  setTimeout(() => {
    if (!isHovering.value) {
      showBackground.value = false
    }
  }, 500)
}

onMounted(() => {
  // 初始化主题
  const savedTheme = localStorage.getItem('theme')
  if (savedTheme === 'dark') {
    isDark.value = true
    document.documentElement.classList.add('dark')
  }
  checkLoginStatus()
})

// 监听路由变化
watch(() => route.path, () => {
  checkLoginStatus()
})
</script>

<template>
  <nav 
    class="navbar" 
    :class="{ 'navbar-active': showBackground || activeDropdown }" 
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <div class="nav-content">
      <!-- Logo -->
      <router-link to="/" class="logo">𝓥𝓮𝓻𝓲𝓽𝓪𝓼</router-link>

      <!-- 菜单 -->
      <div class="menu">
        <!-- 导航项 -->
        <div 
          v-for="item in navItems" 
          :key="item.name" 
          class="nav-item-wrapper"
          @mouseenter="item.isDropdown ? activeDropdown = item.name : null" 
          @mouseleave="activeDropdown = null"
        >
          <router-link :to="item.path" class="nav-item">
            {{ item.name }}
          </router-link>

          <!-- 下拉菜单 - 关键修复：添加鼠标事件监听 -->
          <div 
            v-if="item.isDropdown && item.children && activeDropdown === item.name" 
            class="dropdown-menu"
            @mouseenter="activeDropdown = item.name"
            @mouseleave="activeDropdown = null"
          >
            <router-link 
              v-for="child in item.children" 
              :key="child.name" 
              :to="child.path" 
              class="dropdown-item"
            >
              {{ child.name }}
            </router-link>
          </div>
        </div>

        <!-- 登录/退出按钮 -->
        <button v-if="isLoggedIn" @click="handleLogout" class="nav-item btn-logout">
          退出
        </button>
        <router-link v-else to="/login" class="nav-item">
          登录
        </router-link>

        <!-- 主题切换按钮 -->
        <button @click="toggleTheme" class="theme-btn">
          {{ isDark ? '🌞' : '🌙' }}
        </button>
      </div>
    </div>
  </nav>
</template>

<style scoped>
/* ==================== 1. 导航栏主体 ==================== */
/* 默认完全透明 */
/* 导航栏主体样式 */
.navbar {
  /* 基础颜色保持不变 */
  background: transparent;
  box-shadow: none;
  
  /* 🔴 修改这里：从 sticky 改为 fixed */
  position: fixed; 
  top: 0;
  left: 0; /* 确保从左边开始 */
  width: 100%; /* 确保撑满宽度 */
  
  z-index: 100;
  transition: background 0.5s ease, box-shadow 0.5s ease;
}

/* 激活状态（鼠标悬浮时）- 极低透明度 */
.navbar-active {
  background: rgba(255, 255, 255, 0.05); /* Light Mode: 5% 不透明度 */
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 20px rgba(0, 0, 0, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

/* Dark Mode 适配 */
:global(html.dark) .navbar-active {
  background: rgba(0, 0, 0, 0.1); /* Dark Mode: 10% 不透明度 */
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

/* 导航栏内容容器 */
.nav-content {
  max-width: 900px;
  margin: 0 auto;
  padding: 15px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* ==================== 2. Logo 样式 ==================== */
.logo {
  font-size: 1.8rem;
  font-weight: 700;
  font-family: 'Georgia', 'Times New Roman', serif;
  letter-spacing: 2px;
  text-decoration: none;
  
  /* 渐变文字效果 */
  background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  
  /* 动态光晕效果 */
  text-shadow: 0 0 20px rgba(102, 126, 234, 0.5);
  animation: logo-glow 3s ease-in-out infinite;
  transition: transform 0.3s ease;
}

.logo:hover {
  transform: scale(1.05);
}

/* Logo 发光动画 */
@keyframes logo-glow {
  0%, 100% {
    filter: drop-shadow(0 0 8px rgba(102, 126, 234, 0.6));
  }
  50% {
    filter: drop-shadow(0 0 20px rgba(240, 147, 251, 0.8));
  }
}

/* ==================== 3. 菜单容器 ==================== */
.menu {
  display: flex;
  align-items: center;
  gap: 20px;
}

/* ==================== 4. 导航项样式 ==================== */
.nav-item-wrapper {
  position: relative; /* 为下拉菜单定位 */
}

/* 导航链接基础样式 */
.nav-item {
  color: white;
  text-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
  text-decoration: none;
  transition: all 0.3s ease;
  cursor: pointer;
}

/* 导航栏激活时的文字颜色 */
.navbar-active .nav-item {
  color: var(--text-color);
  text-shadow: none;
}

/* 鼠标悬停效果 */
.nav-item:hover {
  color: #42b883;
  transform: translateY(-2px);
}

/* ==================== 5. 下拉菜单 ==================== */
.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  min-width: 150px;
  padding: 5px;
  margin-top: 8px; /* 🔥 关键修复：增加间距，避免鼠标移动时的空隙 */
  border-radius: 10px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  z-index: 90;
  overflow: hidden;
  backdrop-filter: blur(10px);
  background: var(--card-bg); /* 自动适配主题 */
}

/* 🔥 关键修复：在父容器和下拉菜单之间创建"桥梁" */
.nav-item-wrapper::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  height: 8px; /* 与 margin-top 保持一致 */
  background: transparent;
  z-index: 89;
}

/* 下拉菜单项 */
.dropdown-item {
  padding: 10px 15px;
  color: var(--text-color);
  text-align: center;
  border-radius: 6px;
  transition: background 0.3s, color 0.3s;
  text-decoration: none;
}

.dropdown-item:hover {
  background: #42b883;
  color: white !important;
}

/* ==================== 6. 登录/退出按钮 ==================== */
.btn-logout {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  padding: 0;
  color: #ff6b6b;
  text-shadow: 0 0 5px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
}

/* 激活状态下的退出按钮 */
.navbar-active .btn-logout {
  color: #ff6b6b;
  text-shadow: none;
}

.btn-logout:hover {
  color: #e55050;
  text-decoration: underline;
  transform: translateY(-2px);
}

/* ==================== 7. 主题切换按钮 ==================== */
.theme-btn {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 8px 12px;
  border-radius: 25px;
  cursor: pointer;
  font-size: 1.3rem;
  color: white;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.navbar-active .theme-btn {
  border-color: rgba(255, 255, 255, 0.3);
  color: var(--text-color);
}

.theme-btn:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: scale(1.1) rotate(15deg);
  box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
}

/* ==================== 8. 响应式设计 ==================== */
@media (max-width: 768px) {
  .nav-content {
    flex-direction: column;
    gap: 15px;
  }

  .menu {
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px;
  }

  .logo {
    font-size: 1.5rem;
  }
}
</style>