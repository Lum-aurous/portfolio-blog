<script setup>
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue'
import axios from 'axios'
import { useUserStore } from '@/stores/user.js'
import { useRouter } from 'vue-router'

const userStore = useUserStore()
const router = useRouter()
const notices = ref([{ content: '' }]) // 防止未定义错误
// ==================== 文章分页逻辑 ====================
// 分页状态
const currentPage = ref(1)
const pageSize = 9 // 🔥 每次加载 9 篇（配合 2列/3列 布局比较好看）
const hasMore = ref(true) // 是否还有更多文章
const isLoadingMore = ref(false) // 按钮loading状态

// ==================== 1. 用户信息逻辑 ====================
const defaultAvatar = 'https://w.wallhaven.cc/full/9o/wallhaven-9oog5d.jpg'

const getFullAvatarUrl = (path) => {
    if (!path) return defaultAvatar
    if (path.startsWith('data:image') || path.startsWith('http')) return path
    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
    return `${apiBase}${path}`
}

// 修改前的 profile 逻辑是完全依赖 userStore，现在我们将数据源改为 siteStats
const profile = computed(() => {
    // 基础数据（来自后端统计接口）
    const statsData = {
        // 🔥 确保这里有默认值 0，防止 undefined
        articlesCount: siteStats.value.articleCount || 0,
        categoryCount: siteStats.value.categoryCount || 0,
        visits: siteStats.value.totalViews || 0
    }

    // 用户身份数据（来自 Store）
    if (userStore.user && userStore.user.username) {
        return {
            isLogin: true,
            // 优先显示昵称，没有则显示用户名
            name: userStore.user.nickname || userStore.user.username,
            title: userStore.user.bio || '全栈开发者 / 追梦人',
            avatar: getFullAvatarUrl(userStore.user.avatar),
            github: userStore.user.social_link || 'https://github.com',
            ...statsData // 🔥 混入真实的统计数据
        }
    } else {
        return {
            isLogin: false,
            name: '访客',
            title: '登录以解锁更多功能',
            avatar: defaultAvatar,
            github: '#',
            ...statsData // 🔥 即使是访客，也显示真实的站点文章数据
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
    'https://w.wallhaven.cc/full/og/wallhaven-ogd6j9.png',
    'https://w.wallhaven.cc/full/9o/wallhaven-9ooe6d.jpg',
    'https://w.wallhaven.cc/full/yx/wallhaven-yxd2vk.png'
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

// ==================== 3. 3D 标签云逻辑 (动态化) ====================
const tags = ref([]) // 存储最终的标签对象
let animationFrameId = null

// 3D 配置
const RADIUS = 130 // 稍微调大一点点
const BASE_SPEED = 0.005
const ACCELERATION = 0.0001
let currentSpeed = 0
let angleX = 0
let angleY = 0

// 预设好看的颜色池 (Material Design Colors)
const colorPalette = [
    '#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5',
    '#2196F3', '#03A9F4', '#00BCD4', '#009688', '#4CAF50',
    '#8BC34A', '#CDDC39', '#FFC107', '#FF9800', '#FF5722'
]

// 获取标签数据
const fetchTags = async () => {
    try {
        const res = await axios.get('/api/tags/cloud')
        if (res.data.success) {
            const rawData = res.data.data

            // 初始化 3D 坐标
            const len = rawData.length
            tags.value = rawData.map((tag, i) => {
                const phi = Math.acos(-1 + (2 * i) / len)
                const theta = Math.sqrt(len * Math.PI) * phi

                // 如果后端没给颜色，前端随机分配一个
                const color = tag.color || colorPalette[Math.floor(Math.random() * colorPalette.length)]

                return {
                    id: tag.id || i,
                    name: tag.name, // 或者是 tag.title
                    color: color,
                    x: RADIUS * Math.cos(theta) * Math.sin(phi),
                    y: RADIUS * Math.sin(theta) * Math.sin(phi),
                    z: RADIUS * Math.cos(phi),
                    style: {}
                }
            })

            // 数据准备好后，开始动画
            nextTick(() => {
                animate()
            })
        }
    } catch (error) {
        console.error('❌ 获取标签云失败:', error)
        // 失败时不显示或使用空数组，避免报错
    }
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
        // 120和160是容器中心的偏移量，根据容器大小微调
        transform: `translate3d(${tag.x + 120}px, ${tag.y + 140}px, 0) scale(${scale})`,
        opacity: 0.5 + 0.5 * alpha,
        zIndex: Math.floor(scale * 100),
        '--tag-color': tag.color
    }
}

const handleTagClick = (tag) => {
    // 1. 视觉交互：把标签名自动填入搜索框，让用户知道发生了什么
    searchQuery.value = tag.name

    // 2. 逻辑交互：直接触发搜索
    performSearch(tag.name)

    // 3. 体验优化：平滑滚动到文章列表，直接看结果
    scrollToContent()
}



// ==================== 6. 🔥 弹幕数据 (升级版：带缩略图) ====================
// 默认数据也可以稍微带点图，模拟真实效果
const defaultBarrage = [
    { id: 'd1', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=100', content: '沙发是我的！', image: null },
    { id: 'd2', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=100', content: '图拍得不错', image: 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?q=80&w=50&h=50&fit=crop' }, // 模拟带图
    { id: 'd3', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=100', content: '学到了', image: null },
]

const barrageList = ref([...defaultBarrage])

// 🔥 修复版：获取最新评论 (带详细调试)
const fetchLatestComments = async () => {
    try {
        const res = await axios.get('/api/comments/latest', {
            params: { limit: 15 }
        })

        // console.log('📦 最新弹幕原始数据:', res.data) // 减少控制台噪音

        if (res.data.success && res.data.data.length > 0) {
            const realComments = res.data.data.map(item => {
                const avatar = getFullAvatarUrl(item.avatar)

                let displayContent = item.content || ''
                let thumbImage = null

                // 🔥 1. 优先提取图片
                // 确保 images 是数组且有长度
                if (Array.isArray(item.images) && item.images.length > 0) {
                    let imgPath = item.images[0]

                    // 🔥 修复逻辑：确保 imgPath 是指向后端的完整 URL
                    if (imgPath && typeof imgPath === 'string') {

                        // 如果已经是 http 开头的完整链接（比如图床），直接用
                        if (imgPath.startsWith('http')) {
                            thumbImage = imgPath
                        } else {

                            const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'

                            const host = apiBase.replace(/\/api\/?$/, '')

                            // 确保 imgPath 以 / 开头
                            const cleanPath = imgPath.startsWith('/') ? imgPath : '/' + imgPath

                            // 拼接最终地址
                            thumbImage = `${host}${cleanPath}`
                        }
                    }
                }
                // 🔥 2. 智能文案处理
                // 情况A: 有图无字 -> 显示“分享图片”
                if (!displayContent.trim() && thumbImage) {
                    displayContent = '分享图片'
                }
                // 情况B: 无图无字 -> 显示默认文案
                else if (!displayContent.trim() && !thumbImage) {
                    displayContent = '收到一条新留言'
                }

                // 3. 截断过长文字
                const maxLen = thumbImage ? 8 : 12
                if (displayContent.length > maxLen) {
                    displayContent = displayContent.substring(0, maxLen) + '...'
                }

                return {
                    id: item.id,
                    avatar: avatar,
                    content: displayContent,
                    image: thumbImage // 👈 确保这里有值
                }
            })

            barrageList.value = realComments

            // 数据太少时补充默认数据
            if (realComments.length < 5) {
                barrageList.value = [...realComments, ...defaultBarrage]
            }
        }
    } catch (error) {
        console.error('❌ 获取最新弹幕失败:', error)
    }
}

// ==================== 4. 文章与分类逻辑 (动态化改造) ====================
// 4.1 图标映射表 (配置特定分类的图标，未配置的将使用默认图标)
const categoryIconMap = {
    'Veritas': '🪐',
    '生活倒影': '☕',
    '视听盛宴': '🎬',
    '学习人生': '📚',
    '海外趣事': '🌍',
    '爱心资源': '❤️',
    '技术分享': '💻', // 预埋一些可能用到的
    '心情随笔': '📝'
}

// 4.2 动态分类数据
const dbCategories = ref([]) // 存放从后端拿到的分类名列表

// 4.3 计算最终显示的分类菜单
const categories = computed(() => {
    // 1. 头部固定：最新
    const list = [
        { id: 'latest', name: '最新', icon: '🔥' }
    ]

    // 2. 中间动态：来自数据库
    dbCategories.value.forEach(catName => {
        // 🔥 核心修复：过滤掉重复的分类名
        // 如果数据库里有 '最新'、'战友'、'友链'，这里直接跳过，防止重复显示
        if (['最新', '战友', '友链'].includes(catName)) return

        list.push({
            id: catName, // 使用分类名作为ID
            name: catName,
            icon: categoryIconMap[catName] || '📂' // 如果没配置图标，默认用文件夹图标
        })
    })

    // 3. 尾部固定：友链 (改名)
    // 🔥 修改：将 '战友' 改为 '友链'
    list.push({ id: 'friends', name: '友链', icon: '⭐' })

    return list
})

const activeCategory = ref('latest')

// 🔥 获取所有分类
const fetchCategories = async () => {
    try {
        const res = await axios.get('/api/categories')
        if (res.data.success) {
            dbCategories.value = res.data.data
            // console.log('📦 动态分类加载完成:', dbCategories.value)
        }
    } catch (error) {
        console.error('❌ 获取分类列表失败:', error)
    }
}

// 文章数据
const articles = ref([])
const isLoadingArticles = ref(false)

// 🔥 核心修改：获取文章列表
// isLoadMore: true 表示点击了"加载更多"，false 表示切换分类或搜索（需要重置）
const fetchArticles = async (categoryName = 'latest', isLoadMore = false) => {
    // 1. 确定当前要查第几页
    const pageToFetch = isLoadMore ? currentPage.value + 1 : 1

    // 2. 设置 Loading 状态
    if (isLoadMore) {
        isLoadingMore.value = true
    } else {
        // 如果是全新加载，开启全屏骨架屏Loading（或者保留你现有的）
        isLoadingArticles.value = true
        // 重置状态
        currentPage.value = 1
        hasMore.value = true
        // 注意：如果是切换分类，先不清空 articles，防止页面闪烁，等数据回来再替换
    }

    try {
        // 3. 发送请求
        const res = await axios.get('/api/articles', {
            params: {
                category: categoryName,
                page: pageToFetch,
                limit: pageSize,
                keyword: searchQuery.value // 支持在搜索结果中分页
            }
        })

        if (res.data.success) {
            const { list, pagination } = res.data.data

            // 数据处理：补全评论数和浏览量（防止后端返回null）
            const processedList = list.map(article => ({
                ...article,
                comments: article.comments || 0,
                views: article.views || 0
            }))

            // 4. 数据更新逻辑
            if (isLoadMore) {
                // 追加模式：把新数据拼接到旧数据后面
                articles.value = [...articles.value, ...processedList]
                currentPage.value = pageToFetch // 页码+1
            } else {
                // 覆盖模式：替换所有数据
                articles.value = processedList
            }

            // 5. 判断是否还有更多数据
            // 如果当前拿到的数量 < pageSize，或者当前页已经是最后一页，说明没数据了
            if (processedList.length < pageSize || pageToFetch >= pagination.totalPages) {
                hasMore.value = false
            } else {
                hasMore.value = true
            }
        }
    } catch (error) {
        console.error('❌ 请求出错:', error)
    } finally {
        isLoadingArticles.value = false
        isLoadingMore.value = false
    }
}

// 专门用于"加载更多"按钮的点击事件
const handleLoadMore = () => {
    if (isLoadingMore.value || !hasMore.value) return

    // 使用当前选中的分类（如果是搜索状态，activeCategory会被清空，这里要注意）
    // 我们可以复用 fetchArticles 的逻辑
    const queryCat = isSearching.value ? '' : (activeCategory.value === 'latest' ? 'latest' : activeCategory.value)

    fetchArticles(queryCat, true) // true 表示这是追加加载
}

// 监听分类变化 (点击菜单时触发)
watch(activeCategory, (newCategory) => {
    if (newCategory === 'friends') return

    // 切换分类时，重置为第一页加载
    const queryCat = newCategory === 'latest' ? 'latest' : newCategory
    fetchArticles(queryCat, false)
})

// ==================== 🔥 新增：站点统计逻辑 ====================
const siteStats = ref({
    articleCount: 0,
    categoryCount: 0,
    totalViews: 0
})

// 获取站点统计数据 (确保数字实时更新)
const fetchSiteStats = async () => {
    try {
        const res = await axios.get('/api/blog/stats')
        if (res.data.success) {
            siteStats.value = res.data.data
        }
    } catch (error) {
        console.error('❌ 获取站点统计失败:', error)
    }
}

// 🔥 新增：控制公告栏是否显示的变量
const showNotice = ref(false)

// 修改获取公告的逻辑
const fetchLatestNotice = async () => {
    try {
        const res = await axios.get('/api/notices/latest')
        // 🔥 只有当 success 为 true 且 content 有内容时，才显示
        if (res.data.success && res.data.data.content) {
            notices.value[0].content = res.data.data.content
            showNotice.value = true // 显示
        } else {
            showNotice.value = false // 隐藏
        }
    } catch (error) {
        showNotice.value = false // 出错也隐藏
    }
}

// 1. 数据改为空
const friendLinks = ref([])

// 2. 添加获取函数
const fetchFriendLinks = async () => {
    try {
        // 注意：这里用 axios 或 api 都可以，但因为是前台公开接口，建议用 axios
        // 如果你的后端接口 '/api/friend_links' 不需要鉴权，直接调就行
        const res = await axios.get('/api/friend_links')
        if (res.data.success) {
            friendLinks.value = res.data.data
        }
    } catch (error) {
        console.error('获取友链失败', error)
        // 失败了可以给几个默认的，或者就空着
    }
}

const searchQuery = ref('')
const selectedTagId = ref(null)

const filteredArticles = computed(() => {
    if (selectedTagId.value) {
        return articles.value.filter(article => article.tag_id === selectedTagId.value)
    }
    return articles.value
})

const handleFriendClick = () => {
    activeCategory.value = 'friends'
    scrollToContent()
}

// 添加日期格式化函数
const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`
}

// 格式化日期时间
const formatDateTime = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}`
}

// ==================== 7. 推荐文章逻辑 ====================
const recommendedArticles = ref([])
const isLoadingHotArticles = ref(false)

// 🔥 修复后的获取热门文章函数
const fetchHotArticles = async () => {
    // console.log('🔥 开始获取热门文章...')
    isLoadingHotArticles.value = true

    try {
        // ✅ 使用相对路径，与其他接口保持一致
        const res = await axios.get('/api/articles/hot', {
            params: { limit: 3 },
            timeout: 10000
        })

        if (res.data.success) {
            if (!res.data.data || res.data.data.length === 0) {
                // console.log('⚠️ 热门文章列表为空')
                recommendedArticles.value = getDefaultRecommendations()
                return
            }

            const hotArticles = res.data.data
            // console.log(`✅ 获取到 ${hotArticles.length} 篇热门文章`)

            // 转换格式
            recommendedArticles.value = hotArticles.map(article => {
                let coverImage = article.cover_image
                if (!coverImage) {
                    coverImage = getDefaultCoverByCategory(article.category)
                }

                return {
                    id: article.id,
                    title: article.title,
                    date: article.has_been_updated
                        ? `📝 ${formatDateTime(article.updated_at)}`
                        : `📅 ${formatDateTime(article.created_at)}`,
                    isUpdated: article.has_been_updated || false,
                    cover: coverImage,
                    views: article.views || 0,
                    comments: article.comments || 0,
                    category: article.category || '',
                    summary: article.summary
                        ? (article.summary.length > 50
                            ? article.summary.substring(0, 50) + '...'
                            : article.summary)
                        : ''
                }
            })

            // console.log('✅ 热门文章处理完成:', recommendedArticles.value)
        } else {
            console.error('❌ API返回失败:', res.data)
            recommendedArticles.value = getDefaultRecommendations()
        }
    } catch (error) {
        console.error('❌ 获取热门文章失败') // 简化日志
        recommendedArticles.value = getDefaultRecommendations()
    } finally {
        isLoadingHotArticles.value = false
    }
}

// 根据分类获取默认封面图
const getDefaultCoverByCategory = (category) => {
    const categoryCovers = {
        'Veritas': 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?q=80&w=200&auto=format&fit=crop',
        '生活倒影': 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=200&auto=format&fit=crop',
        '视听盛宴': 'https://images.unsplash.com/photo-1496307667243-6b5d2447d8ef?q=80&w=200&auto=format&fit=crop',
        '学习人生': 'https://images.unsplash.com/photo-1501504905252-473c47e087f8?q=80&w=200&auto=format&fit=crop',
        '海外趣事': 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?q=80&w=200&auto=format&fit=crop',
        '爱心资源': 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?q=80&w=200&auto=format&fit=crop',
        '战友': 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=200&auto=format&fit=crop'
    }
    return categoryCovers[category] || 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?q=80&w=200&auto=format&fit=crop'
}

// 默认推荐文章（API失败时的后备方案）
const getDefaultRecommendations = () => {
    // console.log('⚠️ 使用默认推荐数据')
    const currentDate = new Date()
    const formattedDate = formatDateTime(currentDate)

    return [
        {
            id: 101,
            title: 'POETIZE - 文档导航与网站美化',
            date: `📅 ${formattedDate}`,
            cover: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?q=80&w=200&auto=format&fit=crop',
            isUpdated: false,
            views: 150,
            comments: 12,
            category: 'Veritas',
            summary: '探索POETIZE的强大功能'
        },
        {
            id: 102,
            title: 'Vue 3 + Vite 实战教程',
            date: `📝 ${formattedDate}`,
            cover: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=200&auto=format&fit=crop',
            isUpdated: true,
            views: 280,
            comments: 25,
            category: '学习人生',
            summary: '从入门到精通的Vue 3教程'
        },
        {
            id: 103,
            title: 'Node.js 后端开发指南',
            date: `📅 ${formattedDate}`,
            cover: 'https://images.unsplash.com/photo-1496307667243-6b5d2447d8ef?q=80&w=200&auto=format&fit=crop',
            isUpdated: false,
            views: 95,
            comments: 8,
            category: '学习人生',
            summary: '构建高效Node.js后端服务'
        }
    ]
}


// ==================== 🔥 搜索与交互逻辑 ====================
const isSearching = ref(false) // 标记当前是否处于搜索状态

// 执行搜索的核心函数
const performSearch = async (keyword) => {
    if (!keyword || !keyword.trim()) return

    console.log(`🔍 开始全站搜索: ${keyword}`)
    isLoadingArticles.value = true // 开启加载动画
    isSearching.value = true       // 标记为搜索模式

    try {
        const res = await axios.get('/api/articles/search', {
            params: { q: keyword }
        })

        if (res.data.success) {
            // 🔥 这里也要确保评论数格式正确
            articles.value = res.data.data.map(item => ({
                ...item,
                comments: item.comments || 0,
                views: item.views || 0
            }))

            activeCategory.value = ''      // 清空分类高亮，因为现在是搜索结果

            // 如果没搜到，给个提示
            if (articles.value.length === 0) {
                // 这里可以用 message 组件，或者直接让 UI 显示空状态
                console.log('未找到相关文章')
            }
        }
    } catch (error) {
        console.error('❌ 搜索请求失败:', error)
    } finally {
        isLoadingArticles.value = false
    }
    searchQuery.value = keyword
    // 调用 fetchArticles，它内部会读取 searchQuery.value
    fetchArticles('', false) // 传空分类，false表示重置
}

// 搜索框的回车事件
const handleSearch = () => {
    if (!searchQuery.value.trim()) return
    performSearch(searchQuery.value)
    scrollToContent() // 自动滚动到内容区
}

// 清除搜索，回到“最新”列表
const resetView = () => {
    searchQuery.value = ''
    isSearching.value = false
    activeCategory.value = 'latest' // 这会自动触发 watch，重新加载所有文章
    scrollToContent()
}

// ==================== 8. 其他逻辑 ====================
const typedText = ref('')
const fullText = "成就源于真理！"
let typeIndex = 0
let typeTimer = null
let statsTimer = null // 🔥 统计数据自动刷新定时器

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

// 🔥🔥 核心：数据自动刷新逻辑 🔥🔥
const refreshAllData = async () => {
    // 只有在不是搜索状态下才刷新列表，避免打断用户的搜索结果
    if (!isSearching.value && activeCategory.value !== 'friends') {
        const queryCat = activeCategory.value === 'latest' ? 'latest' : activeCategory.value
        await fetchArticles(queryCat, true) // true 表示静默刷新
    }
    // 始终刷新全站统计、弹幕和公告
    fetchSiteStats()
    fetchLatestComments()
    fetchLatestNotice() // 👈 新增：自动刷新公告
}

onMounted(async () => {
    // 1. 检查登录状态
    if (!userStore.user && localStorage.getItem('token')) {
        await userStore.checkLoginStatus()
    }

    // 2. 初始化视觉效果
    initWallpapers()
    startTyping()
    fetchTags()

    // 3. 🔥 获取数据 (初次加载)
    await fetchCategories()
    fetchArticles()
    fetchHotArticles()
    fetchSiteStats()
    fetchLatestComments()
    fetchLatestNotice() // 👈 新增：初次加载公告
    fetchFriendLinks() // 👈 加上这句

    // 4. 🔥 启动数据自动轮询 (每30秒刷新一次数据)
    statsTimer = setInterval(() => {
        refreshAllData()
    }, 30000)
})

onUnmounted(() => {
    if (carouselTimer) clearInterval(carouselTimer)
    if (typeTimer) clearInterval(typeTimer)
    if (statsTimer) clearInterval(statsTimer) // 销毁定时器
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

                <div class="sidebar-card profile-card-crystal">
                    <div class="profile-bg-illustration">
                        <img src="https://w.wallhaven.cc/full/5g/wallhaven-5gjgj8.jpg" class="illus-img" alt="bg">
                    </div>

                    <div class="profile-avatar-wrapper" @click="handleAvatarClick">
                        <img :src="profile.avatar" alt="Avatar" class="avatar-img">
                    </div>

                    <div class="profile-info-text">
                        <h2 class="profile-name">{{ profile.name }}</h2>
                    </div>

                    <div class="profile-stats-grid">
                        <div class="stat-col">
                            <div class="stat-label-row">
                                <span class="stat-icon">📖</span> <span class="stat-label">文章</span>
                            </div>
                            <div class="stat-num">{{ profile.articlesCount || 0 }}</div>
                        </div>
                        <div class="stat-col">
                            <div class="stat-label-row">
                                <span class="stat-icon">🗂️</span> <span class="stat-label">分类</span>
                            </div>
                            <div class="stat-num">{{ profile.categoryCount || 0 }}</div>
                        </div>
                        <div class="stat-col">
                            <div class="stat-label-row">
                                <span class="stat-icon">🔥</span> <span class="stat-label">访问量</span>
                            </div>
                            <div class="stat-num">{{ profile.visits || 0 }}</div>
                        </div>
                    </div>

                    <div class="profile-action-btn">
                        <button class="friend-btn-crystal" @click="handleFriendClick">
                            <span class="icon-star">☆</span> 友链
                        </button>
                    </div>
                </div>

                <div class="sidebar-card search-card-crystal">
                    <div class="card-header-row">
                        <div class="header-title"><span class="icon-search">🔍</span><span>搜索</span></div>
                        <div class="mac-dots"><span class="dot red"></span><span class="dot yellow"></span><span
                                class="dot green"></span></div>
                    </div>
                    <div class="search-input-wrapper">
                        <input type="text" v-model="searchQuery" placeholder="搜索文章..." @keyup.enter="handleSearch">
                        <div class="search-icon-btn" @click="handleSearch">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18">
                                <path fill="none" stroke="#48cbb6" stroke-width="3"
                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke-linecap="round"
                                    stroke-linejoin="round" />
                            </svg>
                        </div>
                    </div>
                </div>

                <div class="sidebar-card recommend-card-crystal">
                    <div class="card-header-row">
                        <div class="header-title"><span class="icon-thumb">👍</span><span>推荐文章</span></div>
                        <div class="mac-dots"><span class="dot red"></span><span class="dot yellow"></span><span
                                class="dot green"></span></div>
                    </div>

                    <div v-if="isLoadingHotArticles" class="loading-state">
                        <div class="loading-spinner"></div>
                        <div class="loading-text">加载推荐中...</div>
                    </div>

                    <div v-else class="recommend-list">
                        <div v-for="item in recommendedArticles" :key="item.id" class="recommend-item"
                            @click="router.push('/article/' + item.id)">
                            <div class="rec-top-section">
                                <div class="rec-thumb"><img :src="item.cover" alt="cover"></div>
                                <div class="rec-title-box">
                                    <h4 class="rec-title">{{ item.title }}</h4>
                                    <div v-if="item.isUpdated" class="rec-updated-badge">已更新</div>
                                </div>
                            </div>
                            <div class="rec-bottom-section">
                                <span class="rec-date">📅 {{ item.date }}</span>
                                <span v-if="item.views" class="rec-views">👁️ {{ item.views }}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="sidebar-card tag-card-crystal">
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

                <div class="sidebar-card barrage-card-crystal">
                    <div class="barrage-header">
                        <div class="header-title-white">
                            <span class="icon-barrage">✾</span>
                            <span>最新弹幕</span>
                        </div>
                        <div class="mac-dots">
                            <span class="dot red"></span>
                            <span class="dot yellow"></span>
                            <span class="dot green"></span>
                        </div>
                    </div>

                    <div class="barrage-container">
                        <div class="barrage-list-wrapper">
                            <div class="barrage-item" v-for="item in barrageList" :key="item.id">
                                <div class="barrage-avatar">
                                    <img :src="item.avatar" alt="user">
                                </div>

                                <div class="barrage-content-box">
                                    <span class="barrage-text">{{ item.content }}</span>

                                    <div v-if="item.image" class="barrage-thumb">
                                        <img :src="item.image" alt="图" loading="lazy">
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            <section class="content-wrapper animate__animated animate__fadeInUp">
                <!-- ✅ 正确的结构 -->
                <div v-if="showNotice" class="notice-bar">
                    <div class="notice-icon-box">
                        <svg class="notice-svg" viewBox="0 0 1194 1024" width="25" height="25">
                            <path
                                d="M445.894796 182.257258a1.50895 1.50895 0 0 0 0-3.0179 1.50895 1.50895 0 1 0 0 3.0179z m0 0"
                                fill="#FFFFFF"></path>
                            <path
                                d="M455.23868 119.287604L257.237325 332.397807H73.145396v262.982943h184.091929l195.176909 213.226276s2.824445-674.017119 2.824446-689.319422z m0 0"
                                fill="#F5D04C"></path>
                            <path
                                d="M451.408268 0.080535L230.443785 221.161091h-156.698678A73.783798 73.783798 0 0 0 0 294.906197v294.845008a73.803143 73.803143 0 0 0 73.745107 73.764452h156.698678l220.964483 221.06121a73.706416 73.706416 0 0 0 73.667724-73.745107v-737.064155A73.609688 73.609688 0 0 0 451.408268 0.119226m0 808.236308l-193.455159-213.419731H73.745107V300.052105h184.208002l193.455159-213.419732v721.68447m436.821748-333.74884c7.254568 0 13.193642-14.509137 13.193642-32.345702s-5.803655-32.326357-13.193642-32.326357h-92.181383c-7.254568 0-13.193642 14.509137-13.193642 32.326357s5.803655 32.345703 13.193642 32.345702h92.200729m9.982286-417.766415c6.345329-3.617611 4.120595-19.132715-4.739651-34.551091s-21.280067-25.149171-27.606052-21.473523L786.047001 46.838647c-6.345329 3.617611-4.120595 19.132715 4.739652 34.551092s21.280067 25.149171 27.606051 21.473522l79.819598-46.061673m0 770.957499c6.345329 3.617611 4.120595 19.132715-4.739651 34.551091s-21.280067 25.149171-27.606051 21.473523l-79.819599-46.061673c-6.345329-3.617611-4.120595-19.132715 4.739652-34.551092s21.280067 25.149171 27.606051 21.473522l79.819598 46.061673M576.960666 607.877953c-6.538784-17.720493-4.720306-34.454364 12.903459-40.993148 44.649451-20.661011 66.0069-60.764265 71.44299-111.159334 6.345329-58.732986-21.763705-112.648939-70.224223-134.915628-15.92136-10.175741-22.479489-27.915579-12.20701-43.740211s27.915579-22.460144 43.740211-12.187675c71.849246 41.728278 114.970401 114.273962 105.897354 198.098082-7.254568 67.109595-48.073607 130.601578-110.44355 157.801373-14.605864 8.260535-34.144836 2.921173-41.109221-12.903459"
                                fill="#ED752A"></path>
                        </svg>
                        <span class="notice-label" style="margin-left:5px">公告</span>
                    </div>
                    <div class="notice-content-wrapper">
                        <div class="scroll-text">{{ notices[0]?.content || '暂无公告' }}</div>
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

                    <div v-if="isSearching" class="search-result-bar animate__animated animate__fadeIn">
                        <div class="result-info">
                            <span class="search-icon">🔍</span>
                            <span>正在显示 <b>"{{ searchQuery }}"</b> 的搜索结果</span>
                            <span class="result-count">({{ articles.length }}篇)</span>
                        </div>
                        <button class="clear-search-btn" @click="resetView">✕ 清除筛选</button>
                    </div>

                    <div v-for="article in filteredArticles" :key="article.id"
                        class="article-card animate__animated animate__fadeInUp">

                        <div class="card-cover-wrapper" @click="router.push('/article/' + article.id)">
                            <img :src="article.cover_image" alt="cover" loading="lazy">
                        </div>

                        <div class="card-body">

                            <div class="meta-row date">
                                <span class="icon">📅</span>
                                <span>发布于 {{ formatDateTime(article.created_at) }}</span>
                            </div>

                            <h3 class="card-title" @click="router.push('/article/' + article.id)">
                                {{ article.title }}
                            </h3>

                            <div class="meta-row stats">
                                <div class="stat-item fire">
                                    <span class="icon">🔥</span> {{ article.views || 0 }} 热度
                                </div>
                                <div class="stat-item comment">
                                    <span class="icon">📝</span> {{ article.comments || 0 }} 评论
                                </div>
                            </div>

                            <div class="tags-row">
                                <div class="tag-pill category">
                                    <span class="icon">📂</span> {{ article.category || '未分类' }}
                                </div>

                                <div class="tag-pill tag clickable" @click.stop="router.push('/article/' + article.id)">
                                    <span class="icon">🏷️</span> 正文
                                </div>
                            </div>

                        </div>
                    </div>

                    <div v-if="articles.length === 0" class="empty-state">
                        📭 没有找到与 "{{ searchQuery }}" 相关的文章...
                        <br>
                        <span class="reset-link" @click="resetView">返回首页</span>
                    </div>

                    <div v-if="articles.length > 0 && activeCategory !== 'friends'"
                        class="pagination-container animate__animated animate__fadeInUp">
                        <button v-if="hasMore" class="load-more-btn" @click="handleLoadMore" :disabled="isLoadingMore">
                            <span v-if="isLoadingMore" class="loading-spinner-small"></span>
                            <span v-else>✨ 加载更多精彩</span>
                        </button>
                        <p v-else class="no-more-text">—— 到底啦，去看看别的分类吧 🪐 ——</p>
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
/* ==================== 0. 核心：晶体/玻璃质感混合 ==================== */
/* 所有侧边栏卡片的通用玻璃晶体基底 */
.sidebar-card,
.profile-card-crystal,
.search-card-crystal,
.recommend-card-crystal,
.tag-card-crystal {
    /* 大师要求：底部向上 浅绿色到更浅的渐变 */
    background: linear-gradient(0deg, #d9f4f0 0%, #f6fcfb 100%);

    /* 晶体质感：半透明 + 模糊 + 边框高光 */
    border-radius: 16px;
    box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.05);
    /* 柔和投影 */
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.8);
    /* 晶体白边 */
    margin-bottom: 25px;
    overflow: hidden;
    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.sidebar-card:hover,
.profile-card-crystal:hover {
    transform: translateY(-5px);
    box-shadow: 0 15px 40px rgba(72, 203, 182, 0.15);
    /* 悬浮时带一点点绿色光晕 */
    border-color: #fff;
}

/* ==================== 1. 个人资料卡片 (重构为图片样式) ==================== */
.profile-card-crystal {
    position: relative;
    padding-bottom: 25px;
    text-align: center;
}

/* 顶部背景图部分 */
.profile-bg-illustration {
    width: 100%;
    height: 140px;
    overflow: hidden;
    position: relative;
    clip-path: ellipse(130% 100% at 50% 0%);
    /* 底部微弧 */
}

.illus-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0.9;
}

/* 头像悬浮部分 */
.profile-avatar-wrapper {
    width: 85px;
    height: 85px;
    margin: -45px auto 10px;
    /* 向上偏移，压住背景图 */
    border-radius: 50%;
    border: 2px rgba(145, 145, 145, 0.9);
    padding: 2px;
    background: #fff;
    cursor: pointer;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
    position: relative;
    z-index: 2;
    transition: transform 0.5s ease;
}

.profile-avatar-wrapper:hover {
    transform: rotate(360deg);
}

.avatar-img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
}

/* 名字文本 */
.profile-info-text {
    margin-bottom: 20px;
}

.profile-name {
    font-size: 1.8rem;
    font-weight: 700;
    color: #2c3e50;
    letter-spacing: 1px;
    margin: 0;
    font-family: 'PingFang SC', sans-serif;
    /* 简洁字体 */
}

/* 统计数据网格 - 图标文字在上，数字在下 */
.profile-stats-grid {
    display: flex;
    justify-content: space-around;
    padding: 0 20px;
    margin-bottom: 25px;
}

.stat-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    transition: transform 0.2s;
}

.stat-col:hover {
    transform: translateY(-3px);
}

.stat-label-row {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.9rem;
    color: #666;
    font-weight: 500;
}

.stat-num {
    font-size: 1.2rem;
    font-weight: 700;
    color: #333;
    font-family: 'Helvetica Neue', sans-serif;
}

/* 友站按钮 - 图片同款 */
.profile-action-btn {
    padding: 0 30px;
}

.friend-btn-crystal {
    width: 100%;
    height: 45px;
    /* 图片上的按钮颜色接近 teal/ocean green */
    background: #48cbb6;
    border: none;
    border-radius: 50px;
    color: white;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    box-shadow: 0 5px 15px rgba(72, 203, 182, 0.3);
    transition: all 0.3s;
}

.friend-btn-crystal:hover {
    background: #3bb39e;
    transform: scale(1.02);
    box-shadow: 0 8px 20px rgba(72, 203, 182, 0.4);
}

/* ==================== 2. 全局与 Hero 区域 (保持) ==================== */
.blog-page {
    font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', sans-serif;
    background-color: #f6f8fa;
    /* 整体背景稍微改灰白一点，突出卡片 */
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

/* ==================== 3. 主体布局容器 ==================== */
.main-container {
    max-width: 1300px;
    margin: 0 auto;
    padding: 40px 20px;
    display: flex;
    gap: 30px;
    position: relative;
    z-index: 10;
    /* 确保在 wave 上方 */
}

.sidebar-wrapper {
    width: 300px;
    flex-shrink: 0;
    position: sticky;
    top: 20px;
    height: fit-content;
    z-index: 10;
}

.content-wrapper {
    flex: 1;
    min-width: 0;
}

/* ==================== 4. 侧边栏通用头部 (搜索/推荐/标签) ==================== */
.search-card-crystal,
.recommend-card-crystal,
.tag-card-crystal {
    padding: 15px 20px;
}

.card-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
    border-bottom: 1px dashed rgba(0, 0, 0, 0.05);
    /* 淡淡的分割线 */
    padding-bottom: 10px;
}

.header-title {
    font-size: 1.1rem;
    font-weight: 700;
    color: #333;
    display: flex;
    align-items: center;
    gap: 6px;
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
    border: 2px solid #e0f2f1;
    /* 浅青色边框 */
    border-radius: 50px;
    /* 更圆润 */
    padding: 4px;
    background: rgba(255, 255, 255, 0.8);
    display: flex;
    align-items: center;
    transition: border-color 0.3s;
}

.search-input-wrapper:focus-within {
    border-color: #48cbb6;
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

.search-icon-btn {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    cursor: pointer;
    opacity: 0.7;
    transition: all 0.2s;
    display: flex;
}

.search-icon-btn:hover {
    opacity: 1;
    transform: translateY(-50%) scale(1.1);
}

/* ==================== 5. 推荐文章列表 ==================== */
.recommend-list {
    display: flex;
    flex-direction: column;
    gap: 15px;
}

.recommend-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
    cursor: pointer;
    padding: 10px;
    border-radius: 8px;
    transition: background 0.2s;
}

.recommend-item:hover {
    background: rgba(255, 255, 255, 0.5);
}

.rec-top-section {
    display: flex;
    gap: 12px;
    align-items: flex-start;
}

.rec-thumb {
    width: 90px;
    height: 60px;
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
    font-size: 0.9rem;
    font-weight: 500;
    color: #333;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    transition: color 0.2s;
}

.recommend-item:hover .rec-title {
    color: #48cbb6;
}

.rec-bottom-section {
    display: flex;
    align-items: center;
}

.rec-date {
    font-size: 0.75rem;
    color: #999;
}

/* ==================== 6. 3D 标签云 (透明背景) ==================== */
.tag-cloud-3d-box {
    position: relative;
    width: 100%;
    height: 320px;
    /* 去掉原有深色背景，保持通透 */
    border-radius: 12px;
    overflow: hidden;
}

.tag-pill-3d {
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    align-items: stretch;
    height: 30px;
    /* 稍微小一点 */
    border-radius: 50px;
    cursor: pointer;
    user-select: none;
    /* 胶囊晶体感 */
    background: rgba(255, 255, 255, 0.25);
    backdrop-filter: blur(4px);
    border: 1px solid rgba(255, 255, 255, 0.6);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
    will-change: transform, opacity, z-index;
    transition: box-shadow 0.3s;
}

.tag-icon-part {
    width: 28px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.5);
    border-right: 1px solid rgba(255, 255, 255, 0.3);
    border-top-left-radius: 50px;
    border-bottom-left-radius: 50px;
}

.tag-text-part {
    flex-grow: 1;
    padding: 0 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
    /* 使用 tag-color 做文字颜色，背景保持玻璃白，更清爽 */
    color: var(--tag-color);
    font-size: 0.8rem;
    font-weight: 700;
    background: rgba(255, 255, 255, 0.8);
    border-top-right-radius: 50px;
    border-bottom-right-radius: 50px;
}

.tag-pill-3d:hover {
    box-shadow: 0 8px 15px rgba(0, 0, 0, 0.1);
    background: #fff;
    z-index: 1000 !important;
}

/* ==================== 7. 主体内容区 (卡片化) ==================== */
.notice-bar,
.category-bar,
.article-card,
.friend-card {
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.03);
    border: 1px solid #f0f0f0;
    margin-bottom: 25px;
    transition: transform 0.3s, box-shadow 0.3s;
}

.notice-bar {
    padding: 12px 20px;
    display: flex;
    align-items: center;
    gap: 15px;
    overflow: hidden;
}

.notice-bar:hover,
.category-bar:hover,
.article-card:hover,
.friend-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08);
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

