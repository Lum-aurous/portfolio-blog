<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user.js'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

// 实时时间
const currentTime = ref('')
const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

// 更新时间
const updateTime = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const seconds = String(now.getSeconds()).padStart(2, '0')
    const weekday = weekdays[now.getDay()]

    currentTime.value = `${year}年${month}月${day}日 ${hours}:${minutes}:${seconds} ${weekday}`
}

let timer = null

onMounted(() => {
    updateTime()
    // 每秒更新一次时间
    timer = setInterval(updateTime, 1000)
})

onUnmounted(() => {
    if (timer) {
        clearInterval(timer)
    }
})

const menuItems = [
    { name: '仪表盘', path: '/admin/dashboard', icon: '📊' },
    { name: '发布文章', path: '/admin/publish', icon: '✍️' },
    { name: '文章管理', path: '/admin/articles', icon: '📄' },
    { name: '评论管理', path: '/admin/comments', icon: '💬' },
    { name: '用户管理', path: '/admin/users', icon: '👥' },
    { name: '公告管理', path: '/admin/notices', icon: '📢' },
    { name: '友链管理', path: '/admin/friends', icon: '🔗' },
    { name: '壁纸管理', path: '/admin/wallpapers', icon: '🖼️' },
    { name: '版权管理', path: '/admin/copyright', icon: '⚖️' },
]

const handleLogout = () => {
    if (confirm('确定要退出后台管理吗？')) {
        userStore.logout()
        router.push('/login')
    }
}

const goHome = () => router.push('/')
</script>

<template>
    <div class="admin-layout">
        <aside class="admin-sidebar">
            <div class="logo-area" @click="goHome">
                <div class="logo-icon">🎯</div>
                <div class="logo-text">
                    <div class="logo-title">𝓥𝓮𝓻𝓲𝓽𝓪𝓼</div>
                    <div class="logo-subtitle">系统数据管理</div>
                </div>
            </div>

            <nav class="menu-nav">
                <div class="menu-section-title">主菜单</div>
                <div v-for="item in menuItems" :key="item.path" class="menu-item"
                    :class="{ active: route.path === item.path }" @click="router.push(item.path)">
                    <span class="menu-icon">{{ item.icon }}</span>
                    <span>{{ item.name }}</span>
                    <span class="menu-arrow" v-if="route.path === item.path">▶</span>
                </div>
            </nav>

            <div class="user-area">
                <div class="avatar">
                    <img :src="userStore.user?.avatar || 'https://i.pravatar.cc/150'" alt="admin">
                    <div class="status-dot"></div>
                </div>
                <div class="info">
                    <div class="name">{{ userStore.user?.nickname || 'Admin' }}</div>
                    <div class="role">超级管理员</div>
                </div>
            </div>

            <div class="sidebar-footer">
                <div class="footer-item">设置</div>
                <div class="footer-item">帮助</div>
            </div>
        </aside>

        <div class="admin-main">
            <header class="admin-header">
                <div class="header-left">
                    <div class="breadcrumb">
                        <span class="breadcrumb-item">后台管理</span>
                        <span class="breadcrumb-separator">/</span>
                        <span class="breadcrumb-item active">{{ route.meta.title || '控制台' }}</span>
                    </div>
                    <div class="header-time">
                        {{ currentTime }}
                    </div>
                </div>
                <div class="header-actions">
                    <button class="action-btn icon-btn" title="通知">🔔</button>
                    <button class="action-btn icon-btn" title="设置">⚙️</button>
                    <button class="action-btn" @click="goHome">
                        <span>🏠</span> 回首页
                    </button>
                    <button class="action-btn logout" @click="handleLogout">
                        <span>🚪</span> 退出
                    </button>
                </div>
            </header>

            <main class="admin-content">
                <router-view v-slot="{ Component }">
                    <transition name="fade" mode="out-in">
                        <component :is="Component" />
                    </transition>
                </router-view>
            </main>
        </div>
    </div>
</template>

<style scoped>
/* ================= 全局布局 ================= */
.admin-layout {
    display: flex;
    height: 100vh;
    background: linear-gradient(135deg, #1a1f3a 0%, #2d1b3d 50%, #1a1f3a 100%);
    color: #e0e0e0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
    overflow: hidden;
    position: relative;
}

/* 背景装饰效果 */
.admin-layout::before {
    content: '';
    position: absolute;
    top: -50%;
    right: -20%;
    width: 800px;
    height: 800px;
    background: radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 70%);
    border-radius: 50%;
    pointer-events: none;
}

.admin-layout::after {
    content: '';
    position: absolute;
    bottom: -30%;
    left: -10%;
    width: 600px;
    height: 600px;
    background: radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%);
    border-radius: 50%;
    pointer-events: none;
}

/* ================= 侧边栏 ================= */
.admin-sidebar {
    width: 280px;
    background: rgba(26, 31, 58, 0.6);
    backdrop-filter: blur(20px);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    border-right: 1px solid rgba(255, 255, 255, 0.08);
    z-index: 100;
    box-shadow: 4px 0 24px rgba(0, 0, 0, 0.3);
}

.logo-area {
    height: 90px;
    display: flex;
    align-items: center;
    padding: 0 25px;
    gap: 15px;
    cursor: pointer;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    transition: all 0.3s;
}

