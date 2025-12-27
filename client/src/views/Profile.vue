<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user.js'
import { api } from '@/utils/api'
import { message } from '@/utils/message.js'
import ArticleItem from '@/components/ArticleItem.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const loading = ref(true)
const targetUser = ref({}) // 保持空对象防止报错
const isFollowing = ref(false)
const userArticles = ref([])
const userFavorites = ref([])
const activeTab = ref('posts')
const profileSearchQuery = ref('')

const userColumns = ref([])
const userHistory = ref([])

const bannerInput = ref(null)
const bannerUploading = ref(false)
const defaultBanner = 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?q=80&w=2000&auto=format&fit=crop'

const isMyProfile = computed(() => {
    return userStore.user?.username && route.params.username === userStore.user.username
})

// ==================== 🛠️ 核心修复：路径处理函数 ====================

// 1. 获取 Banner 图片 (修复 NotSameOrigin 问题)
const getFullBannerUrl = (path) => {
    if (!path || path === 'null' || path === 'undefined') return defaultBanner

    // 如果是网络图片，直接返回
    if (path.startsWith('http')) return path

    // 🔥 核心修改：全部转为相对路径，走前端代理
    // 比如：/uploads/xxx.jpg -> /api/uploads/xxx.jpg
    // 浏览器请求 localhost:5173/api/uploads... -> 代理转发给 3000
    // 这样就避开了跨域资源拦截
    let cleanPath = path.startsWith('/') ? path : '/' + path
    if (!cleanPath.startsWith('/api')) {
        cleanPath = '/api' + cleanPath
    }
    return cleanPath
}

// 2. 获取文章/作品封面 (修复同样的问题)
const getProxyUrl = (url) => {
    if (!url || url === 'null' || url === 'undefined') {
        return 'https://images.unsplash.com/photo-1484417894907-623942c8ee29?w=500'
    }
    // 网络图片直接返回
    if (url.startsWith('http') || url.startsWith('data:')) return url

    // 🔥 本地上传的图片，同样走 /api 代理
    if (url.startsWith('/uploads') || url.startsWith('/')) {
        let cleanPath = url.startsWith('/') ? url : '/' + url
        if (!cleanPath.startsWith('/api')) {
            cleanPath = '/api' + cleanPath
        }
        return cleanPath
    }

    // 外部图片代理接口，也走相对路径
    return `/api/proxy-image?url=${encodeURIComponent(url)}`
}

// ==================== 🛠️ 通用数据清洗 ====================
const sanitizeItem = (item) => {
    let type = item.work_type || 'article';
    if (!item.work_type) {
        if (item.audio_url) type = 'audio';
        else if (item.video_url) type = 'video';
    }
    return {
        ...item,
        work_type: type,
        cover_image: item.cover_image || item.cover || item.cover_url || item.poster,
        views: item.views || 0,
        comments: item.comments || 0,
        likes: item.likes || 0
    };
}

const formatJoinedDate = (dateStr) => {
    if (!dateStr) return '加载中...'
    const date = new Date(dateStr)
    return isNaN(date.getTime()) ? '未知' : date.toLocaleDateString()
}

// ==================== 📡 数据获取逻辑 ====================

const fetchTargetUserInfo = async () => {
    try {
        const res = await api.get('/user/profile', {
            params: { username: route.params.username }
        })
        const serverData = (res.data && res.data.success !== undefined) ? res.data : res;

        if (serverData.success) {
            targetUser.value = serverData.data
            // console.log("✅ 用户数据加载成功:", targetUser.value)

            if (serverData.data.navConfig) {
                navMenuConfig.value = serverData.data.navConfig
            }
            if (!isMyProfile.value && userStore.user) {
                checkFollowStatus()
            }
        }
    } catch (error) {
        console.error("❌ 获取用户失败:", error)
    }
}

const fetchUserArticles = async () => {
    loading.value = true
    try {
        const res = await api.get('/articles', {
            params: { author: route.params.username, limit: 50 }
        })
        const serverData = (res.data && res.data.success !== undefined) ? res.data : res;
        if (serverData.success) {
            userArticles.value = (serverData.data.list || []).map(sanitizeItem);
        }
    } catch (err) { console.error(err) } finally { loading.value = false }
}

