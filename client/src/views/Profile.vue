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
const targetUser = ref(null)
const isFollowing = ref(false) // 🔥 必须补上这一行！
const userArticles = ref([])
const userFavorites = ref([]) // 🔥 新增：存储收藏列表
const activeTab = ref('posts') // 默认选中文章的 ID
const profileSearchQuery = ref('')


// ==================== 🛠️ 增加新的状态变量 ====================
const userColumns = ref([])    // 存储专栏列表
const userHistory = ref([])    // 存储最近访问列表

// ==================== 🛠️ 增加获取数据的函数 ====================

// 1. 获取用户专栏
const fetchUserColumns = async () => {
    try {
        const res = await api.get('/columns', {
            params: { author: route.params.username } // 确保传了用户名
        })
        if (res.data.success) {
            userColumns.value = res.data.data
            console.log("📂 获取到的专栏列表:", userColumns.value)
        }
    } catch (err) {
        console.error("加载专栏失败:", err)
    }
}

// 2. 获取最近访问（通常这部分数据仅对“自己”可见）
const fetchUserHistory = async () => {
    // 只有看自己的主页时，才获取历史记录（隐私保护）
    if (!isMyProfile.value) return

    try {
        const res = await api.get('/user/history')
        if (res.data.success) {
            userHistory.value = res.data.data || []
            console.log("🕒 获取到的历史记录:", userHistory.value)
        }
    } catch (err) {
        console.error("加载历史记录失败")
    }
}

// ==================== 🛠️ 更新初始化和监听 ====================
const initData = () => {
    loading.value = true
    fetchTargetUserInfo()
    fetchUserArticles()
    fetchUserFavorites()
    fetchUserColumns()   // 🔥 新增
    fetchUserHistory()   // 🔥 新增
}

// ==================== 🔥 1. 动态导航设置逻辑 ====================
const showNavSettings = ref(false)

// 初始导航菜单配置 (包含 ID, 名称, 显隐状态)
const navMenuConfig = ref([
    { id: 'posts', name: '文章', visible: true },
    { id: 'columns', name: '专栏', visible: true },
    { id: 'likes', name: '收藏', visible: true },
    { id: 'history', name: '最近访问', visible: true },
    { id: 'code', name: '代码仓', visible: false },
    { id: 'resources', name: '资源', visible: false }
])

// 计算属性：过滤出可见的 Tab 供内容区展示
const visibleNavItems = computed(() => {
    return navMenuConfig.value.filter(item => item.visible)
})

// 排序逻辑：向上/向下移动位置
const moveTab = (index, direction) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= navMenuConfig.value.length) return
    // 交换数组元素实现排序
    const temp = navMenuConfig.value[index]
    navMenuConfig.value[index] = navMenuConfig.value[newIndex]
    navMenuConfig.value[newIndex] = temp
}

// 切换显示/隐藏状态
const toggleNavVisibility = (item) => {
    item.visible = !item.visible
}

// 🔥 新增：保存导航设置到后端
const saveNavSettings = async () => {
    try {
        await api.post('/user/nav-settings', { navConfig: navMenuConfig.value })
        message.success('导航配置已同步至云端')
        showNavSettings.value = false
    } catch (err) {
        message.error('同步失败，请稍后再试')
    }
}

// ==================== 🛠️ 数据交互逻辑 ====================

const isMyProfile = computed(() => userStore.user?.username === route.params.username)

// 计算时间
// 修改计算属性名称和逻辑
const residenceTime = computed(() => {
    if (!targetUser.value?.created_at) return '新晋博主';

    const start = new Date(targetUser.value.created_at);
    const now = new Date();

    // 计算总月份差
    let months = (now.getFullYear() - start.getFullYear()) * 12;
    months += now.getMonth() - start.getMonth();

    // 如果还没满一个月
    if (months <= 0) {
        // 计算天数
        const diffDays = Math.floor((now - start) / (1000 * 60 * 60 * 24));
        return diffDays <= 0 ? '刚刚加入' : `${diffDays} 天`;
    }

    // 如果不足一年
    if (months < 12) {
        return `${months} 个月`;
    }

    // 超过一年，计算 年 + 月
    const yrs = Math.floor(months / 12);
    const remainingMonths = months % 12;
    return remainingMonths > 0 ? `${yrs} 年 ${remainingMonths} 个月` : `${yrs} 年`;
});

