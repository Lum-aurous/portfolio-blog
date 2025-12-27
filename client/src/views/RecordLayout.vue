<script setup>
import { ref, watch, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '@/utils/api'
import Navbar from '@/components/Navbar.vue'
import Footer from '@/components/Footer.vue'

const route = useRoute()
const router = useRouter()

// ==================== 1. 页面配置字典 ====================
// 这里定义每个子页面的独有属性：标题、描述、背景图、对应的后端分类名
const pageConfigs = {
    life: {
        title: '生活倒影',
        subtitle: 'Life Reflection',
        desc: '记录平凡生活中的微光与感动。',
        category: '生活倒影', // 🔥 对应数据库 articles.category
        banner: 'https://images.unsplash.com/photo-1496345962527-29157319e487?q=80&w=2070', // 咖啡/生活风
        icon: '☕'
    },
    media: {
        title: '视听盛宴',
        subtitle: 'Audiovisual Feast',
        desc: '那些触动心弦的电影、音乐与剧集。',
        category: '视听盛宴',
        banner: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=2070', // 音乐/电影风
        icon: '🎬'
    },
    study: {
        title: '学习人生',
        subtitle: 'Learning Path',
        desc: '学无止境，记录技术成长的每一步。',
        category: '学习人生',
        banner: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?q=80&w=1973', // 书籍/代码风
        icon: '📚'
    },
    travel: {
        title: '海外趣事',
        subtitle: 'Global Fun',
        desc: '世界那么大，不仅有风景，还有故事。',
        category: '海外趣事',
        banner: 'https://images.unsplash.com/photo-1500835556837-99ac94a94552?q=80&w=1965', // 旅行/趣闻风
        icon: '🌍'
    },
    resources: {
        title: '爱心资源',
        subtitle: 'Shared Resources',
        desc: '赠人玫瑰，手有余香。精选干货分享。',
        category: '爱心资源',
        banner: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?q=80&w=2070', // 科技/分享风
        icon: '🎁'
    }
}

// 当前页面的配置对象
const currentConfig = computed(() => {
    const type = route.params.type
    return pageConfigs[type] || pageConfigs.life // 默认兜底
})

// ==================== 2. 数据获取逻辑 ====================
const isLoading = ref(true)
const articles = ref([])
const page = ref(1)
const hasMore = ref(true)

const getProxyUrl = (url) => {
    if (!url) return 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=500'
    if (url.startsWith('http')) return url
    const isDev = import.meta.env.VITE_APP_ENV === 'development'
    const apiBase = isDev ? 'http://localhost:3000' : window.location.origin
    if (url.startsWith('/uploads') || url.startsWith('/')) {
        return `${apiBase}${url.startsWith('/') ? '' : '/'}${url}`
    }
    return `/api/proxy-image?url=${encodeURIComponent(url)}`
}

const fetchData = async (isLoadMore = false) => {
    if (!isLoadMore) {
        isLoading.value = true
        page.value = 1
        articles.value = []
    }

    try {
        const res = await api.get('/articles', {
            params: {
                category: currentConfig.value.category, // 🔥 核心：根据配置传分类
                page: page.value,
                limit: 10
            }
        })

        if (res.data.success) {
            const list = res.data.data.list
            if (page.value === 1) {
                articles.value = list
            } else {
                articles.value = [...articles.value, ...list]
            }
            hasMore.value = list.length >= 10
        }
    } catch (err) {
        console.error('获取记录失败:', err)
    } finally {
        isLoading.value = false
    }
}

const loadMore = () => {
    if (!hasMore.value) return
    page.value++
    fetchData(true)
}

const goToDetail = (id) => {
    router.push(`/article/${id}`)
}

// 监听路由变化 (例如从 "生活" 点击菜单跳到 "学习")
// 必须监听，否则组件复用时不会重新请求数据
watch(() => route.params.type, (newType) => {
    if (newType && pageConfigs[newType]) {
        fetchData()
        // 动态修改网页标题
        document.title = `${currentConfig.value.title} - Veritas`
    }
}, { immediate: true })

onMounted(() => {
    // 初始设置一次标题
    document.title = `${currentConfig.value.title} - Veritas`
})
</script>

<template>
    <div class="record-page">
        <Navbar />

        <header class="record-hero" :style="{ backgroundImage: `url(${currentConfig.banner})` }">
            <div class="hero-mask"></div>
            <div class="hero-content animate__animated animate__fadeInUp">
                <div class="category-icon">{{ currentConfig.icon }}</div>
                <h1 class="hero-title">{{ currentConfig.title }}</h1>
                <h2 class="hero-subtitle">{{ currentConfig.subtitle }}</h2>
                <p class="hero-desc">{{ currentConfig.desc }}</p>
            </div>
        </header>

        <main class="record-container">
            <div v-if="isLoading && page === 1" class="loading-box">
                <div class="spinner"></div>
            </div>

            <div v-else-if="articles.length > 0" class="article-grid animate__animated animate__fadeInUp">
                <div v-for="item in articles" :key="item.id" class="article-card" @click="goToDetail(item.id)">
                    <div class="card-thumb">
                        <img :src="getProxyUrl(item.cover_image)" loading="lazy">
                        <span class="card-date">
                            {{ new Date(item.created_at).toLocaleDateString() }}
                        </span>
                    </div>
                    <div class="card-body">
                        <h3 class="card-title">{{ item.title }}</h3>
                        <p class="card-summary">{{ item.summary }}</p>
                        <div class="card-footer">
                            <span class="meta-item">👁️ {{ item.views }}</span>
                            <span class="meta-item">💬 {{ item.comments }}</span>
                            <span class="read-more">阅读全文 →</span>
                        </div>
                    </div>
                </div>
            </div>

            <div v-else class="empty-state">
                <span class="empty-emoji">🍃</span>
                <p>这里暂时还是一片荒原...</p>
                <router-link :to="{ path: '/creation-center', query: { category: currentConfig.category } }"
                    class="go-create-btn">
                    去耕耘
                </router-link>
            </div>

            <div v-if="articles.length > 0 && hasMore" class="load-more-wrapper">
                <button class="load-more-btn" @click="loadMore" :disabled="isLoading">
                    {{ isLoading ? 'Loading...' : '加载更多' }}
                </button>
            </div>

            <div v-if="!hasMore && articles.length > 0" class="end-mark">
                - THE END -
            </div>
        </main>
    </div>
</template>

<style scoped>
.record-page {
    background-color: #f9fbfd;
    min-height: 100vh;
    font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', sans-serif;
}

/* --- Hero Section --- */
.record-hero {
    height: 50vh;
    min-height: 400px;
    background-size: cover;
    background-position: center;
    background-attachment: fixed;
    /* 视差滚动 */
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    color: white;
    text-align: center;
}

.hero-mask {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    /* 深色遮罩 */
    backdrop-filter: blur(2px);
}

.hero-content {
    position: relative;
    z-index: 1;
    padding: 0 20px;
}

.category-icon {
    font-size: 3rem;
    margin-bottom: 15px;
    animation: bounceIn 1s;
}

.hero-title {
    font-size: 3rem;
    font-weight: 800;
    letter-spacing: 4px;
    margin-bottom: 5px;
    text-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
}

.hero-subtitle {
    font-size: 1.2rem;
    font-weight: 300;
    opacity: 0.9;
    letter-spacing: 2px;
    margin-bottom: 20px;
    text-transform: uppercase;
}

.hero-desc {
    font-size: 1rem;
    opacity: 0.8;
    max-width: 600px;
    margin: 0 auto;
    line-height: 1.6;
}

/* --- Content Container --- */
.record-container {
    max-width: 1200px;
    margin: -60px auto 40px;
    /* 上移效果 */
    padding: 0 20px;
    position: relative;
    z-index: 2;
}

/* --- Article Grid --- */
.article-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 30px;
}

