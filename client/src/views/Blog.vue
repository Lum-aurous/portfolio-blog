<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue' // 🔥 引入 watch
import axios from 'axios'
import { useUserStore } from '@/stores/user.js'
import { useRouter } from 'vue-router'

const userStore = useUserStore()
const router = useRouter()

// ==================== 1. 用户信息逻辑 (核心修复) ====================

// 默认头像 (Wallhaven 有时会 403，建议换成一个更稳定的图床或本地图片)
// 暂时换成 Unsplash 的图作为兜底，保证能显示
const defaultAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200&auto=format&fit=crop'

// 处理头像路径
const getFullAvatarUrl = (path) => {
    if (!path) return defaultAvatar
    if (path.startsWith('data:image') || path.startsWith('http')) return path
    // 这里的 import.meta.env.VITE_API_BASE_URL 需要确保在 .env 文件里配置了，或者直接写死 'http://localhost:3000'
    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
    return `${apiBase}${path}`
}

// 智能 Profile 计算属性
const profile = computed(() => {
    // 🔥 调试：看看 store 里到底有没有东西
    // console.log('Store User:', userStore.user)

    // 只要有 user 对象且有 username，就认为是登录状态
    if (userStore.user && userStore.user.username) {
        return {
            isLogin: true,
            name: userStore.user.nickname || userStore.user.username, // 优先显示昵称
            title: userStore.user.bio || '全栈开发者 / 追梦人',
            avatar: getFullAvatarUrl(userStore.user.avatar),
            articlesCount: 108, // 模拟数据
            categoryCount: 6,
            visits: '23w+',
            github: userStore.user.social_link || 'https://github.com'
        }
    } else {
        return {
            isLogin: false,
            name: '访客',
            title: '登录以解锁更多功能',
            avatar: defaultAvatar,
            articlesCount: '-',
            categoryCount: '-',
            visits: '-',
            github: '#'
        }
    }
})

const handleAvatarClick = () => {
    if (profile.value.isLogin) {
        router.push('/account')
    } else {
        router.push('/login')
    }
}
// ==================== 2. 动态轮播背景逻辑 (保持不变) ====================
const heroBgUrl = ref('')
const bgIndex = ref(0)
const wallpaperList = ref([])
const fallbackList = [
    'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?q=80&w=2000&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1511300636408-a63a6ad120de?q=80&w=2000&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2000&auto=format&fit=crop'
]
let carouselTimer = null

const preloadImage = (url) => {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.src = url
        img.onload = () => resolve(url)
        img.onerror = () => reject(url)
    })
}

const initWallpapers = async () => {
    try {
        const res = await axios.get('/api/wallpaper/global')
        if (res.data && res.data.randomUrls && res.data.randomUrls.length > 0) {
            wallpaperList.value = res.data.randomUrls
        } else {
            wallpaperList.value = fallbackList
        }
    } catch (error) {
        wallpaperList.value = fallbackList
    }
    startCarousel()
}

const startCarousel = async () => {
    if (wallpaperList.value.length === 0) return
    try {
        await preloadImage(wallpaperList.value[0])
        heroBgUrl.value = wallpaperList.value[0]
    } catch (e) {
        heroBgUrl.value = fallbackList[0]
    }
    carouselTimer = setInterval(async () => {
        const nextIndex = (bgIndex.value + 1) % wallpaperList.value.length
        const nextUrl = wallpaperList.value[nextIndex]
        try {
            await preloadImage(nextUrl)
            bgIndex.value = nextIndex
            heroBgUrl.value = nextUrl
        } catch (e) {
            bgIndex.value = nextIndex
        }
    }, 6000)
}

// ==================== 3. 其他逻辑 (打字机、滚动等) ====================
const typedText = ref('')
const fullText = "成就源于真理！"
let typeIndex = 0
let typeTimer = null

const startTyping = () => {
    typeIndex = 0
    typedText.value = ''
    if (typeTimer) clearInterval(typeTimer)
    typeTimer = setInterval(() => {
        if (typeIndex < fullText.length) {
            typedText.value += fullText.charAt(typeIndex)
            typeIndex++
        } else {
            clearInterval(typeTimer)
        }
    }, 200)
}

const scrollToContent = () => {
    const content = document.getElementById('blog-content-anchor')
    if (content) {
        const offset = 80
        const bodyRect = document.body.getBoundingClientRect().top
        const elementRect = content.getBoundingClientRect().top
        const offsetPosition = (elementRect - bodyRect) - offset
        window.scrollTo({ top: offsetPosition, behavior: 'smooth' })
    }
}