const fetchUserFavorites = async () => {
    try {
        const res = await api.get('/user/favorites', { params: { username: route.params.username } })
        const serverData = (res.data && res.data.success !== undefined) ? res.data : res;
        if (serverData.success) {
            userFavorites.value = (serverData.data || []).map(sanitizeItem);
        }
    } catch (err) { console.error(err) }
}

const fetchUserColumns = async () => {
    try {
        const res = await api.get('/columns', { params: { author: route.params.username } })
        const serverData = (res.data && res.data.success !== undefined) ? res.data : res;
        if (serverData.success) userColumns.value = serverData.data || []
    } catch (err) { console.error(err) }
}

const fetchUserHistory = async () => {
    if (!isMyProfile.value) return
    try {
        const res = await api.get('/user/history')
        const serverData = (res.data && res.data.success !== undefined) ? res.data : res;
        if (serverData.success) userHistory.value = (serverData.data || []).map(sanitizeItem);
    } catch (err) { console.error(err) }
}

// ==================== 🖱️ 交互逻辑 ====================

const triggerBannerUpload = () => bannerInput.value.click()

const handleBannerChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const formData = new FormData()
    formData.append('banner', file)

    bannerUploading.value = true
    try {
        const res = await api.post('/user/update-banner', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        })
        const serverData = (res.data && res.data.success !== undefined) ? res.data : res;

        if (serverData.success) {
            message.success('背景图更换成功')
            targetUser.value.banner = serverData.data
            if (userStore.user) userStore.user.banner = serverData.data
        }
    } catch (err) {
        message.error('上传失败，请稍后再试')
    } finally {
        bannerUploading.value = false
        e.target.value = ''
    }
}

const checkFollowStatus = async () => {
    if (!targetUser.value?.id) return;
    try {
        const res = await api.get('/user/follow-status', { params: { targetUserId: targetUser.value.id } })
        const serverData = (res.data && res.data.success !== undefined) ? res.data : res;
        if (serverData.success) isFollowing.value = serverData.data.isFollowing
    } catch (err) { console.error(err) }
}

const handleFollowAction = async () => {
    if (!userStore.user) return message.warning('请先登录再操作')
    try {
        const res = await api.post('/user/follow', { targetUserId: targetUser.value.id })
        const serverData = (res.data && res.data.success !== undefined) ? res.data : res;
        if (serverData.success) {
            isFollowing.value = serverData.data.status === 'followed'
            message.success(serverData.message)
            if (targetUser.value.stats) targetUser.value.stats.fansCount += isFollowing.value ? 1 : -1
        }
    } catch (err) { message.error('操作失败') }
}

// 导航配置
const navMenuConfig = ref([
    { id: 'posts', name: '文章', visible: true },
    { id: 'columns', name: '专栏', visible: true },
    { id: 'likes', name: '收藏', visible: true },
    { id: 'history', name: '最近访问', visible: true },
    { id: 'code', name: '代码仓', visible: false },
    { id: 'resources', name: '资源', visible: false }
])
const showNavSettings = ref(false)
const visibleNavItems = computed(() => navMenuConfig.value.filter(item => item.visible))
const toggleNavVisibility = (item) => { item.visible = !item.visible }
const moveTab = (index, direction) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= navMenuConfig.value.length) return
    const temp = navMenuConfig.value[index]
    navMenuConfig.value[index] = navMenuConfig.value[newIndex]
    navMenuConfig.value[newIndex] = temp
}
const saveNavSettings = async () => {
    try {
        await api.post('/user/nav-settings', { navConfig: navMenuConfig.value })
        message.success('导航配置已同步')
        showNavSettings.value = false
    } catch (err) { message.error('同步失败') }
}

// 专栏操作
const showCreateColumnModal = ref(false)
const newColumnForm = ref({ name: '', description: '', cover: '' })