.article-card {
    background: white;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    cursor: pointer;
    border: 1px solid rgba(0, 0, 0, 0.02);
}

.article-card:hover {
    transform: translateY(-8px);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
}

.card-thumb {
    height: 200px;
    position: relative;
    overflow: hidden;
}

.card-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.5s;
}

.article-card:hover .card-thumb img {
    transform: scale(1.08);
}

.card-date {
    position: absolute;
    top: 15px;
    left: 15px;
    background: rgba(0, 0, 0, 0.6);
    color: white;
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 0.8rem;
    backdrop-filter: blur(4px);
}

.card-body {
    padding: 25px;
}

.card-title {
    font-size: 1.2rem;
    font-weight: 700;
    color: #333;
    margin-bottom: 12px;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
}

.card-summary {
    font-size: 0.9rem;
    color: #666;
    line-height: 1.6;
    margin-bottom: 20px;
    height: 46px;
    /* 限制高度 */
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
}

.card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid #f0f0f0;
    padding-top: 15px;
    font-size: 0.85rem;
    color: #999;
}

.read-more {
    color: #42b883;
    font-weight: 600;
    transition: transform 0.2s;
}

.article-card:hover .read-more {
    transform: translateX(5px);
}

/* --- Utilities --- */
.loading-box {
    display: flex;
    justify-content: center;
    padding: 100px;
}

.spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #f3f3f3;
    border-top: 3px solid #42b883;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% {
        transform: rotate(0deg);
    }

    100% {
        transform: rotate(360deg);
    }
}

.empty-state {
    text-align: center;
    padding: 100px 0;
    color: #999;
}

.empty-emoji {
    font-size: 4rem;
    display: block;
    margin-bottom: 10px;
}

.go-create-btn {
    display: inline-block;
    margin-top: 20px;
    padding: 10px 30px;
    background: #42b883;
    color: white;
    border-radius: 50px;
    text-decoration: none;
    font-weight: 600;
    transition: 0.3s;
}

.go-create-btn:hover {
    background: #3aa876;
    transform: translateY(-2px);
}

.load-more-wrapper {
    text-align: center;
    margin-top: 40px;
}

.load-more-btn {
    padding: 10px 40px;
    background: white;
    border: 1px solid #eee;
    border-radius: 50px;
    color: #666;
    cursor: pointer;
    transition: 0.3s;
}

.load-more-btn:hover {
    border-color: #42b883;
    color: #42b883;
}

.end-mark {
    text-align: center;
    color: #ccc;
    margin-top: 40px;
    letter-spacing: 2px;
    font-size: 0.8rem;
}

@keyframes bounceIn {
    0% {
        transform: scale(0.3);
        opacity: 0;
    }

    50% {
        transform: scale(1.05);
    }

    70% {
        transform: scale(0.9);
    }

    100% {
        transform: scale(1);
        opacity: 1;
    }
}
</style>