.category-bar {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 15px 25px;
    flex-wrap: wrap;
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
    color: #48cbb6;
    background: rgba(72, 203, 182, 0.1);
}

.cat-item.active {
    color: white;
    background: linear-gradient(90deg, #48cbb6, #2c3e50);
    box-shadow: 0 4px 10px rgba(72, 203, 182, 0.3);
}

.friend-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 20px;
}

.friend-card {
    padding: 20px;
    display: flex;
    align-items: center;
    gap: 15px;
    cursor: pointer;
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

/* ==================== 🔥 全新文章卡片样式 ==================== */

/* 1. 网格布局 (保证 3 列) */
.article-grid {
    display: grid;
    /* 最小宽度 280px，保证大屏 3 列，中屏 2 列 */
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 25px;
    align-items: start;
    /* 防止卡片高度强制拉伸 */
}

/* 2. 卡片容器 */
.article-card {
    background: #fff;
    border-radius: 16px;
    /* 大圆角 */
    overflow: hidden;
    /* 裁剪图片圆角 */
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.06);
    /* 初始柔和阴影 */
    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
    border: 1px solid #f0f0f0;
    display: flex;
    flex-direction: column;
    height: 100%;
    /* 占满网格高度 */
}

.article-card:hover {
    transform: translateY(-8px);
    /* 悬浮上移 */
    box-shadow: 0 15px 30px rgba(0, 0, 0, 0.1);
    /* 阴影加深 */
    border-color: rgba(72, 203, 182, 0.3);
    /* 边框泛微绿 */
}