const handleCreateColumn = async () => {
    if (!newColumnForm.value.name) return message.warning('请输入专栏名称')
    try {
        const res = await api.post('/columns', newColumnForm.value)
        const serverData = (res.data && res.data.success !== undefined) ? res.data : res;
        if (serverData.success) {
            message.success('创建成功')
            showCreateColumnModal.value = false
            newColumnForm.value = { name: '', description: '', cover: '' }
            fetchUserColumns()
        }
    } catch (err) { message.error('创建失败') }
}

const handleDeleteColumn = async (column) => {
    if (!confirm(`确定删除专栏【${column.name}】吗？`)) return
    try {
        const res = await api.delete(`/columns/${column.id}`)
        const serverData = (res.data && res.data.success !== undefined) ? res.data : res;
        if (serverData.success) {
            message.success('已删除')
            fetchUserColumns()
        }
    } catch (err) { message.error('删除失败') }
}

// ==================== 🧠 计算属性与监听 ====================

const residenceTime = computed(() => {
    if (!targetUser.value?.created_at) return '新晋博主'
    const start = new Date(targetUser.value.created_at)
    const now = new Date()
    const diffDays = Math.ceil(Math.abs(now - start) / (1000 * 60 * 60 * 24))
    if (diffDays < 30) return `${diffDays} 天`
    return `${Math.floor(diffDays / 30)} 个月`
})

const filteredArticles = computed(() => {
    const q = profileSearchQuery.value.trim().toLowerCase()
    if (!q) return userArticles.value
    return userArticles.value.filter(item =>
        item.title?.toLowerCase().includes(q) || item.category?.toLowerCase().includes(q)
    )
})

const filteredFavorites = computed(() => {
    const q = profileSearchQuery.value.trim().toLowerCase()
    if (!q) return userFavorites.value
    return userFavorites.value.filter(item =>
        item.title?.toLowerCase().includes(q) || item.category?.toLowerCase().includes(q)
    )
})

const crossTabHint = computed(() => {
    const q = profileSearchQuery.value.trim()
    if (!q) return null
    if (activeTab.value === 'posts' && filteredFavorites.value.length > 0) {
        return { text: `在“收藏”中发现了 ${filteredFavorites.value.length} 个结果`, target: 'likes' }
    }
    if (activeTab.value === 'likes' && filteredArticles.value.length > 0) {
        return { text: `在“文章”中发现了 ${filteredArticles.value.length} 个结果`, target: 'posts' }
    }
    return null
})

watch(profileSearchQuery, (newVal) => {
    if (!newVal) return
    if (activeTab.value === 'posts' && !filteredArticles.value.length && filteredFavorites.value.length) {
        activeTab.value = 'likes'
    } else if (activeTab.value === 'likes' && !filteredFavorites.value.length && filteredArticles.value.length) {
        activeTab.value = 'posts'
    }
})

const initData = () => {
    fetchTargetUserInfo()
    fetchUserArticles()
    fetchUserFavorites()
    fetchUserColumns()
    fetchUserHistory()
}

onMounted(() => {
    initData()
})

watch(() => route.params.username, () => {
    initData()
})
</script>