// 模拟文章和公告 (保持不变)
const categories = [{ id: 'latest', name: '最新', icon: '🔥' }, { id: 'veritas', name: 'Veritas', icon: '🪐' }, { id: 'life', name: '生活倒影', icon: '☕' }, { id: 'visual', name: '视听盛宴', icon: '🎬' }, { id: 'study', name: '学习人生', icon: '📚' }, { id: 'abroad', name: '海外趣事', icon: '🌍' }, { id: 'love', name: '爱心资源', icon: '❤️' }, // 🔥 新增：友链作为一个特殊的分类，也可以在这里加上，
// 或者我们保持它是独立的，只通过 activeCategory 控制
{ id: 'friends', name: '战友', icon: '⭐' }]
const activeCategory = ref('latest')
// 3. 点击侧边栏“战友”按钮的处理函数
const handleFriendClick = () => {
    activeCategory.value = 'friends' // 切换右侧视图为“战友”
    // 可选：自动滚动到内容区顶部
    scrollToContent()
}
// 4. 模拟友链数据 (后续接API)
const friendLinks = ref([
    { id: 1, name: 'Poetize', desc: '一个很棒的博客主题', avatar: 'https://poetize.cn/favicon.ico', link: 'https://poetize.cn' },
    { id: 2, name: 'Vue.js', desc: '渐进式 JavaScript 框架', avatar: 'https://vuejs.org/images/logo.png', link: 'https://vuejs.org' },
    { id: 3, name: 'Vite', desc: '下一代前端工具链', avatar: 'https://vitejs.dev/logo.svg', link: 'https://vitejs.dev' }
])
const articles = ref(Array.from({ length: 6 }, (_, i) => ({ id: i + 1, title: `探索未知的真理 v${4.0 + i}`, summary: '生活总是充满了未知的惊喜...', cover: `https://picsum.photos/600/400?random=${i}`, created_at: '2025-12-12', category: '最新', views: 1024 + i * 100, comments: 5 + i })))
const notices = ref([{ id: 1, content: '🎉 欢迎访问 Veritas 的个人博客！', color: '#ff6b6b' }, { id: 2, content: '💻 网站正在重构优化中...', color: '#42b883' }])

onMounted(async () => {
    // 🔥 关键：页面加载时，主动检查一次登录状态
    // 如果你在 App.vue 里已经检查过了，这里是为了双重保险，确保 store 数据是最新的
    if (!userStore.user) {
        await userStore.checkLoginStatus()
    }

    initWallpapers()
    startTyping()
})

onUnmounted(() => {
    if (carouselTimer) clearInterval(carouselTimer)
    if (typeTimer) clearInterval(typeTimer)
})
</script>

