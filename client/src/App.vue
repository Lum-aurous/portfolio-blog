<script setup>
import { onMounted, ref, computed, watch, nextTick } from 'vue'
import { useWallpaperStore } from '@/stores/wallpaper'
import Navbar from '@/components/Navbar.vue'
import ToastManager from '@/components/ToastManager.vue'
import { useUserStore } from '@/stores/user.js'

const userStore = useUserStore()
const wallpaperStore = useWallpaperStore()
const isAppReady = ref(false)
const imageLoaded = ref(false)

// ==================== 1. 动态背景样式计算 ====================
const backgroundStyle = computed(() => {
  const url = wallpaperStore.currentWallpaper
  const blur = wallpaperStore.wallpaperBlur
  const mask = wallpaperStore.wallpaperMask

  // 🔥 修复：如果没有URL，返回透明背景
  if (!url) {
    return {
      backgroundColor: 'transparent',
      opacity: 0
    }
  }

  // URL 格式化处理
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
    // 动态模糊
    filter: `blur(${blur}px)`,
    // 动态遮罩叠加
    backgroundColor: mask ? 'rgba(0, 0, 0, 0.2)' : 'transparent',
    backgroundBlendMode: mask ? 'overlay' : 'normal',
    // 样式的变化（如模糊度调整）也要平滑过渡
    transition: 'filter 0.3s ease, background-color 0.3s ease, opacity 0.5s ease',
    // 确保背景层覆盖整个页面
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
  console.log('🖼️ App: 壁纸URL变化:', newUrl)

  // 1. URL 变化那一刻，先将加载状态置为 false
  imageLoaded.value = false

  if (newUrl) {
    // 2. 同步更新 CSS 变量 (给其他组件使用)
    document.documentElement.style.setProperty('--wallpaper-bg', `url("${newUrl}")`)
    document.documentElement.style.setProperty('--wallpaper-blur', `${wallpaperStore.wallpaperBlur}px`)
    document.documentElement.style.setProperty('--wallpaper-mask', wallpaperStore.wallpaperMask ? '0.2' : '0')

    // 3. 🚀 创建 Image 对象进行预加载
    const img = new Image()

    // 格式化 URL 供 Image 对象使用
    let formattedUrl = newUrl
    if (!newUrl.startsWith('http') && !newUrl.startsWith('/')) {
      formattedUrl = '/' + newUrl
    }

    img.onload = () => {
      // ✅ 图片下载完毕，浏览器缓存中已存在
      console.log('✅ App: 壁纸预加载成功:', formattedUrl)
      imageLoaded.value = true
    }

    img.onerror = (err) => {
      console.error('❌ App: 壁纸加载失败:', err)
      // 即使失败，也设为 true，至少显示背景色
      imageLoaded.value = true
    }

    // 开始下载
    img.src = formattedUrl
  } else {
    // 如果 URL 被清空，直接视为"加载完成"（显示纯色背景）
    imageLoaded.value = true
  }
}, { immediate: true })

// ==================== 3. 生命周期初始化 ====================
onMounted(async () => {
  console.log('🚀 App.vue 全局挂载')

  try {
    // 1. 先检查登录状态（这会自动恢复 localStorage 中的用户状态）
    userStore.checkLoginStatus()
    console.log('👤 App: 用户状态检查完成:', userStore.user?.username)

    // 2. 等待 DOM 更新
    await nextTick()

    // 3. 🔥 关键修复：确保壁纸系统只初始化一次
    if (!wallpaperStore.isInitialized) {
      console.log('🎨 App: 开始初始化壁纸系统...')
      await wallpaperStore.initialize()
      console.log('✅ App: 壁纸系统初始化完成')
    } else {
      console.log('🔄 App: 壁纸已初始化，跳过重复初始化')
    }

    console.log('✅ App: 应用初始化完成')
  } catch (error) {
    console.error('❌ App: 全局初始化异常:', error)
  } finally {
    // 无论成功失败，都要移除加载遮罩，让用户看到界面
    setTimeout(() => {
      isAppReady.value = true
      console.log('✨ App: 应用准备就绪')
    }, 500)
  }
})

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

    <!-- 🔥 修复：确保背景层正确渲染 -->
    <div class="global-background" :style="backgroundStyle" :class="{ 'background-loaded': imageLoaded }">
    </div>

    <Navbar />

    <main class="main-content">
      <router-view v-slot="{ Component, route }">
        <keep-alive :include="['Home']">
          <component :is="Component" :key="route.path" />
        </keep-alive>
      </router-view>
    </main>

    <transition name="fade">
      <div v-if="!isAppReady" class="loading-overlay">
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
  position: fixed;
  inset: 0;
  background: #000000;
  /* 纯黑背景遮盖一切 */
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  /* 最高层级 */
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