<template>
    <div class="profile-page">
        <header class="profile-header-flat">
            <div class="banner-box">
                <img :src="getFullBannerUrl(targetUser?.banner)" class="banner-img"
                    :class="{ 'loading-blur': bannerUploading }" alt="banner">

                <template v-if="isMyProfile">
                    <div class="banner-tag" @click="triggerBannerUpload">
                        {{ bannerUploading ? '上传中...' : '📷 更换背景图' }}
                    </div>
                    <input type="file" ref="bannerInput" style="display: none" accept="image/*"
                        @change="handleBannerChange">
                </template>
            </div>

            <div class="header-info-container" v-if="targetUser">
                <div class="info-content-main">
                    <div class="avatar-box">
                        <img :src="targetUser?.avatar || 'https://w.wallhaven.cc/full/9o/wallhaven-9oog5d.jpg'"
                            class="avatar-img" alt="avatar">
                    </div>

                    <div class="user-detail">
                        <div class="name-row">
                            <h1 class="nickname">{{ targetUser?.nickname || targetUser?.username }}</h1>
                            <span class="user-badge">拾光纪 {{ residenceTime }}</span>
                        </div>


                        <div class="stats-row-top">
                            <span class="top-stat"><b>{{ targetUser?.stats?.originalCount || 0 }}</b> 原创</span>
                            <span class="top-stat"><b>{{ targetUser?.stats?.fansCount || 0 }}</b> 粉丝</span>
                            <span class="top-stat"><b>{{ targetUser?.stats?.followingCount || 0 }}</b> 关注</span>
                        </div>

                        <div class="user-meta-row">
                            <div class="meta-item">
                                <span class="meta-icon">📍</span>
                                <span class="meta-label">IP 属地：</span>
                                <span class="meta-value">{{ targetUser?.region || '未知' }}</span>
                            </div>

                            <div class="meta-divider"></div>

                            <div class="meta-item">
                                <span class="meta-icon">📅</span>
                                <span class="meta-label">加入 Veritas：</span>
                                <span class="meta-value">{{ formatJoinedDate(targetUser?.created_at) }}</span>
                            </div>
                        </div>

                        <div class="bio-box">
                            <p class="user-bio">个人简介：{{ targetUser?.bio || '这家伙很神秘，什么都没写。' }}</p>
                        </div>
                    </div>

                    <div class="header-actions">
                        <template v-if="isMyProfile">
                            <button class="action-btn primary" @click="router.push('/creation-center')">
                                ✨ 创作中心
                            </button>

                            <button class="action-btn outline" @click="router.push('/account')">编辑资料</button>

                            <div class="nav-settings-wrapper">
                                <button class="action-btn outline" @click.stop="showNavSettings = !showNavSettings">
                                    ⚙️ 导航设置
                                </button>

                                <transition name="fade-slide">
                                    <div v-if="showNavSettings" class="nav-settings-dropdown" @click.stop>
                                        <div class="dropdown-header">
                                            <span>导航菜单管理</span>
                                            <span class="sub-hint">点击箭头调整顺序</span>
                                        </div>
                                        <div class="setting-list">
                                            <div v-for="(item, index) in navMenuConfig" :key="item.id"
                                                class="setting-item">
                                                <div class="item-drag-icon">☰</div>
                                                <span class="item-name">{{ item.name }}</span>
                                                <div class="item-ops">
                                                    <span @click="toggleNavVisibility(item)" class="op-btn"
                                                        :title="item.visible ? '隐藏' : '显示'">
                                                        {{ item.visible ? '👁️' : '🚫' }}
                                                    </span>
                                                    <span @click="moveTab(index, -1)" class="op-btn"
                                                        v-if="index !== 0">↑</span>
                                                    <span @click="moveTab(index, 1)" class="op-btn"
                                                        v-if="index !== navMenuConfig.length - 1">↓</span>
                                                </div>
                                            </div>
                                        </div>
                                        <button class="confirm-nav-btn" @click="saveNavSettings">完成并同步</button>
                                    </div>
                                </transition>
                            </div>
                        </template>
                        <button v-else class="action-btn" :class="isFollowing ? 'outline' : 'primary'"
                            @click="handleFollowAction">
                            {{ isFollowing ? '已关注' : '+ 关注' }}
                        </button>
                    </div>
                </div>
            </div>
        </header>

        <main class="profile-layout" v-if="targetUser">
            <aside class="side-info">
                <div class="side-card achievement-card">
                    <h3 class="card-title-sm">个人成就</h3>
                    <div class="achieve-list">
                        <div class="achieve-item">
                            <span class="icon">👍</span> 获得 {{ targetUser?.stats?.totalLikes || 0 }} 次点赞
                        </div>
                        <div class="achieve-item">
                            <span class="icon">⭐</span> 内容被收藏 {{ targetUser?.stats?.totalFavorites || 0 }} 次
                        </div>
                        <div class="achieve-item">
                            <span class="icon">💬</span> 内容获得 {{ targetUser?.stats?.totalComments || 0 }} 次评论
                        </div>
                        <div class="achieve-item">
                            <span class="icon">🔥</span> 文章获得 {{ targetUser?.stats?.totalViews || 0 }} 次浏览
                        </div>
                    </div>
                </div>
                <div class="side-card power-card">
                    <h3 class="card-title-sm">原力等级</h3>
                    <div class="power-content">
                        <div class="power-val">LV.1</div>
                        <div class="power-bar">
                            <div class="fill" style="width: 30%"></div>
                        </div>
                    </div>
                </div>
            </aside>

            <section class="main-content">
                <nav class="content-tabs">
                    <div v-for="tab in visibleNavItems" :key="tab.id" class="tab-link"
                        :class="{ active: activeTab === tab.id }" @click="activeTab = tab.id">
                        {{ tab.name }}
                    </div>

                    <div class="tab-search">
                        <input type="text" v-model="profileSearchQuery" placeholder="搜索我的动态...">
                    </div>
                </nav>

                <div class="content-body">
                    <transition name="fade-slide">
                        <div v-if="profileSearchQuery && crossTabHint" class="search-cross-hint"
                            @click="activeTab = crossTabHint.target">
                            <span class="hint-icon">💡</span> {{ crossTabHint.text }}
                            <span class="hint-link">点击查看 →</span>
                        </div>
                    </transition>

                    <div v-if="activeTab === 'posts'" class="article-list-v2">
                        <ArticleItem v-for="article in filteredArticles" :key="article.id" :data="article"
                            @click="router.push({ path: `/article/${article.id}`, query: { type: article.work_type } })" />
                        <div v-if="profileSearchQuery && filteredArticles.length === 0" class="empty-state">🔍
                            未在“文章”中找到相关内容
                        </div>
                        <div v-else-if="!profileSearchQuery && userArticles.length === 0" class="empty-state">📭
                            还没有发布过作品哦</div>
                    </div>

                    <div v-else-if="activeTab === 'likes'" class="article-list-v2">
                        <ArticleItem v-for="article in filteredFavorites" :key="article.id" :data="article"
                            @click="router.push({ path: `/article/${article.id}`, query: { type: article.work_type } })" />

                        <div v-if="profileSearchQuery && filteredFavorites.length === 0" class="empty-state">🔍
                            未在收藏中找到相关内容
                        </div>
                        <div v-else-if="!profileSearchQuery && userFavorites.length === 0" class="empty-state">📭 暂无收藏内容
                        </div>
                    </div>

                    <template v-else>
                        <div v-if="profileSearchQuery" class="empty-state">
                            💡 请在“文章”或“收藏”中查看搜索结果
                        </div>
                        <template v-else>
                            <div v-if="activeTab === 'columns'" class="column-grid">
                                <div v-if="isMyProfile" class="column-card create-trigger"
                                    @click="showCreateColumnModal = true">
                                    <div class="create-inner">
                                        <span class="plus-icon">+</span>
                                        <p>新建专栏文件夹</p>
                                    </div>
                                </div>
                                <div v-for="col in userColumns" :key="col.id" class="column-card"
                                    @click="router.push(`/column/${col.id}`)">
                                    <button v-if="isMyProfile" class="delete-column-btn"
                                        @click.stop="handleDeleteColumn(col)">
                                        <span>×</span>
                                    </button>
                                    <div class="column-cover">
                                        <img :src="getProxyUrl(col.cover)" alt="cover">
                                        <span class="count-badge">{{ col.articleCount || 0 }} 篇</span>
                                    </div>
                                    <div class="column-info">
                                        <h4 class="column-title">{{ col.name }}</h4>
                                        <p class="column-desc">{{ col.description || '这个专栏还没有描述~' }}</p>
                                    </div>
                                </div>
                            </div>
                            <div v-else-if="activeTab === 'history'" class="article-list-v2">
                                <ArticleItem v-for="article in userHistory" :key="article.id" :data="article"
                                    @click="router.push({ path: `/article/${article.id}`, query: { type: article.work_type } })" />
                            </div>
                        </template>
                    </template>
                </div>
            </section>
        </main>
        <div v-if="showCreateColumnModal" class="modal-overlay" @click="showCreateColumnModal = false">
            <div class="modal-content" @click.stop>
                <h3>📂 新建专栏文件夹</h3>
                <input v-model="newColumnForm.name" class="modal-input" placeholder="请输入专栏名称（必填）">
                <textarea v-model="newColumnForm.description" class="modal-input" placeholder="请输入专栏描述"
                    rows="3"></textarea>
                <div class="modal-ops">
                    <button class="action-btn outline" @click="showCreateColumnModal = false">取消</button>
                    <button class="action-btn primary" @click="handleCreateColumn">确定创建</button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.profile-page {
    background: #f4f6f8;
    min-height: 100vh;
    padding-bottom: 50px;
}