<template>
    <div class="blog-page">

        <header class="hero-section" :style="{ backgroundImage: `url(${heroBgUrl})` }">
            <div class="hero-overlay"></div>

            <div class="hero-content animate__animated animate__fadeInDown">
                <h1 class="main-title">看见真理</h1>
                <div class="typewriter-container">
                    <span class="sub-title">{{ typedText }}</span>
                    <span class="cursor">|</span>
                </div>
            </div>

            <div class="scroll-down-btn" @click="scrollToContent">
                <svg class="scroll-arrow" viewBox="0 0 24 24">
                    <path d="M7 10l5 5 5-5z" fill="currentColor" />
                </svg>
            </div>

            <div class="hero-waves">
                <svg class="waves" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
                    viewBox="0 24 150 28" preserveAspectRatio="none" shape-rendering="auto">
                    <defs>
                        <path id="gentle-wave"
                            d="M-160 44c30 0 58-18 88-18s 58 18 88 18 58-18 88-18 58 18 88 18 v44h-352z" />
                    </defs>
                    <g class="parallax">
                        <use xlink:href="#gentle-wave" x="48" y="0" fill="rgba(245, 247, 250, 0.7)" />
                        <use xlink:href="#gentle-wave" x="48" y="3" fill="rgba(245, 247, 250, 0.5)" />
                        <use xlink:href="#gentle-wave" x="48" y="5" fill="rgba(245, 247, 250, 0.3)" />
                        <use xlink:href="#gentle-wave" x="48" y="7" fill="#f5f7fa" />
                    </g>
                </svg>
            </div>
        </header>

        <div id="blog-content-anchor"></div>

        <main class="main-container">
            <aside class="sidebar-wrapper animate__animated animate__fadeInLeft">

                <div class="sidebar-card profile-card">
                    <div class="profile-bg"></div>

                    <div class="avatar-box" @click="handleAvatarClick">
                        <img :src="profile.avatar" alt="Avatar" class="avatar">
                    </div>

                    <div class="profile-meta">
                        <h2 class="author-name">{{ profile.name }}</h2>
                        <p class="author-title">{{ profile.title }}</p>
                    </div>

                    <div class="stats-box">
                        <div class="stat-item">
                            <span class="stat-icon">📖</span>
                            <span class="label">文章</span>
                            <span class="num">{{ profile.articlesCount }}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-icon">🗂️</span>
                            <span class="label">分类</span>
                            <span class="num">{{ profile.categoryCount }}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-icon">🔥</span>
                            <span class="label">访问</span>
                            <span class="num">{{ profile.visits }}</span>
                        </div>
                    </div>

                    <div class="btn-container">
                        <div v-if="profile.isLogin" class="friend-link-btn" @click="handleFriendClick">
                            <span>🤝 战友</span>
                        </div>

                        <router-link v-else to="/login" class="friend-link-btn login-btn">
                            <span>🚀 登录</span>
                        </router-link>
                    </div>
                </div>

                <div class="sidebar-card notice-card">
                    <div class="card-header">
                        <span class="icon-bell">🔔</span>
                        <span class="header-text">公告栏</span>
                    </div>
                    <div class="notice-list">
                        <div v-for="notice in notices" :key="notice.id" class="notice-item">
                            {{ notice.content }}
                        </div>
                    </div>
                </div>

            </aside>

            <section class="content-wrapper animate__animated animate__fadeInUp">
                <div class="category-bar">
                    <div class="bar-title"><span class="icon">🧭</span> 发现</div>
                    <div class="cat-list">
                        <div v-for="cat in categories" :key="cat.id" class="cat-item"
                            :class="{ active: activeCategory === cat.id }" @click="activeCategory = cat.id">
                            <span class="cat-icon">{{ cat.icon }}</span> {{ cat.name }}
                        </div>
                    </div>
                </div>

                <div v-if="activeCategory === 'friends'" class="friend-grid">
                    <div v-for="friend in friendLinks" :key="friend.id" class="friend-card"
                        @click="window.open(friend.link, '_blank')">
                        <img :src="friend.avatar" class="friend-avatar" alt="icon">
                        <div class="friend-info">
                            <h4>{{ friend.name }}</h4>
                            <p>{{ friend.desc }}</p>
                        </div>
                    </div>
                </div>

                <div class="article-grid">
                    <div v-for="article in articles" :key="article.id" class="article-card">
                        <div class="card-cover">
                            <router-link :to="'/article/' + article.id">
                                <img :src="article.cover" alt="cover">
                            </router-link>
                            <span class="card-tag">{{ article.category }}</span>
                        </div>
                        <div class="card-info">
                            <div class="publish-time">📅 {{ article.created_at }}</div>
                            <h3 class="title">
                                <router-link :to="'/article/' + article.id">{{ article.title }}</router-link>
                            </h3>
                            <p class="summary">{{ article.summary }}</p>
                            <div class="card-footer">
                                <div class="meta">
                                    <span>🔥 {{ article.views }}</span>
                                    <span>💬 {{ article.comments }}</span>
                                </div>
                                <router-link :to="'/article/' + article.id" class="read-btn">阅读全文</router-link>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </main>

        <footer class="page-footer">
            <p>Designed with ❤️ by {{ profile.name }}</p>
            <p>© 2025 Veritas Blog. All Rights Reserved.</p>
        </footer>
    </div>
</template>

<style scoped>
/* ==================== 1. Hero 区域 ==================== */
.blog-page {
    font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', sans-serif;
    background-color: #ffffff;
    min-height: 100vh;
}

.hero-section {
    position: relative;
    width: 100%;
    height: 65vh;
    /* 保持你满意的 2/3 屏 */
    min-height: 500px;
    display: flex;
    justify-content: center;
    align-items: center;
    color: white;
    text-align: center;
    background-size: cover;
    background-position: center;
    background-attachment: fixed;
    background-color: #333;
    transition: background-image 1s ease-in-out;
}

.hero-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
    z-index: 0;
}

.hero-content {
    position: relative;
    z-index: 1;
    margin-top: -40px;
}