/* 3. 封面图区域 (纯净版) */
.card-cover-wrapper {
    height: 135px;
    /* 固定高度，紧凑型 */
    position: relative;
    overflow: hidden;
    cursor: pointer;
}

.card-cover-wrapper img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    /* 裁剪填充 */
    transition: transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

/* 图片悬停放大 */
.article-card:hover .card-cover-wrapper img {
    transform: scale(1.1);
}

/* 4. 内容区域 */
.card-body {
    padding: 15px 18px 18px;
    display: flex;
    flex-direction: column;
    flex: 1;
    /* 关键：占满卡片剩余高度 */
    position: relative;
    /* 为绝对定位做准备(如果需要) */
}

/* 日期行 */
.meta-row.date {
    font-size: 0.8rem;
    color: #999;
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
    /* 固定间距 */
    flex-shrink: 0;
    /* 防止被压缩 */
}

.meta-row.date .icon {
    opacity: 0.7;
}

/* 标题 */
.card-title {
    font-size: 1.1rem;
    font-weight: 700;
    color: #333;

    /* 🔥 修改：间距改小 */
    margin: 0 0 6px 0;

    /* 🔥 修改：行高设为 1.4，两行高度约为 2.8rem -> 3.1rem (视字体而定) */
    /* 给它一个刚好够放两行的固定高度，这样无论标题长短，下方内容起始位置都一样 */
    line-height: 1.4;
    height: 3.1rem;

    cursor: pointer;
    transition: color 0.2s;

    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
}