/* --- Header 视觉模型优化 --- */
.profile-header-flat {
    background: #fff;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
    margin-bottom: 20px;
}

.banner-box {
    height: 180px;
    overflow: hidden;
    position: relative;
}

.banner-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.banner-tag {
    position: absolute;
    bottom: 10px;
    right: 20px;
    color: white;
    background: rgba(0, 0, 0, 0.3);
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
}

.header-info-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px;
    position: relative;
    top: -50px;
    /* 整体上浮 */
}

.info-content-main {
    display: flex;
    align-items: flex-start;
    gap: 24px;
}

/* 头像框美化 */
.avatar-box {
    width: 120px;
    height: 120px;
    border-radius: 20px;
    border: 5px solid #fff;
    background: #fff;
    overflow: hidden;
    flex-shrink: 0;
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

.avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

/* 🔥 修复昵称位置：通过 padding-top 让文字刚好落在 Banner 下方白底区 */
.user-detail {
    flex: 1;
    padding-top: 60px;
}

.name-row {
    display: flex;
    align-items: center;
    gap: 15px;
    margin-bottom: 12px;
}

.nickname {
    font-size: 26px;
    font-weight: 800;
    color: #1a1a1a;
    margin: 0;
}

.user-badge {
    font-size: 11px;
    color: #3b82f6;
    background: rgba(59, 130, 246, 0.08);
    /* 稍微降低背景透明度，更优雅 */
    padding: 3px 12px;
    /* 增加左右内边距 */
    border-radius: 50px;
    /* 变成圆角胶囊状，更现代 */
    font-weight: 600;
    white-space: nowrap;
    /* 确保文字不换行 */
    border: 1px solid rgba(59, 130, 246, 0.2);
    /* 增加一层极细的边框，提升质感 */
}

.stats-row-top {
    display: flex;
    gap: 25px;
    margin-bottom: 15px;
    color: #555;
    font-size: 14px;
}

.stats-row-top b {
    color: #000;
    font-size: 16px;
}

/* 用户元信息行（IP与日期） */
.user-meta-row {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 15px;
}

.meta-item {
    display: flex;
    align-items: center;
    font-size: 13px;
    line-height: 1;
}

.meta-icon {
    margin-right: 4px;
    font-size: 14px;
    filter: grayscale(0.2);
    /* 让 Emoji 颜色稍微收敛一点，不抢主视觉 */
}

.meta-label {
    color: #8a919f;
    /* 标签使用较淡的灰色 */
}

.meta-value {
    color: #515767;
    /* 数值使用稍深的灰色 */
    font-weight: 500;
}

/* 垂直分割线 */
.meta-divider {
    width: 1px;
    height: 12px;
    background-color: #e5e6eb;
}

/* 响应式微调：如果屏幕太窄，自动换行 */
@media (max-width: 768px) {
    .user-meta-row {
        flex-wrap: wrap;
        gap: 10px;
    }

    .meta-divider {
        display: none;
        /* 移动端换行后隐藏分割线 */
    }
}

.bio-box {
    background: #f9f9f9;
    padding: 10px 15px;
    border-radius: 8px;
    border-left: 3px solid #eee;
}

.user-bio {
    font-size: 13.5px;
    color: #666;
    margin: 0;
    line-height: 1.6;
}

/* 按钮操作区 */
.header-actions {
    display: flex;
    gap: 12px;
    padding-top: 65px;
}

/* --- 🔥 导航设置下拉框专用样式 --- */
.nav-settings-wrapper {
    position: relative;
}

.nav-settings-dropdown {
    position: absolute;
    top: calc(100% + 15px);
    right: 0;
    width: 280px;
    background: #ffffff;
    border-radius: 12px;
    box-shadow: 0 15px 50px rgba(0, 0, 0, 0.15);
    border: 1px solid #efefef;
    z-index: 1001;
    padding: 20px;
}

.dropdown-header {
    border-bottom: 1px solid #f0f0f0;
    padding-bottom: 12px;
    margin-bottom: 15px;
}

.dropdown-header span {
    font-weight: 700;
    color: #333;
    display: block;
}

.dropdown-header .sub-hint {
    font-size: 11px;
    color: #999;
    font-weight: 400;
    margin-top: 4px;
}

.setting-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.setting-item {
    display: flex;
    align-items: center;
    padding: 10px 12px;
    background: #f8f9fa;
    border-radius: 8px;
    transition: 0.2s;
}

.setting-item:hover {
    background: #f1f3f5;
}

.item-drag-icon {
    cursor: grab;
    color: #ced4da;
    margin-right: 12px;
}

.item-name {
    flex: 1;
    font-size: 14px;
    color: #495057;
    font-weight: 500;
}

.item-ops {
    display: flex;
    gap: 12px;
}

.op-btn {
    cursor: pointer;
    color: #adb5bd;
    font-size: 15px;
    transition: 0.2s;
}

.op-btn:hover {
    color: #42b883;
    transform: scale(1.2);
}

.confirm-nav-btn {
    width: 100%;
    margin-top: 15px;
    background: #42b883;
    color: white;
    border: none;
    padding: 10px;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.3s;
}

.confirm-nav-btn:hover {
    background: #3aa876;
}

/* --- 布局容器 --- */
.profile-layout {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px;
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 20px;
}

/* 左侧边栏 */
.side-card {
    background: #fff;
    border-radius: 12px;
    padding: 22px;
    margin-bottom: 20px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.02);
}