// 统一使用这个 formatJoinedDate
const formatJoinedDate = (dateStr) => {
    if (!dateStr) return '加载中...';
    const date = new Date(dateStr);

    // 如果日期无效，返回未知
    if (isNaN(date.getTime())) return '未知';

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

// 🔥 新增：检查关注状态
const checkFollowStatus = async () => {
    try {
        const res = await api.get('/user/follow-status', {
            // 这里建议加个 ?. 防止 targetUser 极端情况下为 null
            params: { targetUserId: targetUser.value?.id }
        })
        isFollowing.value = res.data.data.isFollowing
    } catch (err) { console.error(err) }
}

// 🔥 新增：关注/取消关注交互
const handleFollowAction = async () => {
    if (!userStore.user) return message.warning('请先登录再操作')
    try {
        const res = await api.post('/user/follow', { targetUserId: targetUser.value.id })
        isFollowing.value = res.data.data.status === 'followed'
        message.success(res.data.message)
        // 重新获取数据以刷新粉丝数
        fetchTargetUserInfo()
    } catch (err) {
        message.error('操作失败')
    }
}

// 🔥 优化后的获取用户信息逻辑
const fetchTargetUserInfo = async () => {
    try {
        const res = await api.get('/user/profile', {
            params: { username: route.params.username }
        })
        if (res.data.success) {
            targetUser.value = res.data.data
            console.log("🔍 接口返回的原始数据:", res.data.data); // 加上这一行
            targetUser.value = res.data.data
            console.log("🖼️ 当前 targetUser.banner 的值:", targetUser.value.banner); // 加上这一行

            // 1. 同步云端导航配置
            if (res.data.data.navConfig) {
                navMenuConfig.value = res.data.data.navConfig
            }

            // 2. 如果不是自己的主页，且已登录，检查关注状态
            if (!isMyProfile.value && userStore.user) {
                checkFollowStatus()
            }
        }
    } catch (error) {
        message.error('获取用户信息失败')
        router.push('/')
    }
}

const fetchUserArticles = async () => {
    try {
        const res = await api.get('/articles', {
            params: { author: route.params.username, limit: 10 }
        })
        if (res.data.success) {
            // 🔥 核心修正：因为后端返回了对象，数据在 .list 里面
            userArticles.value = res.data.data.list || []
            console.log("获取到的文章列表:", userArticles.value)
        }
    } catch (err) {
        console.error("加载文章失败:", err)
    } finally {
        loading.value = false
    }
}

// 🔥 新增：获取用户收藏列表
const fetchUserFavorites = async () => {
    try {
        const res = await api.get('/user/favorites', {
            params: { username: route.params.username }
        })
        if (res.data.success) {
            userFavorites.value = res.data.data
        }
    } catch (error) {
        console.error("加载收藏失败:", error)
    }
}

const showCreateColumnModal = ref(false)
const newColumnForm = ref({
    name: '',
    description: '',
    cover: ''
})

const handleCreateColumn = async () => {
    if (!newColumnForm.value.name) return message.warning('请输入专栏名称')
    try {
        const res = await api.post('/columns', newColumnForm.value)
        if (res.data.success) {
            message.success('新专栏已创建')
            showCreateColumnModal.value = false
            newColumnForm.value = { name: '', description: '', cover: '' }
            fetchUserColumns() // 重新刷新列表
        }
    } catch (err) {
        message.error('创建失败')
    }
}

const bannerInput = ref(null)      // 引用 DOM
const bannerUploading = ref(false) // 上传状态锁

// --- 🔥 辅助函数：处理背景图 URL ---
// 默认背景图（防止路径为空时显示空白）
const defaultBanner = 'https://w.wallhaven.cc/full/ly/wallhaven-ly9qzq.jpg'

const getFullBannerUrl = (path) => {
    // 1. 如果路径不存在，返回默认图
    if (!path) return defaultBanner

    // 2. 如果路径已经是完整的 http 链接，直接返回
    if (path.startsWith('http')) return path

    // 3. 如果是后端返回的相对路径（如 /uploads/xxx.jpg），直接返回
    // 前端 Vite 代理会自动处理 /uploads 路径
    return path
}

// --- 🔥 逻辑 A：触发点击 ---
const triggerBannerUpload = () => {
    if (bannerUploading.value) return
    bannerInput.value.click()
}

// --- 🔥 逻辑 B：处理文件选择 ---
const handleBannerChange = async (e) => {
    // 1. 获取选中的文件
    const file = e.target.files[0]

    // 2. 安全检查
    if (!file) return

    // 3. 核心修复：在这里定义 formData 👈
    const formData = new FormData()
    formData.append('banner', file)

    bannerUploading.value = true
    try {
        // 4. 发送请求
        const res = await api.post('/user/update-banner', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        })

        if (res.data.success) {
            message.success('背景图更换成功！')
            // 更新页面显示的图片
            targetUser.value.banner = res.data.data
            // 同步更新全局 store
            if (userStore.user) {
                userStore.user.banner = res.data.data
            }
        }
    } catch (err) {
        console.error("上传失败:", err)
        // 这里的错误如果是 500，请看下面的说明
        message.error('上传失败，请稍后再试')
    } finally {
        bannerUploading.value = false
        // 清空 input 框
        e.target.value = ''
    }
}