.main-title {
    font-size: 4rem;
    font-weight: 700;
    letter-spacing: 12px;
    margin: 0 0 20px 0;
    text-shadow: 0 5px 15px rgba(0, 0, 0, 0.5);
    font-family: 'Georgia', serif;
}

.typewriter-container {
    display: inline-block;
    padding: 10px 28px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 50px;
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
}

.sub-title {
    font-size: 1.2rem;
    font-weight: 400;
    letter-spacing: 3px;
    color: #fff;
    text-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
}

.cursor {
    display: inline-block;
    margin-left: 5px;
    font-weight: 100;
    animation: blink 1s step-end infinite;
}

@keyframes blink {

    0%,
    100% {
        opacity: 1;
    }

    50% {
        opacity: 0;
    }
}

.scroll-down-btn {
    position: absolute;
    bottom: 120px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2;
    cursor: pointer;
    animation: bounce 2s infinite;
}

.scroll-arrow {
    width: 32px;
    height: 32px;
    color: rgba(255, 255, 255, 0.8);
    transition: color 0.3s;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
}

.scroll-down-btn:hover .scroll-arrow {
    color: #42b883;
}

@keyframes bounce {

    0%,
    20%,
    50%,
    80%,
    100% {
        transform: translate(-50%, 0);
    }

    40% {
        transform: translate(-50%, -10px);
    }

    60% {
        transform: translate(-50%, -5px);
    }
}

/* 波浪容器样式优化 */
.hero-waves {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 100px;
    /* 波浪区域的高度，可以根据喜好微调 */
    z-index: 5;
    overflow: hidden;
    /* 防止波浪溢出 */
}

.waves {
    position: relative;
    width: 100%;
    height: 100%;
    margin-bottom: -7px;
    /* 修复某些分辨率下底部出现的微小缝隙 */
}

/* ----- 核心动画定义 ----- */

/* 所有波浪层共用的基础动画 */
.parallax>use {
    /* 应用名为 move-forever 的动画，总时长25s，无限循环，贝塞尔曲线使运动更柔和 */
    animation: move-forever 25s cubic-bezier(.55, .5, .45, .5) infinite;
}

/* 分别设置每一层的动画延迟和持续时间，制造视差效果 */
/* 第1层：最快 */
.parallax>use:nth-child(1) {
    animation-delay: -2s;
    /* 提前开始，防止初始加载时的跳跃 */
    animation-duration: 7s;
}

/* 第2层 */
.parallax>use:nth-child(2) {
    animation-delay: -3s;
    animation-duration: 10s;
}

/* 第3层 */
.parallax>use:nth-child(3) {
    animation-delay: -4s;
    animation-duration: 13s;
}

/* 第4层：最慢 */
.parallax>use:nth-child(4) {
    animation-delay: -5s;
    animation-duration: 20s;
}

/* 定义波浪水平移动的关键帧 */
@keyframes move-forever {
    0% {
        /* 初始位置 */
        transform: translate3d(-90px, 0, 0);
    }

    100% {
        /* 结束位置，移动距离经过计算以确保无缝循环 */
        transform: translate3d(85px, 0, 0);
    }
}

/* ==================== 2. 主体布局 ==================== */
.main-container {
    max-width: 1300px;
    margin: 0 auto;
    padding: 40px 20px;
    display: flex;
    gap: 30px;
    background-color: #ffffff;
    min-height: 800px;
}

.sidebar-wrapper {
    width: 300px;
    /* 稍微加宽一点，让信息更舒展 */
    flex-shrink: 0;
    position: sticky;
    top: 80px;
    /* 悬浮固定 */
    height: fit-content;
    z-index: 10;
}

.content-wrapper {
    flex: 1;
}

/* ==================== 3. 卡片通用样式 (悬浮感) ==================== */
.sidebar-card,
.article-card,
.category-bar {
    background: #fff;
    border-radius: 12px;
    /* ⚡️ 优化阴影：更柔和，像 Poetize */
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.05);
    transition: all 0.3s ease;
    border: 1px solid #f0f0f0;
    /* 极细边框 */
    overflow: hidden;
}

.sidebar-card {
    margin-bottom: 25px;
}

/* 悬停上浮效果 */
.sidebar-card:hover,
.article-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 5px 20px rgba(0, 0, 0, 0.1);
}

/* ==================== 侧边栏精修 (Poetize Style) ==================== */

/* 卡片通用容器 */
.sidebar-card {
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
    margin-bottom: 20px;
    overflow: hidden;
    transition: all 0.3s ease;
    border: 1px solid #f0f0f0;
    /* 极细的边框增加质感 */
}