.card-title-sm {
    font-size: 16px;
    font-weight: 700;
    margin-bottom: 18px;
    color: #333;
    position: relative;
    padding-left: 12px;
}

.card-title-sm::before {
    content: '';
    position: absolute;
    left: 0;
    top: 3px;
    height: 14px;
    width: 4px;
    background: #42b883;
    border-radius: 2px;
}

.achieve-list {
    display: flex;
    flex-direction: column;
    gap: 15px;
    font-size: 13.5px;
    color: #555;
}

/* 右侧内容流 */
.main-content {
    background: #fff;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.02);
}

.content-tabs {
    display: flex;
    align-items: center;
    border-bottom: 1px solid #f0f0f0;
    padding: 0 20px;
    height: 55px;
}

.tab-link {
    padding: 0 20px;
    height: 100%;
    display: flex;
    align-items: center;
    cursor: pointer;
    color: #666;
    font-weight: 500;
    position: relative;
    transition: 0.3s;
}

.tab-link.active {
    color: #1a1a1a;
    font-weight: 700;
}

.tab-link.active::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 25%;
    width: 50%;
    height: 3px;
    background: #42b883;
    border-radius: 3px 3px 0 0;
}

.tab-search {
    margin-left: auto;
}

.tab-search input {
    padding: 8px 16px;
    border-radius: 20px;
    border: 1px solid #eee;
    background: #f9f9f9;
    font-size: 13px;
    width: 160px;
}

