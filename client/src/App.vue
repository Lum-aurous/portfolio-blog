<script setup>
import { onMounted, ref, computed, watch, nextTick } from 'vue'
import { useWallpaperStore } from '@/stores/wallpaper'
import Navbar from '@/components/Navbar.vue'
import Footer from '@/components/Footer.vue' // 🔥 引入页脚
import ToastManager from '@/components/ToastManager.vue'
import { useUserStore } from '@/stores/user.js'
import { useRoute } from 'vue-router'
import { api } from '@/utils/api'

const route = useRoute() // 🔥 获取路由实例
const userStore = useUserStore()
const wallpaperStore = useWallpaperStore()
const isAppReady = ref(false)
const imageLoaded = ref(false)
// 定义响应式变量感知全局 class
const isSystemDark = ref(document.documentElement.classList.contains('dark'))

// 🔥 新增：判断是否显示前台组件 (Navbar 和 背景)
const showNavbar = computed(() => {
  // 如果路径以 /admin 开头，或者是登录/注册页(可选)，就不显示 Navbar
  if (route.path.startsWith('/admin')) return false
  return true
})

// 🔥 新增：记录访问量的函数
const recordVisit = async () => {
  // 1. 检查本次会话是否已经记录过
  const hasVisited = sessionStorage.getItem('site_visited')

  if (!hasVisited) {
    try {
      // 2. 如果没记录过，发请求给后端
      await api.post('/site/visit')

      // 3. 标记为已记录 (关闭浏览器标签页前都有效)
      sessionStorage.setItem('site_visited', 'true')
      console.log('🚀 全站访问量 +1')
    } catch (error) {
      // 失败了也不用打扰用户
      console.warn('访问统计失败', error)
    }
  } else {
    console.log('👻 本次会话已统计，跳过')
  }
}