.sidebar-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
}

/* --- 1. 个人资料卡片 --- */
.profile-card {
    position: relative;
    padding-bottom: 25px;
}

/* 顶部背景图 */
.profile-bg {
    height: 110px;
    background-image: linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%);
    /* 清新蓝绿渐变 */
    /* 或者用图片：background-image: url('...'); background-size: cover; */
}

/* 头像 */
.avatar-box {
    width: 80px;
    height: 80px;
    margin: -40px auto 10px;
    /* 向上浮动 */
    border-radius: 50%;
    border: 4px solid #fff;
    overflow: hidden;
    transition: transform 0.5s ease;
    cursor: pointer;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
}

.profile-card:hover .avatar-box {
    transform: rotate(360deg);
    /* 经典的旋转动效 */
}

.avatar {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

/* 名字和简介 */
.profile-meta {
    text-align: center;
    margin-bottom: 20px;
}

.author-name {
    font-size: 1.4rem;
    font-weight: 700;
    color: #333;
    letter-spacing: 1px;
}

.author-title {
    font-size: 0.85rem;
    color: #999;
    margin-top: 4px;
}

/* 数据统计栏 (核心美化) */
.stats-box {
    display: flex;
    justify-content: space-around;
    padding: 0 15px;
    margin-bottom: 25px;
}

.stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    transition: transform 0.2s;
}

.stat-item:hover {
    transform: translateY(-2px);
}

.stat-icon {
    font-size: 1.2rem;
    margin-bottom: 4px;
}

.label {
    font-size: 0.8rem;
    color: #888;
    margin-bottom: 2px;
}

.num {
    font-weight: 700;
    color: #333;
    font-size: 1.1rem;
    font-family: 'Arial', sans-serif;
}

/* 按钮容器 */
.btn-container {
    text-align: center;
}

/* 友链按钮 (Poetize 标志性的青色) */
.friend-link-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 80%;
    height: 38px;
    border-radius: 50px;
    text-decoration: none;
    font-size: 0.95rem;
    font-weight: 600;
    color: white;
    transition: all 0.3s;
    /* 这是 Poetize 主题经典的青绿色渐变 */
    background: linear-gradient(90deg, #42d392, #647eff);
    box-shadow: 0 4px 10px rgba(66, 211, 146, 0.3);
}

.friend-link-btn:hover {
    box-shadow: 0 6px 15px rgba(66, 211, 146, 0.5);
    transform: scale(1.02);
}