.card-title:hover {
    color: #48cbb6;
    /* 悬停变色 */
}

/* 热度/评论统计行 */
.meta-row.stats {
    display: flex;
    gap: 15px;
    font-size: 0.75rem;
    /* 字体改小一点点更精致 */
    color: #999;
    /* 颜色淡一点 */

    /* 🔥 关键：删掉 margin-top: auto，改为固定小间距 */
    /* 这样它就会紧紧贴在标题下面，消灭红框空白 */
    margin-top: 4px;
    margin-bottom: 10px;
}

.stat-item {
    display: flex;
    align-items: center;
    gap: 4px;
}

.stat-item.fire {
    color: #ff5722;
}

/* 热度红 */
.stat-item.comment {
    color: #795548;
}

/* 评论褐 */

/* 5. 底部标签行 (胶囊样式) */
.tags-row {
    display: flex;
    gap: 10px;

    /* 🔥 关键：也不要 auto，让它自然跟在 stats 后面 */
    /* 这样整个内容块就非常紧凑了 */
    margin-top: 0;
}

.tag-pill {
    padding: 3px 8px;
    /* 🔥 内边距改小 */
    border-radius: 6px;
    font-size: 0.7rem;
    /* 字体改小 */
    display: flex;
    align-items: center;
    gap: 4px;
    font-weight: 500;
    transition: all 0.2s;
}

