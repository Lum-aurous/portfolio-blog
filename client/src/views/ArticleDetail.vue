<script setup>
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user.js'
import { message } from '@/utils/message.js'
import { api } from '@/utils/api'
import MarkdownIt from 'markdown-it'
import 'github-markdown-css/github-markdown-light.css'
import html2canvas from 'html2canvas'
import CommentItem from '@/components/CommentItem.vue'

const md = new MarkdownIt({ html: true, linkify: true, breaks: true })
const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const article = ref(null)
const comments = ref([])
const commentContent = ref('')
const isSubmitting = ref(false)
const loading = ref(true)

const isLoggedIn = computed(() => !!userStore.token)
const currentUser = computed(() => userStore.user || {})
const isAdmin = computed(() => userStore.user?.role === 'admin')

// ===== Emoji & 图片 =====
const showEmojiPicker = ref(false)
const selectedImages = ref([])
const imageInputRef = ref(null)

// 🔥 YouTube 风格折叠逻辑
const expandedReplies = ref(new Set())

const toggleReplies = (commentId) => {
    if (expandedReplies.value.has(commentId)) {
        expandedReplies.value.delete(commentId)
    } else {
        expandedReplies.value.add(commentId)
    }
}

const isRepliesVisible = (commentId) => {
    return expandedReplies.value.has(commentId)
}