.empty-state {
    padding: 100px 0;
    text-align: center;
    color: #999;
    font-size: 15px;
}

/* 按钮通用 */
.action-btn {
    padding: 8px 22px;
    border-radius: 50px;
    font-size: 13.5px;
    font-weight: 600;
    cursor: pointer;
    transition: 0.3s;
}

.action-btn.outline {
    background: #fff;
    border: 1px solid #e0e0e0;
    color: #555;
}

.action-btn.outline:hover {
    border-color: #42b883;
    color: #42b883;
    background: #f0fdf4;
}

.action-btn.primary {
    background: linear-gradient(135deg, #42b883 0%, #34a853 100%);
    color: white;
    border: none;
    padding: 8px 25px;
    box-shadow: 0 4px 15px rgba(66, 184, 131, 0.3);
}

.action-btn.primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(66, 184, 131, 0.4);
}

/* 下拉动画 */
.fade-slide-enter-active,
.fade-slide-leave-active {
    transition: all 0.3s ease;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
    opacity: 0;
    transform: translateY(-12px);
}

/* 专栏网格布局 */
.column-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 20px;
    padding: 20px;
}

.column-card {
    position: relative;
    background: #fff;
    border: 1px solid #eee;
    border-radius: 12px;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.3s ease;
}

.column-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.05);
}

