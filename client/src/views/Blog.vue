<script setup>
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue'
import axios from 'axios'
import { useUserStore } from '@/stores/user.js'
import { useRouter } from 'vue-router'

const userStore = useUserStore()
const router = useRouter()

// ==================== 1. 用户信息逻辑 ====================
const defaultAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200&auto=format&fit=crop'

const getFullAvatarUrl = (path) => {
    if (!path) return defaultAvatar
    if (path.startsWith('data:image') || path.startsWith('http')) return path
    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
    return `${apiBase}${path}`
}

const profile = computed(() => {
    if (userStore.user && userStore.user.username) {
        return {
            isLogin: true,
            name: userStore.user.nickname || userStore.user.username,
            title: userStore.user.bio || '全栈开发者 / 追梦人',
            avatar: getFullAvatarUrl(userStore.user.avatar),
            articlesCount: 108,
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

// ==================== 2. 动态轮播背景逻辑 ====================
const heroBgUrl = ref('')
const bgIndex = ref(0)
const wallpaperList = ref([])
const fallbackList = [
    'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?q=80&w=2000&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1511300636408-a63a6ad120de?q=80&w=2000&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2000&auto=format&fit=crop'
]
let carouselTimer = null

const preloadImage = (url) => new Promise((resolve, reject) => {
    const img = new Image()
    img.src = url
    img.onload = () => resolve(url)
    img.onerror = () => reject(url)
})

const initWallpapers = async () => {
    try {
        const res = await axios.get('/api/wallpaper/global')
        const list = res.data.data?.randomUrls || res.data.randomUrls
        if (list && list.length > 0) {
            wallpaperList.value = list
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

// ==================== 3. 3D 标签云逻辑 ====================
const rawTags = [
    { id: 1, name: 'SpringCloud', color: '#ff9800' },
    { id: 2, name: 'Dubbo', color: '#4caf50' },
    { id: 3, name: 'MyBatis', color: '#8bc34a' },
    { id: 4, name: 'Redis', color: '#f44336' },
    { id: 5, name: 'MySQL', color: '#2196f3' },
    { id: 6, name: 'Java', color: '#795548' },
    { id: 7, name: 'SpringBoot', color: '#4caf50' },
    { id: 8, name: 'Python', color: '#ffc107' },
    { id: 9, name: 'Docker', color: '#03a9f4' },
    { id: 10, name: 'Vue.js', color: '#009688' },
    { id: 11, name: 'React', color: '#00bcd4' },
    { id: 12, name: 'Git', color: '#ff5722' },
    { id: 13, name: 'Linux', color: '#607d8b' },
    { id: 14, name: 'Nginx', color: '#009688' },
    { id: 15, name: '使用指南', color: '#3f51b5' },
    { id: 16, name: '万卷书', color: '#9c27b0' },
    { id: 17, name: '西游记', color: '#673ab7' },
    { id: 18, name: '人间百态', color: '#e67e22' },
    { id: 19, name: '八次危机', color: '#e91e63' },
]

const tags = ref([])
let animationFrameId = null

// 3D 配置
const RADIUS = 140
const BASE_SPEED = 0.005
const ACCELERATION = 0.0001
let currentSpeed = 0
let angleX = 0
let angleY = 0

const init3DTags = () => {
    const len = rawTags.length
    tags.value = rawTags.map((tag, i) => {
        const phi = Math.acos(-1 + (2 * i) / len)
        const theta = Math.sqrt(len * Math.PI) * phi
        return {
            ...tag,
            x: RADIUS * Math.cos(theta) * Math.sin(phi),
            y: RADIUS * Math.sin(theta) * Math.sin(phi),
            z: RADIUS * Math.cos(phi),
            style: {}
        }
    })
}

const animate = () => {
    if (currentSpeed < BASE_SPEED) currentSpeed += ACCELERATION
    angleX += currentSpeed
    angleY += currentSpeed

    tags.value.forEach(tag => {
        rotateTag(tag, currentSpeed, currentSpeed)
    })
    animationFrameId = requestAnimationFrame(animate)
}

const rotateTag = (tag, speedX, speedY) => {
    const cosX = Math.cos(speedX), sinX = Math.sin(speedX)
    const cosY = Math.cos(speedY), sinY = Math.sin(speedY)

    const y1 = tag.y * cosY - tag.z * sinY
    const z1 = tag.y * sinY + tag.z * cosY
    const x2 = tag.x * cosX - z1 * sinX
    const z2 = tag.x * sinX + z1 * cosX

    tag.y = y1
    tag.z = z2
    tag.x = x2

    const scale = (400 + tag.z) / 400
    const alpha = (tag.z + RADIUS) / (2 * RADIUS)

    tag.style = {
        transform: `translate3d(${tag.x + 130}px, ${tag.y + 180}px, 0) scale(${scale})`,
        opacity: 0.5 + 0.5 * alpha,
        zIndex: Math.floor(scale * 100),
        '--tag-color': tag.color
    }
}

const handleTagClick = (tag) => {
    selectedTagId.value = tag.id === selectedTagId.value ? null : tag.id
    scrollToContent()
}

// ==================== 4. 文章与分类逻辑 ====================
const categories = [
    { id: 'latest', name: '最新', icon: '🔥' },
    { id: 'veritas', name: 'Veritas', icon: '🪐' },
    { id: 'life', name: '生活倒影', icon: '☕' },
    { id: 'visual', name: '视听盛宴', icon: '🎬' },
    { id: 'study', name: '学习人生', icon: '📚' },
    { id: 'abroad', name: '海外趣事', icon: '🌍' },
    { id: 'love', name: '爱心资源', icon: '❤️' },
    { id: 'friends', name: '战友', icon: '⭐' }
]
const activeCategory = ref('latest')

const articles = ref(Array.from({ length: 6 }, (_, i) => ({
    id: i + 1,
    title: `探索未知的真理 v${4.0 + i}`,
    summary: '生活总是充满了未知的惊喜，我们需要用一颗探索的心去发现真理...',
    cover: `https://picsum.photos/600/400?random=${i}`,
    created_at: '2025-12-12',
    category: '最新',
    views: 1024 + i * 100,
    comments: 5 + i,
    tagId: (i % rawTags.length) + 1
})))

const notices = ref([
    { id: 1, content: '🎉 欢迎访问 Veritas 的个人博客！' },
    { id: 2, content: '💻 网站正在重构优化中，更多功能敬请期待...' }
])

const friendLinks = ref([
    { id: 1, name: 'Poetize', desc: '一个很棒的博客主题', avatar: 'https://poetize.cn/favicon.ico', link: 'https://poetize.cn' },
    { id: 2, name: 'Vue.js', desc: '渐进式 JavaScript 框架', avatar: 'https://vuejs.org/images/logo.png', link: 'https://vuejs.org' },
    { id: 3, name: 'Vite', desc: '下一代前端工具链', avatar: 'https://vitejs.dev/logo.svg', link: 'https://vitejs.dev' }
])

const searchQuery = ref('')
const handleSearch = () => {
    if (!searchQuery.value.trim()) return
    alert(`🔍 正在搜索: ${searchQuery.value}`)
}

const recommendedArticles = ref([
    { id: 101, title: 'POETIZE - 文档导航与网站美化', date: '2024-06-04', cover: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?q=80&w=200&auto=format&fit=crop' },
    { id: 102, title: 'Vue 3 + Vite 实战教程', date: '2022-12-26', cover: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=200&auto=format&fit=crop' },
    { id: 103, title: 'Node.js 后端开发指南', date: '2022-08-21', cover: 'https://images.unsplash.com/photo-1496307667243-6b5d2447d8ef?q=80&w=200&auto=format&fit=crop' }
])

const selectedTagId = ref(null)
const filteredArticles = computed(() => {
    if (activeCategory.value === 'friends') return []
    let result = articles.value
    if (selectedTagId.value) {
        result = result.filter(article => article.tagId === selectedTagId.value)
    }
    return result
})

const handleFriendClick = () => {
    activeCategory.value = 'friends'
    scrollToContent()
}

// ==================== 5. 其他逻辑 ====================
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

onMounted(async () => {
    if (!userStore.user) {
        await userStore.checkLoginStatus()
    }
    initWallpapers()
    startTyping()

    // 3D 标签云启动
    init3DTags()
    nextTick(() => {
        animate()
    })
})

onUnmounted(() => {
    if (carouselTimer) clearInterval(carouselTimer)
    if (typeTimer) clearInterval(typeTimer)
    if (animationFrameId) cancelAnimationFrame(animationFrameId)
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
                        <use xlink:href="#gentle-wave" x="48" y="0" fill="rgba(255, 255, 255, 0.7)" />
                        <use xlink:href="#gentle-wave" x="48" y="3" fill="rgba(255, 255, 255, 0.5)" />
                        <use xlink:href="#gentle-wave" x="48" y="5" fill="rgba(255, 255, 255, 0.3)" />
                        <use xlink:href="#gentle-wave" x="48" y="7" fill="#ffffff" />
                    </g>
                </svg>
            </div>
        </header>

        <div id="blog-content-anchor"></div>

        <main class="main-container">
            <aside class="sidebar-wrapper animate__animated animate__fadeInLeft">
                <div class="sidebar-card profile-card">
                    <div class="profile-header"></div>
                    <div class="avatar-box" @click="handleAvatarClick">
                        <img :src="profile.avatar" alt="Avatar" class="avatar">
                    </div>
                    <div class="profile-meta">
                        <h2 class="author-name">{{ profile.name }}</h2>
                    </div>
                    <div class="stats-box">
                        <div class="stat-item"><span class="stat-icon">📖</span><span class="label">文章</span><span
                                class="num">{{ profile.articlesCount }}</span></div>
                        <div class="stat-item"><span class="stat-icon">🗂️</span><span class="label">分类</span><span
                                class="num">{{ profile.categoryCount }}</span></div>
                        <div class="stat-item"><span class="stat-icon">🔥</span><span class="label">访问</span><span
                                class="num">{{ profile.visits }}</span></div>
                    </div>
                    <div class="btn-container">
                        <div v-if="profile.isLogin" class="poetize-btn" @click="handleFriendClick"><span>☆ 友站</span>
                        </div>
                        <router-link v-else to="/login" class="poetize-btn login-style"><span>🚀 登录</span></router-link>
                    </div>
                </div>

                <div class="sidebar-card search-card">
                    <div class="card-header-row">
                        <div class="header-title"><span class="icon-search">🔍</span><span>搜索</span></div>
                        <div class="mac-dots"><span class="dot red"></span><span class="dot yellow"></span><span
                                class="dot green"></span></div>
                    </div>
                    <div class="search-input-wrapper">
                        <input type="text" v-model="searchQuery" placeholder="搜索文章..." @keyup.enter="handleSearch">
                        <div class="search-icon-btn" @click="handleSearch">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18">
                                <path fill="none" stroke="#dcb76b" stroke-width="3"
                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke-linecap="round"
                                    stroke-linejoin="round" />
                            </svg>
                        </div>
                    </div>
                </div>

                <div class="sidebar-card recommend-card">
                    <div class="card-header-row">
                        <div class="header-title"><span class="icon-thumb">👍</span><span>推荐文章</span></div>
                        <div class="mac-dots"><span class="dot red"></span><span class="dot yellow"></span><span
                                class="dot green"></span></div>
                    </div>
                    <div class="recommend-list">
                        <div v-for="item in recommendedArticles" :key="item.id" class="recommend-item"
                            @click="router.push('/article/' + item.id)">
                            <div class="rec-top-section">
                                <div class="rec-thumb"><img :src="item.cover" alt="cover"></div>
                                <div class="rec-title-box">
                                    <h4 class="rec-title">{{ item.title }}</h4>
                                </div>
                            </div>
                            <div class="rec-bottom-section"><span class="rec-date">📅 {{ item.date }}</span></div>
                        </div>
                    </div>
                </div>

                <div class="sidebar-card tag-card">
                    <div class="card-header-row">
                        <div class="header-title"><span class="icon-tag">🏷️</span><span>标签</span></div>
                        <div class="mac-dots"><span class="dot red"></span><span class="dot yellow"></span><span
                                class="dot green"></span></div>
                    </div>
                    <div class="tag-cloud-3d-box" ref="tagContainer">
                        <div v-for="tag in tags" :key="tag.id" class="tag-pill-3d"
                            :class="{ active: selectedTagId === tag.id }" :style="tag.style"
                            @click="handleTagClick(tag)">
                            <div class="tag-icon-part"><span class="emoji-folder">📂</span></div>
                            <div class="tag-text-part">{{ tag.name }}</div>
                        </div>
                    </div>
                </div>
            </aside>

            <section class="content-wrapper animate__animated animate__fadeInUp">
                <div class="notice-bar">
                    <div class="notice-icon-box">
                        <svg class="notice-svg" viewBox="0 0 1024 1024" width="20" height="20">
                            <path
                                d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372z"
                                fill="#f6a028" />
                            <path
                                d="M686.7 638.6L544.1 535.5V288c0-4.4-3.6-8-8-8H488c-4.4 0-8 3.6-8 8v275.4c0 2.1.8 4.2 2.3 5.7l171.4 128.3c3.5 2.6 8.4 1.9 11-1.6l25.9-34.6c2.7-3.5 1.9-8.4-1.6-11z"
                                fill="#f6a028" />
                        </svg>
                        <span class="notice-label" style="margin-left:5px">公告</span>
                    </div>
                    <div class="notice-content-wrapper">
                        <div class="scroll-text">
                            {{ notices[0].content }}
                        </div>
                    </div>
                </div>

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
                <div v-else class="article-grid">
                    <div v-for="article in filteredArticles" :key="article.id" class="article-card">
                        <div class="card-cover"><router-link :to="'/article/' + article.id"><img :src="article.cover"
                                    alt="cover"></router-link><span class="card-tag">{{ article.category }}</span></div>
                        <div class="card-info">
                            <div class="publish-time">📅 {{ article.created_at }}</div>
                            <h3 class="title"><router-link :to="'/article/' + article.id">{{ article.title
                            }}</router-link></h3>
                            <p class="summary">{{ article.summary }}</p>
                            <div class="card-footer">
                                <div class="meta"><span>🔥 {{ article.views }}</span><span>💬 {{ article.comments
                                }}</span></div><router-link :to="'/article/' + article.id"
                                    class="read-btn">阅读全文</router-link>
                            </div>
                        </div>
                    </div>
                    <div v-if="filteredArticles.length === 0" class="empty-state">📭 该标签下暂无文章...</div>
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
/* ==================== 1. 全局与 Hero 区域 ==================== */
.blog-page {
    font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', sans-serif;
    background-color: #ffffff;
    min-height: 100vh;
}

.hero-section {
    position: relative;
    width: 100%;
    height: 65vh;
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

/* 波浪动画 */
.hero-waves {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 100px;
    z-index: 5;
    overflow: hidden;
}

.waves {
    position: relative;
    width: 100%;
    height: 100%;
    margin-bottom: -7px;
}

.parallax>use {
    animation: move-forever 25s cubic-bezier(.55, .5, .45, .5) infinite;
}

.parallax>use:nth-child(1) {
    animation-delay: -2s;
    animation-duration: 7s;
}

.parallax>use:nth-child(2) {
    animation-delay: -3s;
    animation-duration: 10s;
}

.parallax>use:nth-child(3) {
    animation-delay: -4s;
    animation-duration: 13s;
}

.parallax>use:nth-child(4) {
    animation-delay: -5s;
    animation-duration: 20s;
}

@keyframes move-forever {
    0% {
        transform: translate3d(-90px, 0, 0);
    }

    100% {
        transform: translate3d(85px, 0, 0);
    }
}

/* ==================== 2. 主体布局容器 ==================== */
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
    flex-shrink: 0;
    position: sticky;
    top: 80px;
    height: fit-content;
    z-index: 10;
}

.content-wrapper {
    flex: 1;
    min-width: 0;
}

/* ==================== 3. 侧边栏通用卡片样式 ==================== */
.sidebar-card {
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
    margin-bottom: 20px;
    overflow: hidden;
    transition: all 0.3s ease;
    border: 1px solid #f0f0f0;
}

.sidebar-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
}

/* ==================== 4. 个人资料卡片 ==================== */
.profile-card {
    background: linear-gradient(to bottom, #eef9fe 0%, #fff 100%);
    text-align: center;
    padding-bottom: 30px;
    border: none;
}

.profile-header {
    height: 120px;
    background-image: url('https://images.unsplash.com/photo-1543857770-7245f1c63ddf?auto=format&fit=crop&q=80&w=1000');
    background-size: cover;
    background-position: center;
    mask-image: linear-gradient(to bottom, black 20%, transparent 100%);
    -webkit-mask-image: linear-gradient(to bottom, black 20%, transparent 100%);
    opacity: 0.7;
}

.avatar-box {
    width: 80px;
    height: 80px;
    margin: -40px auto 10px;
    border-radius: 50%;
    border: 4px solid rgba(255, 255, 255, 0.8);
    overflow: hidden;
    transition: transform 0.6s ease;
    cursor: pointer;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
    position: relative;
    z-index: 2;
}

.profile-card:hover .avatar-box {
    transform: rotate(360deg);
}

.avatar {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.profile-meta {
    margin-bottom: 25px;
}

.author-name {
    font-size: 1.8rem;
    font-weight: 800;
    color: #000;
    letter-spacing: 1px;
    font-family: 'Comic Sans MS', 'Chalkboard SE', sans-serif;
}

.stats-box {
    display: flex;
    justify-content: space-around;
    padding: 0 20px;
    margin-bottom: 30px;
}

.stat-item {
    color: #000;
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    transition: transform 0.2s;
    gap: 5px;
}

.stat-item:hover {
    transform: translateY(-2px);
}

.stat-top {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.9rem;
    color: #555;
    font-weight: 500;
}

.stat-icon {
    font-size: 1rem;
}

.num {
    font-size: 1.1rem;
    font-weight: 600;
    color: #000;
}

.btn-container {
    padding: 0 25px;
}

.poetize-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 42px;
    background: #42cba5;
    border-radius: 50px;
    color: white;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 10px rgba(66, 203, 165, 0.3);
}

.poetize-btn:hover {
    background: #3bb391;
    transform: translateY(-2px);
    box-shadow: 0 6px 15px rgba(66, 203, 165, 0.4);
}

.login-style {
    background: #4e8cff;
    box-shadow: 0 4px 10px rgba(78, 140, 255, 0.3);
}

.login-style:hover {
    background: #3a75e6;
}

/* ==================== 5. 搜索 & 推荐卡片 ==================== */
.search-card,
.recommend-card,
.tag-card {
    padding: 15px 20px;
}

.card-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
}

.header-title {
    font-size: 1.1rem;
    font-weight: 700;
    color: #333;
    display: flex;
    align-items: center;
    gap: 6px;
}

.icon-search,
.icon-thumb,
.icon-tag {
    font-size: 1.2rem;
}

.mac-dots {
    display: flex;
    gap: 6px;
}

.dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
}

.red {
    background-color: #ff5f56;
}

.yellow {
    background-color: #ffbd2e;
}

.green {
    background-color: #27c93f;
}

.search-input-wrapper {
    position: relative;
    width: 100%;
    border: 1px solid #e0cda5;
    border-radius: 20px;
    padding: 2px;
    background: white;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
    display: flex;
    align-items: center;
}

.search-input-wrapper input {
    width: 100%;
    padding: 8px 15px;
    border: none;
    outline: none;
    font-size: 0.9rem;
    background: transparent;
    color: #555;
}

.search-input-wrapper input::placeholder {
    color: #aaa;
}

.search-icon-btn {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    cursor: pointer;
    opacity: 0.6;
    transition: all 0.2s;
    display: flex;
}

.search-icon-btn:hover {
    opacity: 1;
    transform: translateY(-50%) scale(1.1);
}

/* ==================== 6. 推荐文章列表 ==================== */
.recommend-list {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.recommend-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
    cursor: pointer;
    border-bottom: 1px dashed #f0f0f0;
    padding-bottom: 15px;
    transition: transform 0.2s;
}

.recommend-item:last-child {
    border-bottom: none;
    padding-bottom: 0;
}

.recommend-item:hover {
    transform: translateX(5px);
}

.recommend-item:hover .rec-title {
    color: #42b883;
}

.rec-top-section {
    display: flex;
    gap: 12px;
    align-items: flex-start;
}

.rec-thumb {
    width: 100px;
    height: 65px;
    border-radius: 6px;
    overflow: hidden;
    flex-shrink: 0;
}

.rec-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s;
}

.recommend-item:hover .rec-thumb img {
    transform: scale(1.1);
}

.rec-title-box {
    flex: 1;
}

.rec-title {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 500;
    color: #333;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    transition: color 0.2s;
}

.rec-bottom-section {
    display: flex;
    align-items: center;
}

.rec-date {
    font-size: 0.75rem;
    color: #999;
}

/* ==================== 🔥 3D 标签云 (球体旋转版) ==================== */
.tag-card {
    background: transparent !important;
    box-shadow: none !important;
    border: none !important;
    padding: 0 !important;
    margin-bottom: 25px;
}

.tag-card .card-header-row {
    background: #fff;
    padding: 12px 20px;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    margin-bottom: 15px;
    border: 1px solid #f5f5f5;
}

.tag-cloud-3d-box {
    position: relative;
    width: 100%;
    height: 400px;
    background: linear-gradient(0deg, #d4fc79 0%, #e8f5e9 100%);
    border-radius: 16px;
    overflow: hidden;
    box-shadow: inset 0 0 40px rgba(255, 255, 255, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.6);
}

.tag-pill-3d {
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    align-items: stretch;
    height: 32px;
    border-radius: 50px;
    cursor: pointer;
    user-select: none;
    border: 1px solid color-mix(in srgb, var(--tag-color), transparent 40%);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
    will-change: transform, opacity, z-index;
    transition: box-shadow 0.3s;
}

.tag-icon-part {
    width: 32px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.45);
    backdrop-filter: blur(4px);
    border-right: 1px solid rgba(255, 255, 255, 0.5);
    border-top-left-radius: 50px;
    border-bottom-left-radius: 50px;
}

.tag-text-part {
    flex-grow: 1;
    padding: 0 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
    background: linear-gradient(135deg, color-mix(in srgb, var(--tag-color), white 10%) 0%, var(--tag-color) 100%);
    color: white;
    font-size: 0.85rem;
    font-weight: 600;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
    border-top-right-radius: 50px;
    border-bottom-right-radius: 50px;
}

.emoji-folder {
    font-size: 1rem;
    filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.1));
}

.tag-pill-3d:hover {
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
    border-color: white;
}

/* ==================== 9. 顶部横幅公告栏 ==================== */
.notice-bar {
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
    margin-bottom: 25px;
    padding: 12px 20px;
    display: flex;
    align-items: center;
    gap: 15px;
    border: 1px solid #f0f0f0;
    transition: transform 0.3s;
    overflow: hidden;
}

.notice-bar:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
}

.notice-icon-box {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 700;
    color: #f6a028;
    flex-shrink: 0;
}

.notice-svg {
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0% {
        transform: scale(1);
    }

    50% {
        transform: scale(1.1);
    }

    100% {
        transform: scale(1);
    }
}

.notice-content-wrapper {
    flex: 1;
    overflow: hidden;
    position: relative;
    height: 24px;
}

.scroll-text {
    white-space: nowrap;
    position: absolute;
    animation: scroll-left 20s linear infinite;
    color: #666;
    font-size: 0.95rem;
    line-height: 24px;
}

@keyframes scroll-left {
    0% {
        transform: translateX(100%);
    }

    100% {
        transform: translateX(-100%);
    }
}

/* ==================== 10. 分类导航栏 ==================== */
.category-bar {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 15px 25px;
    margin-bottom: 25px;
    flex-wrap: wrap;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
    border: 1px solid #f0f0f0;
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
    box-shadow: 0 4px 10px rgba(66, 184, 131, 0.3);
}

/* ==================== 11. 友链区域 ==================== */
.friend-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 20px;
}

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

/* ==================== 12. 文章列表 ==================== */
.article-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 25px;
}

.article-card {
    display: flex;
    flex-direction: column;
    height: 100%;
    position: relative;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
    transition: all 0.3s ease;
    border: 1px solid #f0f0f0;
    overflow: hidden;
}

.article-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 5px 20px rgba(0, 0, 0, 0.1);
}

.card-cover {
    height: 200px;
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

.empty-state {
    text-align: center;
    color: #999;
    padding: 40px;
    font-size: 1.1rem;
    grid-column: 1 / -1;
}

/* ==================== 13. 页脚与响应式 ==================== */
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
</style>