// 🔥 辅助函数
const formatRelativeTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return '刚刚';
    if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)} 天前`;
    if (diff < 31536000) return `${Math.floor(diff / 2592000)} 个月前`;
    return `${Math.floor(diff / 31536000)} 年前`;
};

const formatCount = (count) => {
    if (!count) return '';
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count;
};

const emojis = [
    '😀', '😁', '😂', '🤣', '😊', '😍', '😘', '😎',
    '😢', '😭', '😡', '🤔', '👍', '👎', '🙏', '🔥',
    '🎉', '❤️', '✨', '💯'
]

const insertEmoji = (emoji) => {
    const textarea = document.getElementById('comment-input')
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd

    commentContent.value =
        commentContent.value.slice(0, start) +
        emoji +
        commentContent.value.slice(end)

    nextTick(() => {
        textarea.focus()
        textarea.selectionStart = textarea.selectionEnd = start + emoji.length
    })

    showEmojiPicker.value = false
}

const closeEmojiPicker = (e) => {
    // 确保点击面板内部或者点击风车按钮时，不会触发关闭
    if (!e.target.closest('.emoji-panel') &&
        !e.target.closest('.windmill')) {
        showEmojiPicker.value = false
    }
}

const showLoginTip = () => {
    if (!isLoggedIn.value) {
        message.warning('请先登录后再留言')
    }
}

const goToLogin = () => {
    router.push('/login')
}

const showWelcomeMessage = () => {
    message.success(`欢迎回来，${currentUser.value.nickname || currentUser.value.username}！`)
}

const restoreCommentContent = () => {
    const savedContent = localStorage.getItem('temp_comment')
    if (savedContent && isLoggedIn.value) {
        commentContent.value = savedContent
        localStorage.removeItem('temp_comment')
        message.info('已恢复您之前输入的内容')
    }
}

const handleImageUpload = () => {
    imageInputRef.value?.click()
}

const MAX_IMAGES = 9

const handleSelectImage = (e) => {
    const files = Array.from(e.target.files)
    for (const file of files) {
        if (selectedImages.value.length >= MAX_IMAGES) {
            message.warning(`最多只能上传 ${MAX_IMAGES} 张图片`)
            break
        }
        const url = URL.createObjectURL(file)
        selectedImages.value.push({ file, url })
    }
    e.target.value = ''
}

const removeImage = (index) => {
    URL.revokeObjectURL(selectedImages.value[index].url)
    selectedImages.value.splice(index, 1)
}

// ===========================
// 🔥 火箭回到顶部逻辑
// ===========================
const isLaunching = ref(false)
let scrollCheckInterval = null

const handleScrollToTop = () => {
    if (isLaunching.value) return
    isLaunching.value = true
    window.scrollTo({ top: 0, behavior: 'smooth' })
    if (scrollCheckInterval) clearInterval(scrollCheckInterval)

    // 监听滚动，直到顶部才停止动画
    scrollCheckInterval = setInterval(() => {
        if (window.scrollY <= 50) {
            clearInterval(scrollCheckInterval)
            scrollCheckInterval = null
            isLaunching.value = false
        }
    }, 100)
}

// 🔥 修复：递归统计所有评论（包括无限级嵌套）
const countAllComments = (commentList) => {
    let total = 0
    for (const comment of commentList) {
        total += 1 // 当前评论本身
        if (comment.replies && comment.replies.length > 0) {
            total += countAllComments(comment.replies) // 递归统计子回复
        }
    }
    return total
}

const totalCommentCount = computed(() => {
    return countAllComments(comments.value)
})


// Markdown 渲染
const renderedContent = computed(() => {
    if (!article.value || !article.value.content) return ''
    return md.render(article.value.content)
})

const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

const formatFullTime = (dateStr) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleString()
}

// 主题色控制
// 1. 定义颜色变量
const highlightColor = ref('#d6a354') // 默认颜色

// 2. 定义主题列表
const textThemes = [
    { id: 'classic', name: '经典', color: '#f7d794', fontColor: '#d6a354' },
    { id: 'chocolate', name: '巧克力', color: '#d2a679', fontColor: '#8b5a2b' },
    { id: 'purple', name: '暮山紫', color: '#dcd6f7', fontColor: '#9370db' }
]

// 3. 切换颜色的函数
const changeHighlightColor = (theme) => {
    highlightColor.value = theme.fontColor
    message.success(`主题已切换为：${theme.name}`)
}

// 4. 将变量绑定到 CSS 变量
const contentStyle = computed(() => ({
    '--highlight-color': highlightColor.value
}))

// API 请求
const fetchArticle = async () => {
    loading.value = true;
    try {
        const res = await api.get(`/articles/${route.params.id}`);
        if (res.data.success) {
            article.value = res.data.data;
            api.post(`/articles/${route.params.id}/view`).catch(err => console.warn(err));
        } else {
            message.error('文章不存在');
            router.push('/');
        }
    } catch (error) {
        message.error('加载文章失败');
    } finally {
        loading.value = false;
    }
};

const fetchComments = async () => {
    try {
        const res = await api.get('/comments', {
            params: { article_id: route.params.id }
        });
        if (res.data.success) {
            comments.value = res.data.data || [];
        }
    } catch (error) {
        message.error('加载评论失败');
    }
};

const replyTarget = ref(null)

const submitComment = async () => {
    if (!isLoggedIn.value) return message.error('您还没有登录,不可进行评论！!')

    if (!commentContent.value.trim() && selectedImages.value.length === 0) {
        return message.warning('不能发送空评论')
    }

    isSubmitting.value = true

    try {
        let imageUrls = []
        if (selectedImages.value.length) {
            const formData = new FormData()
            selectedImages.value.forEach(i => formData.append('images', i.file))
            const uploadRes = await api.post('/upload/comment-images', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })
            if (uploadRes.data.success) {
                imageUrls = uploadRes.data.data.urls
            }
        }

        const payload = {
            article_id: parseInt(route.params.id),
            content: commentContent.value,
            images: imageUrls,
            // 直接使用 replyTarget 中的 rootId (其实就是被回复的评论ID)
            parent_id: replyTarget.value ? replyTarget.value.rootId : null
        }

        const res = await api.post('/comments', payload)

        if (res.data.success) {
            message.success('发送成功！')
            commentContent.value = ''
            selectedImages.value = []

            // 自动展开回复的楼层
            if (replyTarget.value) {
                expandedReplies.value.add(replyTarget.value.rootId)
            }

            cancelReply()
            fetchComments()
            api.post(`/articles/${route.params.id}/update-comments-count`)
        }
    } catch (e) {
        message.error('评论失败: ' + (e.response?.data?.message || e.message))
    } finally {
        isSubmitting.value = false
    }
}

// 🔥 关键修改：回复逻辑
// 在无限级评论中，我回复了A，那么我的 parent_id 就是 A.id
const setReplyTarget = (comment) => {
    if (!isLoggedIn.value) return message.warning('请登录后回复')

    replyTarget.value = {
        id: comment.id,
        nickname: comment.nickname,
        // 🔥 这里改了：直接用当前点击的评论ID作为 parent_id
        // 不需要找 rootId 了，因为后端现在支持直接挂载
        rootId: comment.id
    }

    // 聚焦输入框...
    const inputEl = document.getElementById('comment-input')
    if (inputEl) {
        inputEl.focus()
        inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
}

const cancelReply = () => {
    replyTarget.value = null
    commentContent.value = ''
}

// 增加一个 handleReply 中转函数
const handleReply = (comment) => {
    setReplyTarget(comment)
}

const handleAction = async (comment, action) => {
    if (!isLoggedIn.value) return message.warning('请登录后参与互动')

    const originalState = { liked: comment.is_liked, disliked: comment.is_disliked, count: comment.like_count }

    if (action === 'like') {
        if (comment.is_liked) {
            comment.is_liked = false
            comment.like_count--
        } else {
            comment.is_liked = true
            comment.like_count++
            if (comment.is_disliked) comment.is_disliked = false
        }
    } else if (action === 'dislike') {
        if (comment.is_disliked) {
            comment.is_disliked = false
        } else {
            comment.is_disliked = true
            if (comment.is_liked) {
                comment.is_liked = false
                comment.like_count--
            }
        }
    }

    try {
        await api.post(`/comments/${comment.id}/action`, { action })
    } catch (e) {
        Object.assign(comment, originalState)
        message.error('操作失败')
    }
}

const deleteComment = async (id) => {
    if (!confirm('确定删除?')) return
    try {
        await api.delete(`/comments/${id}`)
        message.success('已删除')
        fetchComments()
    } catch (e) {
        message.error('删除失败')
    }
}

const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

watch(isLoggedIn, (newVal) => {
    if (newVal) {
        restoreCommentContent()
        showWelcomeMessage()
    }
})

watch(commentContent, (newVal) => {
    if (!isLoggedIn.value && newVal.trim()) {
        localStorage.setItem('temp_comment', newVal)
    }
})

// ==========================================
// 🔥 新增功能逻辑区
// ==========================================

// 1. 版权信息逻辑
const copyrightInfo = ref('')
const fetchCopyright = async () => {
    // 模拟从数据库获取，后续替换为真实接口 api.get('/config/copyright')
    // 这里的文本可以很长，前端 CSS 会控制只显示前几行或简化版
    const defaultText = `1. 本网站部分内容可能来源于网络,仅供大家学习与参考，如有侵权，请联系站长进行删除处理。\n2. 本网站一切内容不代表本站立场，并不代表本站赞同其观点和对其真实性负责。\n3. 版权&许可请详阅 版权声明`
    copyrightInfo.value = defaultText
}

// 2. 订阅功能
const isSubscribed = ref(false)
const handleSubscribe = async () => {
    if (!isLoggedIn.value) {
        message.warning('请先登录后订阅')
        router.push('/login')
        return
    }

    // 模拟 API 调用
    try {
        isSubscribed.value = !isSubscribed.value
        if (isSubscribed.value) {
            message.success('订阅成功！文章更新将第一时间通知您')
        } else {
            message.info('已取消订阅')
        }
    } catch (e) {
        message.error('操作失败')
    }
}

// 3. 分享卡片相关逻辑
const showShareModal = ref(false)
const shareCardRef = ref(null) // 绑定卡片 DOM
const isGeneratingCard = ref(false)
const cardBgColor = ref('#fff9c4') // 默认浅黄色 (Material Light Yellow)

// 预设颜色列表
const cardColors = [
    '#fff9c4', // 默认黄
    '#e1bee7', // 浅紫
    '#b2dfdb', // 浅青
    '#ffccbc', // 浅红
    '#f0f4c3', // 浅绿
    '#cfd8dc', // 浅灰
    '#ffffff'  // 纯白
]

const handleShareClick = () => {
    if (!isLoggedIn.value) {
        message.warning('请先登录后下载分享卡片')
        router.push('/login')
        return
    }

    // 🔥 新增：调试日志
    console.log('📸 当前文章封面:', article.value?.cover_image)
    console.log('📸 代理后的URL:', getProxyUrl(article.value?.cover_image))

    showShareModal.value = true
}

const closeShareModal = (e) => {
    // 点击背景关闭
    if (e.target.classList.contains('share-modal-overlay')) {
        showShareModal.value = false
    }
}

// 🔥 核心：生成并下载图片
const downloadCard = async () => {
    if (!shareCardRef.value) return
    isGeneratingCard.value = true

    try {
        // 🔥 稍微等待 100ms，让 DOM 完全渲染
        await nextTick()

        const canvas = await html2canvas(shareCardRef.value, {
            useCORS: true, // 必须为 true
            allowTaint: true, // 允许跨域图片污染画布
            scale: 2,
            backgroundColor: null,
            logging: true, // 开启日志，方便 F12 查看 html2canvas 的具体报错
        })

        const imgUrl = canvas.toDataURL('image/png')

        // 创建临时下载链接
        const link = document.createElement('a')
        link.download = `Veritas_Share_${article.value.id}.png`
        link.href = imgUrl
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        message.success('卡片已保存到本地！')
        showShareModal.value = false
    } catch (err) {
        console.error(err)
        message.error('生成卡片失败，请重试')
    } finally {
        isGeneratingCard.value = false
    }
}

// 🔥 增强版：带降级处理的代理 URL
const getProxyUrl = (url) => {
    if (!url) return ''

    // 如果是本地上传的图片或 Base64，直接返回
    if (url.startsWith('/uploads') || url.startsWith('data:') || url.startsWith('/api')) {
        return url
    }

    // 适配环境变量
    const isDev = import.meta.env.VITE_APP_ENV === 'development'
    const apiBase = isDev
        ? import.meta.env.VITE_API_TARGET
        : window.location.origin

    return `${apiBase}/api/proxy-image?url=${encodeURIComponent(url)}`
}

// 🔥 新增：图片加载错误处理
const handleImageError = (event, fallbackUrl = null) => {
    const img = event.target

    // 如果已经是降级图片了，就不再重试
    if (img.dataset.fallback === 'true') {
        console.warn('降级图片也加载失败')
        return
    }

    // 标记为降级状态
    img.dataset.fallback = 'true'

    // 使用降级图片（可以是 Unsplash 的占位图或本地默认图）
    const defaultImage = fallbackUrl || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800'

    console.warn('图片加载失败，使用降级图片:', img.src)
    img.src = getProxyUrl(defaultImage) // 🔥 关键：降级图片也要走代理
}

// 生命周期
onMounted(() => {
    fetchArticle()
    fetchComments()
    fetchCopyright() // 获取版权信息
    window.scrollTo(0, 0)
    document.addEventListener('click', closeEmojiPicker)
    if (scrollCheckInterval) clearInterval(scrollCheckInterval)
})

onUnmounted(() => {
    document.removeEventListener('click', closeEmojiPicker)
    selectedImages.value.forEach(img => URL.revokeObjectURL(img.url))
})
</script>

<template>
    <div class="article-page" v-if="article">
        <header class="hero-header">
            <div class="hero-bg"
                :style="{ backgroundImage: `url(${article.cover_image || 'https://w.wallhaven.cc/full/9o/wallhaven-9oog5d.jpg'})` }">
            </div>
            <div class="hero-overlay"></div>
            <div class="hero-container animate__animated animate__fadeInUp">
                <div class="hero-info">
                    <h1 class="article-title">{{ article.title }}</h1>
                    <div class="article-meta">
                        <div class="meta-item author">
                            <img :src="article.author_avatar || 'https://w.wallhaven.cc/full/9o/wallhaven-9oog5d.jpg'"
                                class="author-avatar">
                            <span>{{ article.author_name || 'Veritas' }}</span>
                        </div>
                        <span class="meta-divider">·</span>
                        <div class="meta-item">📅 {{ formatDate(article.created_at) }}</div>
                        <span class="meta-divider">·</span>
                        <div class="meta-item">🔥 {{ article.views || 0 }}</div>
                        <span class="meta-divider">·</span>
                        <div class="meta-item">💬 {{ totalCommentCount }}</div>
                    </div>
                </div>
                <div class="hero-controls">
                    <div v-for="theme in textThemes" :key="theme.id" class="q-btn"
                        :style="{ backgroundColor: theme.color }" @click="changeHighlightColor(theme)">{{ theme.name }}
                    </div>
                </div>
            </div>
        </header>

        <main class="main-wrapper">
            <div class="content-card animate__animated animate__fadeInUp" :style="contentStyle">

                <div class="section-block">
                    <h2 class="custom-h2"><span class="hash">#</span> 网站介绍</h2>
                    <p class="intro-text">POETIZE - 高品质的个人网站系统！</p>
                </div>

                <hr class="dashed-line">

                <div class="markdown-body article-content" v-html="renderedContent"></div>

                <div class="last-updated">
                    文章最后更新于 {{ formatFullTime(article.updated_at || article.created_at) }}
                </div>

                <div class="copyright-box">
                    <p>
                        <strong>作者：</strong>
                        {{ isLoggedIn ? (currentUser.nickname || currentUser.username) : (article.author_name ||
                            'Veritas') }}
                    </p>
                    <div class="copyright-text">
                        <span v-for="(line, idx) in copyrightInfo.split('\n')" :key="idx"
                            style="display:block; margin-bottom: 4px;">
                            {{ line }}
                        </span>
                    </div>
                </div>

                <div class="action-buttons-row">
                    <button class="btn-large btn-purple" @click="handleSubscribe">
                        <span class="icon">{{ isSubscribed ? '✅' : '☁️' }}</span>
                        {{ isSubscribed ? '已订阅' : '订阅' }}
                    </button>
                    <button class="btn-large btn-pink" @click="handleShareClick">
                        <span class="icon">❤️</span> 卡片分享
                    </button>
                </div>

                <div class="comment-section" id="comments">
                    <div class="comment-header-row">
                        <span class="icon-edit">📝</span>
                        <span class="comment-title">留言 ({{ totalCommentCount }})</span>
                    </div>
                    <div class="comment-box-wrapper">
                        <div v-if="replyTarget" class="reply-status-bar">
                            <span>💬 回复 @{{ replyTarget.nickname }}</span>
                            <button class="cancel-reply-btn" @click="cancelReply">✕</button>
                        </div>
                        <div class="comment-box-beige">
                            <textarea id="comment-input" v-model="commentContent" placeholder="写下点什么..."
                                :disabled="!isLoggedIn" @click="showLoginTip">
                            </textarea>
                            <div v-if="!isLoggedIn" class="disabled-overlay" @click="showLoginTip"></div>
                            <div v-if="selectedImages.length" class="image-preview">
                                <div v-for="(img, index) in selectedImages" :key="index" class="preview-item">
                                    <img :src="img.url" />
                                    <span class="remove" @click="removeImage(index)">×</span>
                                </div>
                            </div>
                        </div>
                        <div class="comment-toolbar">
                            <div class="tool-left">
                                <div class="tool-icon-btn windmill" title="Emoji"
                                    @click.stop="showEmojiPicker = !showEmojiPicker">
                                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                                        <path
                                            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                                    </svg>
                                </div>
                                <div v-if="showEmojiPicker" class="emoji-panel" @click.stop>
                                    <span v-for="emoji in emojis" :key="emoji" class="emoji-item"
                                        @click="insertEmoji(emoji)">{{ emoji }}</span>
                                </div>
                                <div class="tool-icon-btn image-upload" title="上传图片" @click="handleImageUpload">
                                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                                        <path
                                            d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                                    </svg>
                                </div>
                                <input ref="imageInputRef" type="file" accept="image/*" multiple hidden
                                    @change="handleSelectImage" />
                            </div>
                            <button class="submit-btn-purple" @click="submitComment"
                                :disabled="!commentContent.trim() && !selectedImages.length">
                                {{ isLoggedIn ? (replyTarget ? '回复' : '评论') : '登录' }}
                            </button>
                        </div>
                    </div>
                    <div class="comments-list">
                        <CommentItem v-for="comment in comments" :key="comment.id" :comment="comment" :depth="0"
                            @reply="handleReply" @like="(c) => handleAction(c, 'like')"
                            @dislike="(c) => handleAction(c, 'dislike')" @delete="deleteComment" />

                        <div v-if="comments.length === 0" class="empty-state">
                            暂无评论，快来抢沙发~
                        </div>
                    </div>
                </div>

            </div>
        </main>

        <div class="floating-tools">
            <div class="tool-btn rocket-btn" :class="{ 'launching': isLaunching }" @click="handleScrollToTop"
                title="回到顶部">
                <svg class="rocket-icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"
                    width="32" height="32">
                    <path
                        d="M528 67.5l-16-16.7-15.9 16.7c-7.3 7.7-179.9 190.6-179.9 420.8 0 112 40 210.1 73.5 272.7l6.2 11.6H627l5.9-13c3.1-6.8 75-167.8 75-271.3 0-230.2-172.6-413.1-179.9-420.8z m-16 48.8c19 22.9 51.9 66.1 82.3 122.5H429.8c30.3-56.4 63.3-99.6 82.2-122.5z m86.3 612.2H422.5c-25.7-50.6-62.2-140.1-62.2-240.2 0-75 20.8-145.5 47.7-205.4h208.2c26.8 59.9 47.6 130.3 47.6 205.4-0.1 78.3-48.7 200.4-65.5 240.2z"
                        fill="#1E59E4"></path>
                    <path
                        d="M834.7 623.9H643.3l6.7-27.3c9.1-37 13.7-73.4 13.7-108.2 0-44.8-7.7-92-22.9-140.3l-17-54 49.1 28.3c99.8 57.6 161.8 164.7 161.8 279.5v22z m-135.9-44.2h90.9c-5.7-71-38.8-137.2-91.3-184.6 6.3 31.7 9.4 62.9 9.4 93.2 0.1 29.7-3 60.3-9 91.4zM380.1 623.9H189.3v-22.1c0-114.8 62-221.9 161.8-279.5l49.1-28.3-17 54c-15.2 48.3-22.9 95.5-22.9 140.3 0 34.5 4.5 71 13.4 108.4l6.4 27.2z m-145.8-44.2H325c-5.9-31.3-8.8-61.9-8.8-91.4 0-30.3 3.2-61.5 9.4-93.2-52.5 47.5-85.6 113.6-91.3 184.6zM512 529.5c-45 0-81.6-36.6-81.6-81.6s36.6-81.6 81.6-81.6 81.6 36.6 81.6 81.6-36.6 81.6-81.6 81.6z m0-119c-20.7 0-37.5 16.8-37.5 37.5s16.8 37.5 37.5 37.5 37.5-16.8 37.5-37.5-16.8-37.5-37.5-37.5z"
                        fill="#1E59E4"></path>
                    <path
                        d="M512 999.7l-20.3-20.3c-28.8-28.6-68.3-67.9-68.3-111.6 0-48.9 39.8-88.6 88.6-88.6 48.9 0 88.6 39.8 88.6 88.6 0 43.6-24.4 67.9-64.8 108.2L512 999.7z m0-176.4c-24.5 0-44.5 20-44.5 44.5 0 21.5 23.8 48.4 44.5 69.5 33.6-33.7 44.4-47 44.4-69.5 0.1-24.6-19.9-44.5-44.4-44.5z"
                        fill="#FF5A06"></path>
                </svg>
            </div>
        </div>

        <div style="height: 100px;"></div>

        <Teleport to="body">
            <div v-if="showShareModal" class="share-modal-overlay" @click="closeShareModal">
                <div class="share-modal-content" @click.stop>
                    <div class="modal-header">
                        <h3>卡片分享</h3>
                        <button class="close-btn" @click="showShareModal = false">×</button>
                    </div>

                    <div class="modal-body">
                        <div class="card-preview-container">
                            <div class="share-card" ref="shareCardRef" :style="{ backgroundColor: cardBgColor }">
                                <div class="card-header">
                                    <img :src="getProxyUrl(article.author_avatar || 'https://w.wallhaven.cc/full/9o/wallhaven-9oog5d.jpg')"
                                        @error="handleImageError($event)" class="card-avatar" crossorigin="anonymous"
                                        alt="作者头像">
                                    <div class="card-date">{{ formatDate(new Date()) }}</div>
                                </div>

                                <div class="card-title">{{ article.title }}</div>

                                <div class="card-cover-wrapper">
                                    <!-- 🔥 核心修复：确保使用当前文章的封面 -->
                                    <img v-if="article.cover_image" :src="getProxyUrl(article.cover_image)"
                                        @error="handleImageError($event, 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800')"
                                        class="card-cover" crossorigin="anonymous" alt="文章封面">
                                    <!-- 如果没有封面，显示占位图 -->
                                    <img v-else
                                        :src="getProxyUrl('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800')"
                                        class="card-cover" crossorigin="anonymous" alt="默认封面">
                                </div>

                                <div class="card-summary">
                                    {{ article.summary || '暂无摘要' }}
                                </div>

                                <div class="card-footer">
                                    <div class="footer-left">
                                        <div class="site-logo">VERITAS</div>
                                    </div>
                                    <div class="footer-right">
                                        <div class="card-user">@{{ currentUser.nickname || currentUser.username }}</div>
                                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://poetize.cn"
                                            class="qr-code" alt="二维码">
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="modal-footer">
                        <div class="color-picker">
                            <div v-for="color in cardColors" :key="color" class="color-dot"
                                :style="{ backgroundColor: color }" :class="{ active: cardBgColor === color }"
                                @click="cardBgColor = color"></div>
                            <div class="color-input-wrapper">
                                <input type="color" v-model="cardBgColor" class="custom-color-input">
                                <span class="plus-icon">+</span>
                            </div>
                        </div>

                        <button class="download-btn" @click="downloadCard" :disabled="isGeneratingCard">
                            {{ isGeneratingCard ? '生成中...' : '下载卡片' }}
                        </button>
                    </div>
                </div>
            </div>
        </Teleport>

    </div>

    <div v-else class="loading-screen">
        <div class="loading-spinner"></div>
    </div>
</template>

<style scoped>
/* ==================== 1. 基础布局与文章样式 (保持原样) ==================== */
.markdown-body {
    box-sizing: border-box;
    min-width: 200px;
    max-width: 100%;
    margin: 0 auto;
    padding: 10px 0;
    font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif;
    background: transparent !important;
}

/* 如果希望 Markdown 正文里的加粗字体也跟着变色，添加这个： */
.markdown-body :deep(strong) {
    color: var(--highlight-color);
    font-weight: bold;
    transition: color 0.3s ease;
}

.article-page {
    background-color: #ffffff;
    min-height: 100vh;
    font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', sans-serif;
}

/* Hero Header */
.hero-header {
    position: relative;
    width: 100%;
    height: 40vh;
    min-height: 350px;
    overflow: hidden;
    display: flex;
    justify-content: center;
    align-items: flex-end;
    box-shadow: inset 0 -20px 30px -10px rgba(0, 0, 0, 0.15);
    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.hero-bg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-size: cover;
    background-position: center;
    background-attachment: fixed;
    z-index: 0;
}

.hero-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0.2) 60%, rgba(0, 0, 0, 0.1) 100%);
    z-index: 1;
}

.hero-container {
    position: relative;
    z-index: 2;
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 40px 30px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
}

.hero-info {
    text-align: left;
    color: #fff;
    max-width: 70%;
}

.article-title {
    font-size: 1.8rem;
    font-weight: 700;
    margin: 0 0 12px 0;
    line-height: 1.4;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.article-meta {
    display: flex;
    align-items: center;
    gap: 15px;
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.95);
    font-weight: 500;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.author-avatar {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.8);
}

.meta-divider {
    opacity: 0.6;
    font-weight: normal;
}

.hero-controls {
    display: flex;
    gap: 10px;
    padding-bottom: 2px;
}

.q-btn {
    padding: 6px 14px;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 700;
    color: #5d4037;
    cursor: pointer;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
    transition: all 0.4s;
    user-select: none;
}

.q-btn:hover {
    transform: scale(1.15) translateY(-5px);
}

/* Main Wrapper */
.main-wrapper {
    width: 100%;
    position: relative;
    z-index: 4;
}

.content-card {
    max-width: 900px;
    margin: 40px auto 0;
    background: #ffffff;
    padding: 40px;
    min-height: 500px;
    --highlight-color: #d6a354;
    /* 默认值 */
}

/* Article Elements */
.custom-h2 {
    font-size: 1.4rem;
    font-weight: 700;
    color: #333;
    margin: 30px 0 20px;
    display: flex;
    align-items: center;
    gap: 8px;
}

/* 1. 修改标题前的 # 号颜色 */
.hash {
    color: var(--highlight-color);
    /* 🔥 原来是 #ff7e5f，改为变量 */
    font-weight: 900;
    margin-right: 8px;
    transition: color 0.3s ease;
    /* 加个过渡动画更顺滑 */
}

/* 2. 修改介绍文字的颜色和边框 */
.intro-text {
    font-size: 1rem;
    color: var(--highlight-color);
    /* 🔥 原来是 #e74c3c，改为变量 */
    line-height: 1.6;
    border-left: 4px solid var(--highlight-color);
    /* 边框也跟随变色 */
    padding-left: 16px;
    margin: 20px 0;
    background: #fdfdfd;
    transition: color 0.3s ease, border-color 0.3s ease;
}

.dashed-line {
    border: 0;
    border-top: 1px dashed #eee;
    margin: 40px 0;
}

.last-updated {
    font-size: 0.85rem;
    color: #999;
    margin-top: 40px;
    text-align: left;
}

.copyright-box {
    background: #eef7fe;
    border-left: 3px solid #42b983;
    padding: 20px;
    border-radius: 4px;
    margin-top: 30px;
    color: #333;
    font-size: 0.9rem;
    line-height: 1.8;
}

.action-buttons-row {
    display: flex;
    justify-content: center;
    gap: 20px;
    margin: 50px 0;
}

.btn-large {
    padding: 10px 30px;
    border-radius: 50px;
    border: none;
    color: white;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: transform 0.2s;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
}

.btn-large:hover {
    transform: translateY(-3px);
}

.btn-purple {
    background: #8e44ad;
}

.btn-pink {
    background: #ff5f7e;
}

/* ==================== 2. 输入框区域 (保留原版样式) ==================== */
.comment-section {
    margin-top: 40px;
}

.comment-header-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 20px;
    color: #ff9800;
    font-weight: bold;
    font-size: 1.1rem;
}

.comment-box-wrapper {
    margin-bottom: 40px;
    border-radius: 12px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
}

/* 原版米色背景 & 图片 */
.comment-box-beige {
    background-image: url('https://w.wallhaven.cc/full/76/wallhaven-76r86v.jpg');
    background-size: cover;
    background-position: center;
    background-blend-mode: overlay;
    background-color: rgba(255, 249, 230, 0.85);
    border: 2px solid #f0e6d2;
    border-radius: 12px 12px 0 0;
    padding: 20px;
    position: relative;
    min-height: 180px;
    box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.02);
    transition: all 0.3s ease;
}

textarea {
    width: 100%;
    border: none;
    background: transparent;
    outline: none;
    resize: vertical;
    min-height: 120px;
    font-size: 1rem;
    color: #333;
    z-index: 2;
    position: relative;
    font-family: inherit;
    text-shadow: 0 1px 2px rgba(255, 255, 255, 0.5);
}

textarea:disabled {
    cursor: not-allowed;
    color: #999;
}

/* 原版工具栏 */
.comment-toolbar {
    background: #fff;
    border: 1px solid #f2e9d0;
    border-top: 1px dashed #e0e0e0;
    padding: 10px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-radius: 0 0 12px 12px;
}

.tool-left {
    display: flex;
    gap: 20px;
    align-items: center;
    position: relative;
}

.tool-icon-btn {
    cursor: pointer;
    color: #666;
    transition: 0.3s;
    display: flex;
    align-items: center;
}

.tool-icon-btn:hover {
    color: #42b883;
}

.tool-icon-btn.windmill:hover svg {
    animation: spin 0.8s linear infinite;
}

.submit-btn-purple {
    padding: 6px 24px;
    background: #9688f7;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
    transition: 0.2s;
    box-shadow: 0 3px 6px rgba(150, 136, 247, 0.3);
}

.submit-btn-purple:hover {
    background: #7c6bf5;
    transform: translateY(-1px);
}

.submit-btn-purple:disabled {
    background: #ccc;
    cursor: not-allowed;
    box-shadow: none;
}

/* 绿色回复条 */
.reply-status-bar {
    background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
    color: #2e7d32;
    padding: 12px 16px;
    border-radius: 8px 8px 0 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.95rem;
    font-weight: 500;
    border: 2px solid #a5d6a7;
    border-bottom: none;
}

.cancel-reply-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.3rem;
    color: #2e7d32;
    padding: 0 8px;
    opacity: 0.7;
}

.cancel-reply-btn:hover {
    opacity: 1;
}

/* 禁用遮罩 */
.disabled-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.7);
    z-index: 5;
    cursor: pointer;
    border-radius: 12px;
    transition: all 0.3s ease;
}

/* ==================== 3. 评论列表 (YouTube 风格) ==================== */
.comments-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-top: 20px;
}

.yt-comment-container {
    display: flex;
    gap: 16px;
    padding: 6px 0;
}

.avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    /* ✅ 这里是对的 */
    background: #eee;
    flex-shrink: 0;
}

/* 检查这一块 */
.avatar.small {
    width: 24px;
    height: 24px;
    object-fit: cover;
    /* 🔥 建议这里也显式加上 */
}

.comment-body {
    flex: 1;
    min-width: 0;
}

.comment-header-line {
    margin-bottom: 4px;
    font-size: 0.8rem;
    display: flex;
    align-items: center;
    gap: 6px;
}

.username {
    font-weight: 600;
    color: #0f0f0f;
    font-size: 0.85rem;
    cursor: pointer;
}

.time {
    color: #606060;
    font-size: 0.75rem;
}

.comment-text {
    font-size: 0.95rem;
    line-height: 1.5;
    color: #0f0f0f;
    margin-bottom: 6px;
    white-space: pre-wrap;
    word-break: break-word;
}

/* 操作栏 */
.comment-actions {
    display: flex;
    align-items: center;
    gap: 8px;
}

.action-btn {
    background: none;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    color: #0f0f0f;
    padding: 6px 10px;
    border-radius: 16px;
    font-size: 0.8rem;
    transition: background 0.2s;
}

.action-btn:hover {
    background: #e5e5e5;
}

.action-btn.active {
    color: #065fd4;
}

.reply-btn {
    font-weight: 500;
    font-size: 0.8rem;
}

.delete-btn {
    color: #cc0000;
    opacity: 0.8;
}

.delete-btn:hover {
    background: #ffe6e6;
}

/* 缩进回复区 */
.replies-section {
    margin-left: 56px;
    margin-top: 6px;
}

.toggle-replies-btn {
    background: none;
    border: none;
    color: #065fd4;
    font-weight: 500;
    font-size: 0.9rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border-radius: 18px;
    margin-bottom: 8px;
}

.toggle-replies-btn:hover {
    background: #def1ff;
}

.chevron {
    display: flex;
    align-items: center;
    transition: transform 0.2s;
}

.chevron.up {
    transform: rotate(180deg);
}

.replies-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

/* 辅助组件 (Emoji, 悬浮窗, 加载) */
.emoji-panel {
    position: absolute;
    bottom: 100%;
    /* 在按钮上方显示 */
    left: -10px;
    /* 稍微向左对齐 */
    margin-bottom: 12px;
    /* 留出一点间距 */
    background: #fff;
    border: 1px solid #ebebeb;
    /* 颜色淡一点 */
    border-radius: 8px;
    padding: 10px;
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 5px;
    box-shadow: 0 5px 20px rgba(0, 0, 0, 0.15);
    /* 加深阴影，更有层次感 */
    min-width: 300px;
    /* 宽度稍微大一点 */
    z-index: 1000;
}

.emoji-panel::after {
    content: '';
    position: absolute;
    bottom: -6px;
    left: 20px;
    /* 对准风车图标 */
    width: 10px;
    height: 10px;
    background: #fff;
    border-bottom: 1px solid #ebebeb;
    border-right: 1px solid #ebebeb;
    transform: rotate(45deg);
}

.emoji-item {
    cursor: pointer;
    font-size: 20px;
    text-align: center;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s;
}

.emoji-item:hover {
    transform: scale(1.2);
    background: #f0f0f0;
}

.image-preview {
    display: flex;
    gap: 8px;
    margin-top: 8px;
    flex-wrap: wrap;
}

.preview-item {
    position: relative;
}

.preview-item img {
    width: 60px;
    height: 60px;
    object-fit: cover;
    border-radius: 4px;
    border: 1px solid #eee;
}

.preview-item .remove {
    position: absolute;
    top: -5px;
    right: -5px;
    background: #000;
    color: #fff;
    border-radius: 50%;
    width: 16px;
    height: 16px;
    font-size: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
}

.comment-images-grid img {
    max-width: 150px;
    border-radius: 8px;
    margin-top: 6px;
    margin-right: 6px;
    cursor: zoom-in;
}

.floating-tools {
    position: fixed;
    right: 30px;
    bottom: 100px;
    display: flex;
    flex-direction: column;
    gap: 15px;
    z-index: 99;
}

/* ==================== 🔥 终极版：垂直升空火箭 ==================== */

/* 1. 按钮容器 */
.tool-btn.rocket-btn {
    width: 50px;
    height: 50px;
    background: #fff;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
    /* 稍微深一点的投影 */
    position: relative;
    z-index: 999;
    perspective: 1000px;
    /* 开启 3D 透视 */
    overflow: visible;
    /* 必须可见，否则尾焰会被切掉 */
}

/* 2. 火箭包裹层 (用于修正角度) */
.rocket-wrapper {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    /* 🔥 核心修正：因为原图标是向右上方(45度)的，我们逆时针转45度，让它笔直朝上 */
    transform: rotate(-45deg);
    transition: transform 0.4s ease;
    transform-style: preserve-3d;
    /* 保留子元素的 3D 效果 */
}

/* 3. 火箭图标本体 */
.rocket-icon {
    width: 28px;
    height: 28px;
    filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1));
    /* 给火箭本体加一点投影，增加悬浮感 */
}

/* ========== 状态 A: 待机/悬停 ========== */

/* 悬停时：按钮稍微上浮，背景变蓝 */
.tool-btn.rocket-btn:hover {
    transform: translateY(-5px);
    box-shadow: 0 12px 30px rgba(30, 89, 228, 0.25);
    background: #f0f8ff;
}

/* 悬停时：火箭轻轻上下浮动 (模拟悬停) */
.tool-btn.rocket-btn:hover .rocket-wrapper {
    animation: floating-idle 1.5s ease-in-out infinite alternate;
}

/* ========== 状态 B: 发射中 (点击后) ========== */

/* 1. 按钮本体：变成强烈的能量光环，并不飞走，而是原地高亮 */
.tool-btn.rocket-btn.launching {
    background: #e3f2fd;
    transform: translateY(-15px);
    /* 明显向上浮起 */
    box-shadow: 0 20px 50px rgba(30, 89, 228, 0.5);
    /* 强烈的蓝色光晕 */
    border: 2px solid #90caf9;
    /* 增加能量边框 */
}

/* 2. 火箭动作：高速立体旋转 + 震动 */
.tool-btn.rocket-btn.launching .rocket-wrapper {
    /* 保持 -45deg 修正角度的同时，绕 Y 轴 (垂直轴) 旋转 */
    animation: rocket-drilling 0.6s linear infinite;
}

/* 3. 尾部火焰 (发射时才出现) */
.tool-btn.rocket-btn.launching::after {
    content: '';
    position: absolute;
    bottom: -35px;
    /* 在按钮下方喷出 */
    left: 50%;
    transform: translateX(-50%);
    width: 12px;
    height: 40px;
    /* 蓝橙渐变火焰 */
    background: linear-gradient(to bottom, #ff5722 0%, #ffc107 50%, transparent 100%);
    border-radius: 50%;
    filter: blur(3px);
    opacity: 0.9;
    z-index: -1;
    animation: flame-jet 0.1s linear infinite alternate;
}

/* ========== 动画定义 ========== */

/* 待机浮动 */
@keyframes floating-idle {
    0% {
        transform: rotate(-45deg) translateY(0);
    }

    100% {
        transform: rotate(-45deg) translateY(-4px);
    }

    /* 垂直轻微浮动 */
}

/* 🔥 发射：垂直旋转直插云霄 (Drill Effect) */
@keyframes rocket-drilling {
    0% {
        /* 起始：修正角度 + 0度旋转 */
        transform: rotate(-45deg) rotateY(0deg);
    }

    100% {
        /* 结束：修正角度 + 360度旋转 (绕着垂直中轴线转) */
        transform: rotate(-45deg) rotateY(360deg);
    }
}

/* 火焰喷射闪烁 */
@keyframes flame-jet {
    0% {
        height: 30px;
        opacity: 0.7;
        transform: translateX(-50%) scaleX(0.8);
    }

    100% {
        height: 50px;
        opacity: 1;
        transform: translateX(-50%) scaleX(1.2);
    }
}

.loading-screen {
    height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
}

.loading-spinner {
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

/* 响应式 */
@media (max-width: 768px) {
    .content-card {
        padding: 20px;
        margin-top: 20px;
    }

    .hero-header {
        height: 30vh;
    }

    .hero-container {
        padding: 0 20px 20px;
        flex-direction: column;
        align-items: flex-start;
        gap: 15px;
    }

    .hero-info {
        max-width: 100%;
    }

    .emoji-panel {
        grid-template-columns: repeat(6, 1fr);
        min-width: 220px;
    }

    .replies-section {
        margin-left: 32px;
    }

    .avatar {
        width: 32px;
        height: 32px;
    }
}

/* ==================== 🔥 新增：卡片分享 Modal 样式 ==================== */
.share-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 9999;
    display: flex;
    justify-content: center;
    align-items: center;
    backdrop-filter: blur(5px);
}

.share-modal-content {
    background: #fff;
    border-radius: 16px;
    width: 90%;
    max-width: 420px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: zoomIn 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

@keyframes zoomIn {
    from {
        transform: scale(0.9);
        opacity: 0;
    }

    to {
        transform: scale(1);
        opacity: 1;
    }
}

.modal-header {
    padding: 15px 20px;
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
    border-bottom: 1px solid #f0f0f0;
}

.modal-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 700;
    color: #333;
}

.close-btn {
    position: absolute;
    right: 15px;
    background: none;
    border: none;
    font-size: 1.5rem;
    color: #999;
    cursor: pointer;
    line-height: 1;
}

.modal-body {
    padding: 20px;
    background: #f9f9f9;
    display: flex;
    justify-content: center;
}

/* 🔥 卡片样式设计 */
.share-card {
    width: 320px;
    /* 默认浅黄色 */
    background-color: #fff9c4;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    gap: 15px;
    transition: background-color 0.3s;
}

.card-header {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
}

.card-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid #fff;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}

.card-date {
    font-size: 0.8rem;
    color: #666;
    font-family: monospace;
}

.card-title {
    font-size: 1.2rem;
    font-weight: 800;
    color: #2c3e50;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.card-cover-wrapper {
    width: 100%;
    height: 160px;
    border-radius: 8px;
    overflow: hidden;
    background: #eee;
}

.card-cover {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.card-summary {
    font-size: 0.85rem;
    color: #555;
    line-height: 1.6;
    max-height: 60px;
    overflow: hidden;
    text-overflow: ellipsis;
}

.card-footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: auto;
    padding-top: 15px;
    border-top: 1px dashed rgba(0, 0, 0, 0.1);
}

.site-logo {
    font-weight: 900;
    font-size: 1rem;
    color: #444;
    letter-spacing: 1px;
}

.footer-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 5px;
}

.card-user {
    font-size: 0.75rem;
    color: #777;
}

.qr-code {
    width: 40px;
    height: 40px;
    border-radius: 4px;
}

/* Modal 底部 */
.modal-footer {
    padding: 15px 20px;
    display: flex;
    flex-direction: column;
    gap: 15px;
    align-items: center;
    background: #fff;
}

.color-picker {
    display: flex;
    gap: 10px;
    align-items: center;
}

.color-dot {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    cursor: pointer;
    border: 2px solid transparent;
    transition: transform 0.2s;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.color-dot:hover {
    transform: scale(1.1);
}

.color-dot.active {
    border-color: #333;
    transform: scale(1.1);
}

.color-input-wrapper {
    position: relative;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    overflow: hidden;
    cursor: pointer;
    border: 1px dashed #999;
    display: flex;
    align-items: center;
    justify-content: center;
}

.custom-color-input {
    position: absolute;
    opacity: 0;
    width: 100%;
    height: 100%;
    cursor: pointer;
}

.plus-icon {
    font-size: 14px;
    color: #666;
    pointer-events: none;
}

.download-btn {
    width: 100%;
    padding: 10px;
    background: #ff80ab;
    color: white;
    border: none;
    border-radius: 25px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.3s;
}

.download-btn:hover {
    background: #ff4081;
}

.download-btn:disabled {
    background: #ccc;
    cursor: not-allowed;
}
</style>