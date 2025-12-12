<script setup>
import { onMounted, ref, computed, watch } from 'vue'
import { useWallpaperStore } from '@/stores/wallpaper'
import Navbar from '@/components/Navbar.vue'
import ToastManager from '@/components/ToastManager.vue'
import { useUserStore } from '@/stores/user.js'

const userStore = useUserStore()

const wallpaperStore = useWallpaperStore()
const isAppReady = ref(false)
// 🔥 新增：精确控制图片是否已在内存中加载完成
const imageLoaded = ref(false)

// ==================== 1. 动态背景样式计算 ====================
const backgroundStyle = computed(() => {
  const url = wallpaperStore.currentWallpaper
  const blur = wallpaperStore.wallpaperBlur
  const mask = wallpaperStore.wallpaperMask

  // 如果没有 URL，返回兜底深色背景
  if (!url) {
    return { backgroundColor: '#1a1a1a' }
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
    // 动态模糊
    filter: `blur(${blur}px)`,
    // 动态遮罩叠加
    backgroundColor: mask ? 'rgba(0, 0, 0, 0.4)' : 'transparent', // 稍微加深一点遮罩让文字更清晰
    backgroundBlendMode: mask ? 'overlay' : 'normal',
    // 样式的变化（如模糊度调整）也要平滑过渡
    transition: 'filter 0.3s ease, background-color 0.3s ease'
  }
})

// ==================== 2. 核心：壁纸预加载监听 ====================
watch(() => wallpaperStore.currentWallpaper, (newUrl) => {
  // 1. URL 变化那一刻，先将加载状态置为 false (背景会根据 css 变透明，或保持上一张)
  // 如果你想实现双缓冲（新图盖旧图），逻辑会更复杂，这里先用淡入淡出
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
      // 此时设置 true，DOM 中的 div 才会应用 opacity: 1，瞬间显示出来
      console.log('🖼️ 壁纸预加载成功:', formattedUrl)
      imageLoaded.value = true
    }

    img.onerror = (err) => {
      console.error('❌ 壁纸加载失败:', err)
      // 即使失败，也设为 true，至少显示背景色，避免一直是透明的
      imageLoaded.value = true
    }

    // 开始下载
    img.src = formattedUrl
  } else {
    // 如果 URL 被清空，直接视为“加载完成”（显示纯色背景）
    imageLoaded.value = true
  }
}, { immediate: true })

// ==================== 3. 生命周期初始化 ====================
onMounted(async () => {
  console.log('🚀 App.vue 全局挂载')
  // 🔥 在这里检查登录状态，最安全
  userStore.checkLoginStatus()  

  try {
    // 尝试初始化壁纸
    // 注意：initialize 内部已经做了防止重复调用的判断，这里直接调很安全
    if (!wallpaperStore.isInitialized) {
      await wallpaperStore.initialize()
    }
  } catch (error) {
    console.error('❌ 全局初始化异常:', error)
  } finally {
    // 无论成功失败，都要移除加载遮罩，让用户看到界面
    // 稍微延迟一点点，给用户一种“稳重”的感觉
    setTimeout(() => {
      isAppReady.value = true
    }, 500)
  }
})
</script>

<template>
  <div class="app-container">
    <ToastManager />
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
</style>