/* 分类标签 (黄色系) */
.tag-pill.category {
    background: #fff7e6;
    color: #fa8c16;
    border: 1px solid rgba(250, 140, 22, 0.2);
}

.tag-pill.category:hover {
    background: #ffe7ba;
}

/* 普通标签 (紫色系) */
.tag-pill.tag {
    background: #f9f0ff;
    color: #722ed1;
    border: 1px solid rgba(114, 46, 209, 0.2);
}

/* 可点击标签样式 */
.tag-pill.tag.clickable {
    cursor: pointer;
}

.tag-pill.tag.clickable:hover {
    background: #722ed1;
    color: white;
    border-color: #722ed1;
    transform: translateY(-2px);
    box-shadow: 0 4px 10px rgba(114, 46, 209, 0.3);
}

/* 移动端适配 */
@media (max-width: 768px) {
    .article-grid {
        grid-template-columns: 1fr;
        /* 手机端单列 */
    }

    .card-cover-wrapper {
        height: 180px;
        /* 手机上图片可以高一点 */
    }
}

.card-tag {
    position: absolute;
    top: 10px;
    left: 10px;
    background: linear-gradient(90deg, #48cbb6, #2c3e50);
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
    color: #48cbb6;
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
    color: #48cbb6;
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

/* ==================== 🔥 8. 新增：弹幕侧边栏样式 (核心实现) ==================== */
.barrage-card-crystal {
    background-image: url('https://w.wallhaven.cc/full/g7/wallhaven-g7x767.jpg');
    background-size: cover;
    background-position: center bottom;
    /* 确保山峰在底部 */
    position: relative;
    height: 400px;
    /* 固定高度 */
    display: flex;
    flex-direction: column;
    padding: 0 !important;
    /* 覆盖默认padding */
    border: none;
}

/* 顶部标题区 */
.barrage-header {
    background: rgba(255, 255, 255, 0.3);
    padding: 15px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgb(216, 254, 250);
    z-index: 2;
}

.header-title-white {
    font-size: 1.1rem;
    font-weight: 400;
    color: rgb(0, 0, 0);
    display: flex;
    align-items: center;
    gap: 8px;
}

.icon-barrage {
    font-size: 1.3rem;
    color: rgb(81, 213, 154);
    animation: spin 4s linear infinite;
    display: inline-block;
}

@keyframes spin {
    0% {
        transform: rotate(0deg);
    }

    100% {
        transform: rotate(360deg);
    }
}

/* 弹幕内容容器 */
.barrage-container {
    flex: 1;
    overflow: hidden;
    /* 隐藏溢出内容 */
    position: relative;
    /* 加上一层淡白色遮罩，让文字更清晰，同时保留背景图 */
    background: rgba(255, 255, 255, 0.3);
}

.barrage-list-wrapper {
    /* 核心动画：无限向上滚动 */
    animation: scroll-up 3s linear infinite;
    padding: 10px;
}

/* 鼠标悬停时暂停滚动 */
.barrage-container:hover .barrage-list-wrapper {
    animation-play-state: paused;
}

@keyframes scroll-up {
    0% {
        transform: translateY(0);
    }

    100% {
        transform: translateY(-50%);
    }

    /* 向上移动一半高度（配合双份数据） */
}

/* 单条弹幕 */
.barrage-item {
    color: #000;
    flex-shrink: 0;
    padding-right: 12px;
    /* 右侧留点空隙给图片 */
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
    padding: 4px 10px 4px 4px;
    border-radius: 50px;
    background: rgba(255, 255, 255, 0.6);
    backdrop-filter: blur(4px);
    transition: transform 0.2s, background 0.2s;
    width: fit-content;
    max-width: 98%;
    /* 稍微放宽一点 */
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);

    /* 🔥 关键：防止 flex 子元素被压缩 */
}

.barrage-item:hover {
    transform: scale(1.02) translateX(5px);
    background: rgba(255, 255, 255, 0.9);
    z-index: 10;
}

.barrage-avatar img {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
    border: 1px solid #fff;
}

/* ==================== 🔥 弹幕图片显示修复 ==================== */

.barrage-content-box {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    /* 关键：允许Flex子项收缩 */
    flex: 1;
}

.barrage-text {
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 140px;
    /* 给图片留出位置 */
    color: #333;
    font-size: 0.9rem;
}

/* 🔥 图片容器核心修复 */
/* 修改 Blog.vue 中的 .barrage-thumb */
.barrage-thumb {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 26px;
    height: 26px;
    margin-left: 4px;
    background-color: #f0f0f0;
    /* 🔥 加个底色调试 */
    border-radius: 4px;
    overflow: hidden;
    /* 防止图片溢出 */
}

.barrage-thumb img {
    width: 100%;
    height: 100%;
    border-radius: 4px;
    object-fit: cover;
    border: 1px solid rgba(255, 255, 255, 0.8);
    background-color: #fff;
    cursor: zoom-in;
    display: block;
}

/* 悬停放大效果 */
.barrage-thumb img:hover {
    transform: scale(4);
    z-index: 999;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    border-radius: 4px;
    position: relative;
    /* 确保层级生效 */
}

/* 🔥 新增：加载状态样式 */
.loading-state {
    grid-column: 1 / -1;
    text-align: center;
    padding: 60px 20px;
    color: #666;
}

.loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #f3f3f3;
    border-top: 3px solid #42b883;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 15px;
}