// ==================== 1. 动态背景样式计算 ====================
const backgroundStyle = computed(() => {
  const url = wallpaperStore.currentWallpaper
  const blur = wallpaperStore.wallpaperBlur
  const mask = wallpaperStore.wallpaperMask

  if (!url) {
    return { backgroundColor: 'transparent', opacity: 0 }
  }

  let formattedUrl = url
  if (url && !url.startsWith('http') && !url.startsWith('/')) {
    formattedUrl = '/' + url
  }

  return {
    backgroundImage: `url("${formattedUrl}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundAttachment: 'fixed',
    filter: `blur(${blur}px)`,
    backgroundColor: mask ? 'rgba(0, 0, 0, 0.2)' : 'transparent',
    backgroundBlendMode: mask ? 'overlay' : 'normal',
    transition: 'filter 0.3s ease, background-color 0.3s ease, opacity 0.5s ease',
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
    opacity: imageLoaded.value ? 1 : 0
  }
})

// ==================== 2. 壁纸预加载监听 ====================
watch(() => wallpaperStore.currentWallpaper, (newUrl) => {
  // 只有在前台页面才加载壁纸，优化性能
  if (!showNavbar.value) return

  console.log('🖼️ App: 壁纸URL变化:', newUrl)
  imageLoaded.value = false

  if (newUrl) {
    document.documentElement.style.setProperty('--wallpaper-bg', `url("${newUrl}")`)
    document.documentElement.style.setProperty('--wallpaper-blur', `${wallpaperStore.wallpaperBlur}px`)
    document.documentElement.style.setProperty('--wallpaper-mask', wallpaperStore.wallpaperMask ? '0.2' : '0')

    const img = new Image()
    let formattedUrl = newUrl
    if (!newUrl.startsWith('http') && !newUrl.startsWith('/')) {
      formattedUrl = '/' + newUrl
    }

    img.onload = () => {
      console.log('✅ App: 壁纸预加载成功:', formattedUrl)
      imageLoaded.value = true
    }
    img.onerror = (err) => {
      console.error('❌ App: 壁纸加载失败:', err)
      imageLoaded.value = true
    }
    img.src = formattedUrl
  } else {
    imageLoaded.value = true
  }
}, { immediate: true })

// 每日壁纸检查器
const checkDailyWallpaperUpdate = () => {
  // 只在每日壁纸模式下检查更新
  if (wallpaperStore.wallpaperMode === 'daily') {
    const today = new Date().toDateString();
    const lastDailyUpdate = localStorage.getItem('last_daily_update');

    if (lastDailyUpdate !== today) {
      logger.info('📅 检测到新的一天，准备更新每日壁纸');
      // 清除缓存，触发重新获取
      wallpaperStore.clearCache();
      localStorage.setItem('last_daily_update', today);

      // 重新初始化壁纸系统（不阻塞主线程）
      setTimeout(() => {
        wallpaperStore.initialize(true); // true表示强制刷新
      }, 1000);
    }
  }
};

const showGlobalUI = computed(() => {
  // 1. 排除后台路径
  if (route.path.startsWith('/admin')) return false;
  // 2. 检查路由元信息中是否显式要求隐藏
  if (route.meta.hideFooter) return false;
  
  return true;
});

// ==================== 3. 生命周期 ====================
onMounted(async () => {
  const observer = new MutationObserver(() => {
    isSystemDark.value = document.documentElement.classList.contains('dark')
  })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  console.log('🚀 App.vue 全局挂载');
  try {
    // 1. 先同步检查用户状态（从缓存恢复）
    userStore.checkLoginStatus();
    console.log('👤 App: 用户状态检查完成');

    await nextTick();

    // 2. 只有在前台页面才初始化壁纸
    if (showNavbar.value && !wallpaperStore.isInitialized) {
      console.log('🎨 App: 开始初始化壁纸系统...');
      // 🔥 等待一个微任务，确保用户状态响应式更新已完成
      await nextTick();
      await wallpaperStore.initialize();
      console.log('✅ App: 壁纸系统初始化完成');
    }
  } catch (error) {
    console.error('❌ App: 全局初始化异常:', error);
  } finally {
    isAppReady.value = true;
  }
  recordVisit();
  checkDailyWallpaperUpdate();
});

// ==================== 4. 监听用户状态变化 ====================
watch(() => userStore.user, (newUser) => {
  console.log('👤 App: 用户状态变化:', newUser?.username || '未登录')
}, { deep: true })

watch(() => userStore.isLoggedIn, (loggedIn) => {
  console.log('🔐 App: 登录状态变化:', loggedIn ? '已登录' : '未登录')
})
</script>

<template>
  <div class="app-container">
    <ToastManager />

    <div v-if="showNavbar" class="global-background" :style="backgroundStyle"
      :class="{ 'background-loaded': imageLoaded }">
    </div>

    <Navbar v-if="showGlobalUI" />

    <main class="main-content">
      <router-view v-slot="{ Component, route }">
        <keep-alive :include="['Home']">
          <component :is="Component" :key="route.path" />
        </keep-alive>
      </router-view>
    </main>

    <Footer v-if="showGlobalUI" />

    <transition name="fade">
      <div v-if="!isAppReady" class="loading-overlay" :class="{ 'dark-loading': isSystemDark }">
        <div class="loading-spinner"></div>
        <p class="loading-text">正在唤醒世界...</p>
      </div>
    </transition>


  </div>
</template>

<style scoped>
.app-container {
  min-height: 100vh;
  position: relative;
  /* 防止横向滚动条 */
  overflow-x: hidden;
}

/* ==================== 全局背景层 ==================== */
.global-background {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  /* 确保在最底层 */
  z-index: -999;
  /* 默认透明，等待 JS 预加载完成 */
  opacity: 0;
  /* 只有 opacity 需要长过渡，实现淡入效果 */
  transition: opacity 0.8s ease-in-out;
  /* 确保不拦截鼠标事件 */
  pointer-events: none;
}

/* 当图片加载完成后，添加此 class */
.global-background.background-loaded {
  opacity: 1;
}

/* ==================== 主内容区 ==================== */
.main-content {
  position: relative;
  z-index: 1;
  /* 确保内容区撑满高度 */
  min-height: 100vh;
}

/* ==================== Loading 遮罩 ==================== */
.loading-overlay {
  transition: background-color 0.5s ease;
  background: #ffffff;
  /* 浅色模式背景 */
  position: fixed;
  inset: 0;
  /* 纯黑背景遮盖一切 */
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  /* 最高层级 */
}

.loading-overlay.dark-loading {
  background: #0f172a;
  /* 深色模式背景 */
}

.loading-overlay.dark-loading .loading-text {
  color: #42b883;
  /* 深色模式文字保持 Vue 绿，但在深色背景下对比度更高 */
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  border-top-color: #42b883;
  /* Vue 绿 */
  animation: spin 1s cubic-bezier(0.55, 0.055, 0.675, 0.19) infinite;
}

.loading-text {
  margin-top: 20px;
  color: #42b883;
  font-size: 0.9rem;
  letter-spacing: 2px;
  text-transform: uppercase;
  font-weight: 500;
  animation: pulse 2s infinite;
}

/* 动画定义 */
@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

@keyframes pulse {

  0%,
  100% {
    opacity: 0.6;
  }

  50% {
    opacity: 1;
  }
}

/* Vue Transition 淡入淡出 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.6s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .main-content {
    /* 移动端通常有底部导航或地址栏，留出余量 */
    min-height: 100vh;
  }
}

/* 无限级评论树的视觉增强 */
.comment-item {
  position: relative;
  transition: all 0.3s ease;
}

.comment-item:hover {
  background-color: rgba(0, 0, 0, 0.01);
}

/* 深度指示器 */
.comment-depth-0 {
  border-left: 4px solid #42b983;
}

.comment-depth-1 {
  border-left: 3px solid #3498db;
}

.comment-depth-2 {
  border-left: 2px solid #9b59b6;
}

.comment-depth-3 {
  border-left: 1px solid #e74c3c;
}

.comment-depth-4 {
  border-left: 1px dashed #95a5a6;
}

.comment-depth-5 {
  border-left: 1px dotted #bdc3c7;
}

/* 点击展开/收起动画 */
.expand-transition-enter-active,
.expand-transition-leave-active {
  transition: all 0.3s ease;
  max-height: 500px;
  overflow: hidden;
}

.expand-transition-enter-from,
.expand-transition-leave-to {
  max-height: 0;
  opacity: 0;
}

/* 滚动到评论高亮效果 */
.comment-highlight {
  animation: highlightComment 2s ease;
  box-shadow: 0 0 0 2px rgba(66, 185, 131, 0.3);
}

@keyframes highlightComment {
  0% {
    box-shadow: 0 0 0 6px rgba(66, 185, 131, 0.5);
  }

  100% {
    box-shadow: 0 0 0 2px rgba(66, 185, 131, 0.3);
  }
}
</style>