/* 未登录状态的按钮 */
.login-btn {
    background: linear-gradient(90deg, #3a8ee6, #0052d9);
    box-shadow: 0 4px 10px rgba(0, 82, 217, 0.3);
}

/* --- 2. 公告卡片 --- */
.notice-card {
    padding: 20px;
}

.card-header {
    font-size: 1rem;
    font-weight: 700;
    color: #4c4948;
    margin-bottom: 15px;
    display: flex;
    align-items: center;
    gap: 8px;
    border-bottom: 1px dashed #eee;
    /* 虚线分割更精致 */
    padding-bottom: 10px;
}

.icon-bell {
    animation: swing 2s infinite;
    display: inline-block;
}

@keyframes swing {

    0%,
    100% {
        transform: rotate(0deg);
    }

    20% {
        transform: rotate(15deg);
    }

    40% {
        transform: rotate(-10deg);
    }

    60% {
        transform: rotate(5deg);
    }

    80% {
        transform: rotate(-5deg);
    }
}

.notice-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.notice-item {
    font-size: 0.9rem;
    color: #666;
    background: #fbfbfb;
    padding: 10px;
    border-radius: 6px;
    border-left: 3px solid #42d392;
    /* 左侧绿色竖线 */
    line-height: 1.5;
    transition: all 0.3s;
}

.notice-item:hover {
    background: #f0f9f4;
    transform: translateX(3px);
}

/* ==================== 5. 左侧：公告卡片 ==================== */
.notice-card {
    padding: 20px;
}

.card-header {
    font-size: 1.1rem;
    font-weight: 700;
    color: #333;
    margin-bottom: 15px;
    display: flex;
    align-items: center;
    gap: 8px;
    border-bottom: 1px solid #f5f5f5;
    padding-bottom: 10px;
}

.icon {
    color: #f00;
    animation: shake 2s infinite;
}

/* 小喇叭抖动 */
@keyframes shake {

    0%,
    100% {
        transform: rotate(0)
    }

    25% {
        transform: rotate(10deg)
    }

    75% {
        transform: rotate(-10deg)
    }
}

.notice-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.notice-item {
    font-size: 0.9rem;
    color: #555;
    background: #f9f9f9;
    padding: 10px 14px;
    border-radius: 8px;
    border-left: 4px solid #ccc;
    line-height: 1.6;
    transition: transform 0.2s;
}

.notice-item:hover {
    transform: translateX(5px);
    background: #f0f0f0;
}

/* ==================== 6. 右侧：文章网格优化 ==================== */
.category-bar {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 15px 25px;
    margin-bottom: 25px;
    flex-wrap: wrap;
    /* 小屏自动换行 */
}

.bar-title {
    font-weight: 700;
    color: #333;
    font-size: 1.1rem;
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 60px;
}

.cat-list {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
}

.cat-item {
    font-size: 0.95rem;
    color: #666;
    cursor: pointer;
    padding: 6px 14px;
    border-radius: 20px;
    /* 圆角标签 */
    transition: all 0.3s;
    display: flex;
    align-items: center;
    gap: 5px;
    border: 1px solid transparent;
}

.cat-item:hover {
    color: #42b883;
    background: rgba(66, 184, 131, 0.1);
}

.cat-item.active {
    color: white;
    background: linear-gradient(90deg, #42b883, #35495e);
    /* 选中变色 */
    box-shadow: 0 4px 10px rgba(66, 184, 131, 0.3);
}

.article-grid {
    display: grid;
    /* 自动填充：每列最小 300px，展示更清晰 */
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 25px;
}

.article-card {
    display: flex;
    flex-direction: column;
    height: 100%;
    position: relative;
}

/* 封面图优化 */
.card-cover {
    height: 200px;
    /* 加高一点 */
    position: relative;
    overflow: hidden;
}

.card-cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.article-card:hover .card-cover img {
    transform: scale(1.1);
}

/* 标签优化 */
.card-tag {
    position: absolute;
    top: 10px;
    left: 10px;
    background: linear-gradient(90deg, #42b883, #2c3e50);
    color: white;
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
    z-index: 2;
}

.card-info {
    padding: 20px;
    flex: 1;
    display: flex;
    flex-direction: column;
}

.publish-time {
    font-size: 0.8rem;
    color: #aaa;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 5px;
}

.title {
    margin: 0 0 10px;
    line-height: 1.4;
    font-size: 1.2rem;
    font-weight: 700;
}

.title a {
    text-decoration: none;
    color: #333;
    transition: color 0.2s;
}

.title a:hover {
    color: #42b883;
}

.summary {
    font-size: 0.95rem;
    color: #666;
    line-height: 1.6;
    margin-bottom: 20px;
    flex-grow: 1;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 15px;
    border-top: 1px solid #f0f0f0;
}

.meta {
    display: flex;
    gap: 15px;
    font-size: 0.85rem;
    color: #999;
}

.meta span {
    display: flex;
    align-items: center;
    gap: 4px;
}

.read-btn {
    color: #42b883;
    font-size: 0.9rem;
    font-weight: 600;
    text-decoration: none;
    transition: transform 0.2s;
}

.read-btn:hover {
    transform: translateX(3px);
}

/* ==================== 7. Footer & Responsive ==================== */
.page-footer {
    text-align: center;
    padding: 40px;
    background: #2c3e50;
    color: rgba(255, 255, 255, 0.6);
    margin-top: 60px;
}

@media (max-width: 900px) {
    .main-container {
        flex-direction: column;
    }

    .sidebar-wrapper {
        width: 100%;
        position: static;
    }

    .hero-section {
        height: 50vh;
    }

    .hero-waves {
        height: 80px;
    }

    .article-grid {
        grid-template-columns: 1fr;
    }
}

/* 友链网格 */
.friend-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 20px;
}

/* 友链卡片 */
.friend-card {
    background: #fff;
    border-radius: 12px;
    padding: 20px;
    display: flex;
    align-items: center;
    gap: 15px;
    border: 1px solid #f0f0f0;
    transition: all 0.3s ease;
    cursor: pointer;
}

.friend-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
    border-color: #42b883;
}

.friend-avatar {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    object-fit: cover;
}

.friend-info h4 {
    margin: 0 0 5px;
    font-size: 1rem;
    color: #333;
}

.friend-info p {
    margin: 0;
    font-size: 0.8rem;
    color: #888;
}
</style>