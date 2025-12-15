<!-- @/components/WallpaperDebug.vue -->
<template>
    <div v-if="showDebug" class="wallpaper-debug">
        <div class="debug-header" @click="toggleDetails">
            🖼️ 壁纸调试
        </div>
        <div v-if="showDetails" class="debug-details">
            <p>当前壁纸: {{ wallpaperStore.currentWallpaper || '无' }}</p>
            <p>壁纸模式: {{ wallpaperStore.wallpaperMode }}</p>
            <p>已初始化: {{ wallpaperStore.isInitialized }}</p>
            <p>加载中: {{ wallpaperStore.isLoading }}</p>
            <p>用户有自定义: {{ wallpaperStore.userHasCustom }}</p>
            <div class="debug-buttons">
                <button @click="reloadWallpaper">重新加载</button>
                <button @click="clearCache">清除缓存</button>
                <button @click="forceRefresh">强制刷新</button>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue'
import { useWallpaperStore } from '@/stores/wallpaper'

const wallpaperStore = useWallpaperStore()
const showDebug = ref(import.meta.env.DEV)
const showDetails = ref(false)

const toggleDetails = () => {
    showDetails.value = !showDetails.value
}

const reloadWallpaper = async () => {
    await wallpaperStore.initialize(true)
    alert('壁纸已重新加载')
}

const clearCache = () => {
    wallpaperStore.clearCache()
    alert('缓存已清除')
}

const forceRefresh = async () => {
    await wallpaperStore.refreshWallpaper()
    alert('壁纸已强制刷新')
}
</script>

<style scoped>
.wallpaper-debug {
    position: fixed;
    bottom: 60px;
    right: 10px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 10px;
    border-radius: 5px;
    z-index: 9999;
    font-size: 12px;
    max-width: 300px;
}

.debug-header {
    cursor: pointer;
    font-weight: bold;
}

.debug-details {
    margin-top: 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.2);
    padding-top: 10px;
}

.debug-buttons {
    display: flex;
    gap: 5px;
    margin-top: 10px;
}

.debug-buttons button {
    padding: 5px 10px;
    background: #333;
    color: white;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    font-size: 10px;
}

.debug-buttons button:hover {
    background: #555;
}
</style>