@keyframes spin {
    0% {
        transform: rotate(0deg);
    }

    100% {
        transform: rotate(360deg);
    }
}

/* 🔥 推荐文章的额外样式 */
.recommend-item .rec-title-box {
    position: relative;
}

.rec-updated-badge {
    position: absolute;
    top: -5px;
    right: 0;
    background: linear-gradient(90deg, #ff6b6b, #ff8e53);
    color: white;
    font-size: 0.6rem;
    padding: 1px 5px;
    border-radius: 3px;
    font-weight: bold;
    transform: scale(0.8);
}

.rec-bottom-section {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.75rem;
    color: #999;
    margin-top: 5px;
}

.rec-views {
    font-size: 0.7rem;
    opacity: 0.8;
}

/* 加载状态样式 */
.loading-state {
    text-align: center;
    padding: 20px;
}

.loading-spinner {
    width: 30px;
    height: 30px;
    border: 3px solid #f3f3f3;
    border-top: 3px solid #48cbb6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 10px;
}

.loading-text {
    color: #999;
    font-size: 0.9rem;
}

@keyframes spin {
    0% {
        transform: rotate(0deg);
    }

    100% {
        transform: rotate(360deg);
    }
}

/* 推荐项目悬停效果增强 */
.recommend-item {
    position: relative;
    overflow: hidden;
}

.recommend-item::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(72, 203, 182, 0.1), transparent);
    transition: left 0.5s;
}