// 搜索框
// 🔥 计算属性：根据关键词实时过滤文章
const filteredProfileArticles = computed(() => {
    const query = profileSearchQuery.value.trim().toLowerCase()
    if (!query) return userArticles.value

    return userArticles.value.filter(article =>
        article.title.toLowerCase().includes(query) ||
        article.summary?.toLowerCase().includes(query) ||
        article.category?.toLowerCase().includes(query)
    )
})

// 修改初始化逻辑，同时获取文章和收藏
onMounted(() => {
    initData()
})

// 修改监听逻辑
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
                    <div v-if="profileSearchQuery" class="article-list-v2">
                        <ArticleItem v-for="article in filteredProfileArticles" :key="article.id" :data="article"
                            @click="router.push(`/article/${article.id}`)" />
                        <div v-if="filteredProfileArticles.length === 0" class="empty-state">🔍 未找到相关动态</div>
                    </div>

                    <template v-else>
                        <div v-if="activeTab === 'posts'" class="article-list-v2">
                            <ArticleItem v-for="article in userArticles" :key="article.id" :data="article"
                                @click="router.push(`/article/${article.id}`)" />
                            <div v-if="userArticles.length === 0" class="empty-state">📭 还没有发布过文章哦</div>
                        </div>

                        <div v-else-if="activeTab === 'columns'" class="column-grid">
                            <div v-if="isMyProfile" class="column-card create-trigger"
                                @click="showCreateColumnModal = true">
                                <div class="create-inner">
                                    <span class="plus-icon">+</span>
                                    <p>新建专栏文件夹</p>
                                </div>
                            </div>

                            <div v-for="col in userColumns" :key="col.id" class="column-card"
                                @click="router.push(`/column/${col.id}`)">
                                <div class="column-cover">
                                    <img :src="col.cover || 'https://images.unsplash.com/photo-1484417894907-623942c8ee29?w=500'"
                                        alt="cover">
                                    <span class="count-badge">{{ col.articleCount || 0 }} 篇</span>
                                </div>
                                <div class="column-info">
                                    <h4 class="column-title">{{ col.name }}</h4>
                                    <p class="column-desc">{{ col.description || '这个专栏还没有描述~' }}</p>
                                </div>
                            </div>

                            <div v-if="userColumns.length === 0 && !isMyProfile" class="empty-state">
                                📭 暂无专栏内容
                            </div>
                        </div>

                        <div v-else-if="activeTab === 'likes'" class="article-list-v2">
                            <ArticleItem v-for="article in userFavorites" :key="article.id" :data="article"
                                @click="router.push(`/article/${article.id}`)" />
                        </div>

                        <div v-else-if="activeTab === 'history'" class="article-list-v2">
                            <ArticleItem v-for="article in userHistory" :key="article.id" :data="article"
                                @click="router.push(`/article/${article.id}`)" />
                        </div>
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
    background: #42b883;
    border: none;
    color: #fff;
    box-shadow: 0 4px 12px rgba(66, 184, 131, 0.3);
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
</style>