/* --- 🗑️ 删除专栏按钮专属样式 --- */
.column-card {
    position: relative;
    /* 必须设为相对定位，作为按钮的基准 */
}

.delete-column-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 24px;
    height: 24px;
    background: rgba(255, 95, 126, 0.9);
    color: white;
    border: none;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 10;
    opacity: 0;
    transition: 0.3s;
    font-size: 18px;
}

/* 鼠标悬停卡片时，删除按钮浮现并伴随轻微缩放 */
.column-card:hover .delete-column-btn {
    opacity: 1;
    transform: scale(1);
}

.delete-column-btn:hover {
    color: white;
    border-color: #ff5f7e;
    /* 悬停按钮本身时进一步放大 */
    transform: scale(1.2);
    background: #ff4757;
}

.delete-column-btn .cross-icon {
    font-size: 20px;
    line-height: 1;
    margin-top: -2px;
    /* 微调 × 的垂直中心 */
}

.column-cover {
    height: 140px;
    position: relative;
}

.column-cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.count-badge {
    position: absolute;
    right: 10px;
    bottom: 10px;
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
}

.column-info {
    padding: 15px;
}

.column-title {
    font-size: 16px;
    font-weight: 700;
    margin: 0 0 8px 0;
    color: #333;
}

.column-desc {
    font-size: 13px;
    color: #888;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

/* 创建专栏的虚线卡片 */
.create-trigger {
    border: 2px dashed #e0e0e0 !important;
    background: #fafafa !important;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 200px;
}

.create-trigger:hover {
    border-color: #42b883 !important;
    background: #f0fdf4 !important;
}

.create-inner {
    text-align: center;
    color: #999;
}

.plus-icon {
    font-size: 40px;
    display: block;
    margin-bottom: 10px;
}

/* 简易弹窗样式 */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
}

.modal-content {
    background: white;
    padding: 30px;
    border-radius: 12px;
    width: 400px;
}

.modal-input {
    width: 100%;
    margin: 10px 0;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 6px;
}

.modal-ops {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 20px;
}

/* 添加到 <style scoped> */
.banner-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: filter 0.5s ease, opacity 0.5s ease;
}

.banner-img.loading-blur {
    filter: blur(5px);
    opacity: 0.7;
}

.banner-tag {
    position: absolute;
    bottom: 15px;
    right: 20px;
    color: white;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(4px);
    /* 磨砂感 */
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s;
    border: 1px solid rgba(255, 255, 255, 0.2);
}

.banner-tag:hover {
    background: rgba(0, 0, 0, 0.6);
    transform: scale(1.05);
}

/* --- 🔍 搜索跨栏提示条 --- */
.search-cross-hint {
    margin: 15px 20px;
    padding: 10px 16px;
    background: rgba(66, 184, 131, 0.05);
    border: 1px dashed #42b883;
    border-radius: 8px;
    font-size: 13px;
    color: #42b883;
    cursor: pointer;
    display: flex;
    align-items: center;
    transition: all 0.3s ease;
}

.search-cross-hint:hover {
    background: rgba(66, 184, 131, 0.1);
    transform: translateY(-2px);
}

.hint-icon {
    margin-right: 8px;
}

.hint-link {
    margin-left: auto;
    font-weight: 700;
    text-decoration: underline;
}

/* 搜索状态下的列表间距微调 */
.article-list-v2 {
    padding: 10px 20px;
    display: flex;
    flex-direction: column;
    gap: 15px;
}
</style>