.recommend-item:hover::before {
    left: 100%;
}

.search-result-bar {
    background: #e8f5e9;
    color: #2e7d32;
    padding: 10px 15px;
    border-radius: 8px;
    margin-bottom: 20px;
    font-size: 0.95rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border: 1px solid #c8e6c9;
}

.clear-search {
    cursor: pointer;
    font-weight: bold;
    opacity: 0.7;
    transition: opacity 0.2s;
}

.clear-search:hover {
    opacity: 1;
}

/* ==================== 🔥 搜索提示条样式 ==================== */
.search-result-bar {
    grid-column: 1 / -1;
    /* 占满整行 */
    background: #e0f7fa;
    /* 浅青色背景 */
    border: 1px solid #b2ebf2;
    border-radius: 12px;
    padding: 12px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    color: #006064;
}

.result-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.95rem;
}

.result-count {
    background: rgba(255, 255, 255, 0.5);
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 0.85rem;
    font-weight: bold;
}

.clear-search-btn {
    background: transparent;
    border: 1px solid #0097a7;
    color: #00838f;
    padding: 6px 14px;
    border-radius: 20px;
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.3s;
}

.clear-search-btn:hover {
    background: #0097a7;
    color: white;
}

.reset-link {
    display: inline-block;
    margin-top: 10px;
    color: #48cbb6;
    text-decoration: underline;
    cursor: pointer;
}

/* ==================== 分页加载样式 ==================== */
.pagination-container {
    grid-column: 1 / -1;
    /* 占满网格整行 */
    display: flex;
    justify-content: center;
    margin-top: 30px;
    margin-bottom: 20px;
}

.load-more-btn {
    padding: 12px 40px;
    border-radius: 50px;
    border: none;
    background: white;
    color: #48cbb6;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 15px rgba(72, 203, 182, 0.2);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    align-items: center;
    gap: 8px;
    outline: none;
}

.load-more-btn:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 25px rgba(72, 203, 182, 0.35);
    background: #f0fdfa;
    /* 极浅的青色背景 */
}

.load-more-btn:active {
    transform: scale(0.98);
}

.load-more-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
}

.no-more-text {
    color: #999;
    font-size: 0.9rem;
    letter-spacing: 1px;
    font-family: 'PingFang SC', sans-serif;
    padding: 10px;
}

/* 按钮内的小 Loading */
.loading-spinner-small {
    width: 16px;
    height: 16px;
    border: 2px solid #48cbb6;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}
</style>