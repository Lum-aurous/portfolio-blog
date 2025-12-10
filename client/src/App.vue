<script setup>
import { onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useWallpaperStore } from '@/stores/wallpaper'
import { useUserStore } from '@/stores/user'
import Navbar from '@/components/Navbar.vue'

const route = useRoute()
const wallpaperStore = useWallpaperStore()
const userStore = useUserStore()

// 初始化壁纸系统
onMounted(async () => {
  await wallpaperStore.initialize()
})

// 监听路由变化，确保每次进入首页都刷新时钟
watch(() => route.path, (newPath, oldPath) => {
  // 可以在这里添加路由切换的过渡效果
  if (newPath === '/' && oldPath !== '/') {
    console.log('进入首页，确保时钟正常运行')
  }
})
</script>

<template>
  <div class="app-container">
    <!-- 全局背景层 - 确保在所有页面都显示 -->
    <div class="global-background" :style="wallpaperStore.wallpaperStyle"></div>

    <!-- 导航栏 -->
    <Navbar />

    <!-- 主内容区 -->
    <main class="main-content">
      <router-view v-slot="{ Component, route }">
        <transition :name="route.meta.transition || 'fade'" mode="out-in" @before-enter="beforeEnter"
          @after-enter="afterEnter">
          <component :is="Component" :key="route.path" />
        </transition>
      </router-view>
    </main>
  </div>
</template>

<style scoped>
.app-container {
  min-height: 100vh;
  position: relative;
}

.global-background {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: -1;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  background-attachment: fixed;
  /* ⚡️ 优化：更快的过渡动画 */
  transition: background-image 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.main-content {
  position: relative;
  z-index: 1;
  min-height: calc(100vh - 70px);
  /* 减去导航栏高度 */
}

/* 路由过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.slide-enter-from {
  transform: translateX(-20px);
  opacity: 0;
}

.slide-leave-to {
  transform: translateX(20px);
  opacity: 0;
}
</style>