.logo-area:hover {
    background: rgba(255, 255, 255, 0.03);
}

.logo-icon {
    width: 45px;
    height: 45px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    box-shadow: 0 4px 16px rgba(102, 126, 234, 0.4);
}

.logo-text {
    display: flex;
    flex-direction: column;
}

.logo-title {
    font-size: 1.3rem;
    font-weight: 700;
    color: #fff;
    letter-spacing: 1px;
}

.logo-subtitle {
    font-size: 0.7rem;
    color: rgba(255, 255, 255, 0.5);
    margin-top: 2px;
    letter-spacing: 2px;
}

.menu-nav {
    flex: 1;
    padding: 25px 15px;
    overflow-y: auto;
}

.menu-section-title {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.4);
    text-transform: uppercase;
    letter-spacing: 1.5px;
    padding: 0 15px 12px;
    font-weight: 600;
}

.menu-item {
    padding: 14px 18px;
    margin-bottom: 6px;
    border-radius: 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 12px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    color: rgba(255, 255, 255, 0.65);
    font-weight: 500;
    font-size: 0.95rem;
    position: relative;
}

.menu-item:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.08);
    transform: translateX(5px);
}

.menu-item.active {
    background: linear-gradient(90deg, rgba(59, 130, 246, 0.25) 0%, rgba(139, 92, 246, 0.25) 100%);
    color: #fff;
    box-shadow: 0 4px 16px rgba(59, 130, 246, 0.3);
    border-left: 3px solid #3b82f6;
}

.menu-item.active::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: linear-gradient(180deg, #3b82f6 0%, #8b5cf6 100%);
    border-radius: 0 3px 3px 0;
}

.menu-icon {
    font-size: 1.1rem;
}

.menu-arrow {
    margin-left: auto;
    font-size: 0.6rem;
    opacity: 0.7;
}

/* 用户区域 */
.user-area {
    padding: 20px 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(0, 0, 0, 0.2);
}

.user-area .avatar {
    position: relative;
}

.user-area .avatar img {
    width: 45px;
    height: 45px;
    border-radius: 50%;
    border: 2px solid #3b82f6;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
    object-fit: cover;
    object-position: center;
}

.status-dot {
    position: absolute;
    bottom: 2px;
    right: 2px;
    width: 10px;
    height: 10px;
    background: #10b981;
    border-radius: 50%;
    border: 2px solid rgba(26, 31, 58, 0.9);
    animation: pulse 2s infinite;
}

@keyframes pulse {

    0%,
    100% {
        box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
    }

    50% {
        box-shadow: 0 0 0 6px rgba(16, 185, 129, 0);
    }
}

.user-area .info {
    flex: 1;
}

.user-area .info .name {
    color: #fff;
    font-weight: 600;
    font-size: 0.95rem;
}

.user-area .info .role {
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.75rem;
    margin-top: 3px;
}

.sidebar-footer {
    display: flex;
    padding: 15px 20px;
    gap: 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.footer-item {
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    transition: color 0.3s;
}

.footer-item:hover {
    color: #3b82f6;
}

/* ================= 右侧主体 ================= */
.admin-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
}

/* 顶部导航 */
.admin-header {
    height: 80px;
    padding: 0 40px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(26, 31, 58, 0.4);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
}

.header-left {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.breadcrumb {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.95rem;
}

.breadcrumb-item {
    color: rgba(255, 255, 255, 0.5);
    transition: color 0.3s;
}

.breadcrumb-item.active {
    color: #fff;
    font-weight: 600;
}

.breadcrumb-separator {
    color: rgba(255, 255, 255, 0.3);
}

.header-time {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.4);
}

.header-actions {
    display: flex;
    gap: 12px;
    align-items: center;
}

.action-btn {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    cursor: pointer;
    font-size: 0.85rem;
    color: #fff;
    padding: 10px 20px;
    border-radius: 8px;
    backdrop-filter: blur(10px);
    transition: all 0.3s;
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 500;
}

/* 主要操作按钮（如发布文章、存草稿等）使用更醒目的样式 */
.action-btn.primary {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    border: 1px solid rgba(16, 185, 129, 0.5);
    color: #ffffff;
    font-weight: 600;
    box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);
}

.action-btn.primary:hover {
    background: linear-gradient(135deg, #059669 0%, #047857 100%);
    box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
    transform: translateY(-2px);
}

.action-btn.secondary {
    background: rgba(255, 255, 255, 0.12);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: #ffffff;
    font-weight: 600;
}

.action-btn.secondary:hover {
    background: rgba(255, 255, 255, 0.18);
}

.action-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.action-btn.icon-btn {
    padding: 10px;
    font-size: 1.1rem;
}

.action-btn.logout:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: #ef4444;
}

.admin-content {
    flex: 1;
    padding: 30px 40px;
    overflow-y: auto;
}

/* 滚动条美化 */
::-webkit-scrollbar {
    width: 8px;
    height: 8px;
}

::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.02);
    border-radius: 4px;
}

::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 4px;
    transition: background 0.3s;
}

::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.25);
}

/* 页面切换动画 */
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s, transform 0.3s;
}

.fade-enter-from {
    opacity: 0;
    transform: translateY(10px);
}

.fade-leave-to {
    opacity: 0;
    transform: translateY(-10px);
}
</style>