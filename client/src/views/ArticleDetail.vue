<script setup>
import { ref, onMounted, onUnmounted, computed, nextTick, watch, provide } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user.js'
import { message } from '@/utils/message.js'
import { api } from '@/utils/api'
import html2canvas from 'html2canvas'
import CommentItem from '@/components/CommentItem.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const article = ref(null)
const comments = ref([])
const commentContent = ref('')
const loading = ref(true)

const isLoggedIn = computed(() => !!userStore.token)
const currentUser = computed(() => userStore.user || {})

// ===== Emoji & 图片 =====
const showEmojiPicker = ref(false)
const selectedImages = ref([])
const imageInputRef = ref(null)
const expandedReplies = ref(new Set())
// 🔥 互动功能状态
const isLiked = ref(false)
const isFavorited = ref(false)
const likeCount = ref(0)
const favoriteCount = ref(0)
const showColumnModal = ref(false)
const userColumns = ref([])
const isCreatingInModal = ref(false) // 🔥 新增：是否处于"创建模式"
const newColumnData = ref({ name: '', description: '' }) // 🔥 新增：快捷创建表单
const isSubmitting = ref(false)

// 🔥 新增：图片预览（灯箱）逻辑
const isLightboxOpen = ref(false)
const lightboxUrl = ref('')

const openLightbox = (url) => {
    // 1. 如果 url 是缩略图（比如带 thumb_ 的），可以尝试正则替换获取原图
    // 如果你的后端已经是直接存的原图地址，则直接赋值
    lightboxUrl.value = getProxyUrl(url)

    isLightboxOpen.value = true

    // 2. 锁定网页滚动
    document.body.style.overflow = 'hidden'
}

const closeLightbox = () => {
    isLightboxOpen.value = false
    document.body.style.overflow = 'auto'
}

const handleEsc = (e) => {
    if (e.key === 'Escape' && isLightboxOpen.value) {
        closeLightbox()
    }
}


// 🔥 核心：将打开函数“广播”给所有子孙组件
provide('triggerLightbox', openLightbox)

// 🔥 侧边栏显隐 & 进度逻辑
const showSidebar = ref(true)
const scrollPercent = ref(0)
let rafId = null

const handleSmartSidebar = () => {
    if (rafId) cancelAnimationFrame(rafId)

    rafId = requestAnimationFrame(() => {
        const commentSection = document.getElementById('comments')
        if (!commentSection) return

        const commentRect = commentSection.getBoundingClientRect()
        const viewportHeight = window.innerHeight
        const scrollTop = window.scrollY

        // 1. 显隐逻辑：当评论框距离底部 400px 时，侧边栏消失
        const visibleHeightOfComments = viewportHeight - commentRect.top
        showSidebar.value = visibleHeightOfComments < 400

        // 2. 阅读进度优化逻辑：以“评论框距离底部400px”为 100% 终点
        const commentsAbsoluteTop = scrollTop + commentRect.top
        const readingEndLine = commentsAbsoluteTop - viewportHeight + 400

        if (readingEndLine > 0) {
            const percent = Math.floor((scrollTop / readingEndLine) * 100)
            scrollPercent.value = Math.min(100, Math.max(0, percent))
        } else {
            scrollPercent.value = 100
        }
    })
}

// 🔥 动态计算颜色：即将读完时变为橙色
const progressColor = computed(() => {
    // 设置 98% 为变色阈值
    return scrollPercent.value >= 98 ? '#ff9800' : '#42b883'
})

// 侧边栏样式：增加一点“位移”感，显得更灵动
const sidebarStyle = computed(() => ({
    opacity: showSidebar.value ? 1 : 0,
    transform: `translateX(${showSidebar.value ? '0' : '-30px'}) scale(${showSidebar.value ? 1 : 0.9})`,
    pointerEvents: showSidebar.value ? 'all' : 'none',
    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)' // 使用贝塞尔曲线，过渡更高级
}))

// 初始化互动状态
const fetchInteractionStatus = async () => {
    if (!isLoggedIn.value) return
    try {
        const res = await api.get(`/articles/${route.params.id}/interaction-status`)
        if (res.data.success) {
            isLiked.value = res.data.data.isLiked
            isFavorited.value = res.data.data.isFavorited
        }
    } catch (err) {
        console.warn('获取互动状态失败', err)
    }
}

// 🔥 处理点赞
const handleLike = async () => {
    if (!isLoggedIn.value) return message.warning('请先登录后点赞')
    try {
        const res = await api.post(`/articles/${route.params.id}/like`)
        isLiked.value = res.data.data.status === 'liked'
        isLiked.value ? likeCount.value++ : likeCount.value--
        message.success(res.data.message)
    } catch (err) {
        message.error('操作失败')
    }
}

// 🔥 处理收藏
const handleFavorite = async () => {
    if (!isLoggedIn.value) return message.warning('请先登录后收藏')
    try {
        const res = await api.post(`/articles/${route.params.id}/favorite`)
        isFavorited.value = res.data.data.status === 'favorited'
        isFavorited.value ? favoriteCount.value++ : favoriteCount.value--
        message.success(res.data.message)
    } catch (err) {
        message.error('操作失败')
    }
}

// 🔥 处理加入专栏
// 修改：打开弹窗时重置模式
const handleAddToColumn = async () => {
    if (!isLoggedIn.value) return message.warning('请先登录后操作')
    isCreatingInModal.value = false // 每次打开默认显示列表
    try {
        const res = await api.get('/user/columns/simple')
        userColumns.value = res.data.data
        showColumnModal.value = true
    } catch (err) { message.error('获取专栏列表失败') }
}

// 🔥 新增：在弹窗中直接创建并刷新
const handleCreateColumnInModal = async () => {
    if (!newColumnData.value.name.trim()) return message.warning('请输入专栏名称')
    isSubmitting.value = true
    try {
        const res = await api.post('/columns', {
            name: newColumnData.value.name,
            description: newColumnData.value.description
        })
        if (res.data.success) {
            message.success('专栏创建成功！')
            // 重置表单并切回列表模式
            newColumnData.value = { name: '', description: '' }
            isCreatingInModal.value = false
            // 重新拉取列表，方便用户直接点击刚创建的专栏
            const listRes = await api.get('/user/columns/simple')
            userColumns.value = listRes.data.data
        }
    } catch (err) {
        message.error('创建失败')
    } finally {
        isSubmitting.value = false
    }
}

// 选择专栏并提交
const selectColumnAndAdd = async (columnId) => {
    try {
        await api.post(`/columns/${columnId}/articles`, { articleId: article.value.id })
        message.success('已成功添加到专栏！')
        showColumnModal.value = false
    } catch (err) {
        message.error('添加失败，可能已存在')
    }
}

// 🔥 关注状态逻辑
const isFollowing = ref(false)

// 关注/取消关注
const toggleFollow = async () => {
    if (!isLoggedIn.value) {
        message.warning('请先登录后操作')
        router.push('/login')
        return
    }
    if (userStore.user.id === article.value.author_id) {
        message.info('这是您自己的文章哦')
        return
    }

    try {
        const res = await api.post('/user/follow', { targetUserId: article.value.author_id })
        isFollowing.value = res.data.data.status === 'followed'
        message.success(res.data.message)
    } catch (err) {
        message.error('关注操作失败')
    }
}

// 跳转至作者主页
const goToAuthorProfile = () => {
    const username = article.value?.author_username || article.value?.author_name
    if (username) {
        router.push(`/profile/${username}`)
    } else {
        message.warning('未能获取到作者信息')
    }
}

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
    if (!e.target.closest('.emoji-panel') && !e.target.closest('.windmill')) {
        showEmojiPicker.value = false
    }
}

const showLoginTip = () => {
    if (!isLoggedIn.value) {
        message.warning('请先登录后再留言')
    }
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

// 🔥 火箭回到顶部逻辑
const isLaunching = ref(false)
let scrollCheckInterval = null

const handleScrollToTop = () => {
    if (isLaunching.value) return
    isLaunching.value = true
    window.scrollTo({ top: 0, behavior: 'smooth' })
    if (scrollCheckInterval) clearInterval(scrollCheckInterval)

    scrollCheckInterval = setInterval(() => {
        if (window.scrollY <= 50) {
            clearInterval(scrollCheckInterval)
            scrollCheckInterval = null
            isLaunching.value = false
        }
    }, 100)
}

// 🔥 递归统计所有评论
const countAllComments = (commentList) => {
    let total = 0
    for (const comment of commentList) {
        total += 1
        if (comment.replies && comment.replies.length > 0) {
            total += countAllComments(comment.replies)
        }
    }
    return total
}

const totalCommentCount = computed(() => {
    return countAllComments(comments.value)
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
const highlightColor = ref('#d6a354')

const textThemes = [
    { id: 'classic', name: '经典', color: '#f7d794', fontColor: '#d6a354' },
    { id: 'chocolate', name: '巧克力', color: '#d2a679', fontColor: '#8b5a2b' },
    { id: 'purple', name: '暮山紫', color: '#dcd6f7', fontColor: '#9370db' }
]

const changeHighlightColor = (theme) => {
    highlightColor.value = theme.fontColor
    message.success(`主题已切换为：${theme.name}`)
}

// 获取文章
const fetchArticle = async () => {
    loading.value = true
    try {
        const res = await api.get(`/articles/${route.params.id}`)
        if (res.data.success) {
            article.value = res.data.data
            likeCount.value = article.value.likes || 0
            favoriteCount.value = article.value.favorites || 0
            fetchInteractionStatus()
            api.post(`/articles/${route.params.id}/view`).catch(err => console.warn(err))
        } else {
            message.error('文章不存在')
            router.push('/')
        }
    } catch (error) {
        message.error('加载文章失败')
    } finally {
        loading.value = false
    }
}

const fetchComments = async () => {
    try {
        const res = await api.get('/comments', {
            params: { article_id: route.params.id }
        })
        if (res.data.success) {
            comments.value = res.data.data || []
        }
    } catch (error) {
        message.error('加载评论失败')
    }
}

/**
 * 前端图片压缩工具 (Canvas版)
 */
const compressImage = (file, { quality = 0.6, maxWidth = 1000 } = {}) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height = (maxWidth / width) * height;
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    if (blob) {
                        const compressedFile = new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now(),
                        });
                        resolve(compressedFile);
                    } else {
                        reject(new Error('压缩失败'));
                    }
                }, 'image/jpeg', quality);
            };
        };
        reader.onerror = (err) => reject(err);
    });
};

const replyTarget = ref(null)

// 提交评论
const submitComment = async () => {
    if (!isLoggedIn.value) return message.error('您还没有登录,不可进行评论！!')

    if (!commentContent.value.trim() && selectedImages.value.length === 0) {
        return message.warning('不能发送空评论')
    }

    isSubmitting.value = true

    try {
        let imageUrls = []

        // 🔥 核心优化：如果选择了图片，先进行并行压缩
        if (selectedImages.value.length) {
            message.info(`正在优化 ${selectedImages.value.length} 张图片...`);

            // 使用 Promise.all 并行压缩，速度更快
            const compressedFiles = await Promise.all(
                selectedImages.value.map(img =>
                    compressImage(img.file, { quality: 0.5, maxWidth: 1200 })
                )
            );

            const formData = new FormData()
            compressedFiles.forEach(file => formData.append('images', file))

            console.log('📡 开始上传压缩后的评论图片...');
            const uploadRes = await api.post('/upload/comment-images', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                // 针对多图上传，可以单独给这个请求设置超长超时
                timeout: 120000
            })

            if (uploadRes.data.success) {
                imageUrls = uploadRes.data.data.urls
            }
        }

        // 提交评论主体
        const payload = {
            article_id: parseInt(route.params.id),
            content: commentContent.value,
            images: imageUrls,
            parent_id: replyTarget.value ? replyTarget.value.rootId : null
        }

        const res = await api.post('/comments', payload)

        if (res.data.success) {
            message.success('🎉 评论成功！')
            commentContent.value = ''
            selectedImages.value = []
            if (replyTarget.value) expandedReplies.value.add(replyTarget.value.rootId)
            cancelReply()
            fetchComments()
            api.post(`/articles/${route.params.id}/update-comments-count`)
        }
    } catch (e) {
        console.error('评论流程出错:', e);
        const errorMsg = e.response?.data?.message || e.message;
        if (e.code === 'ECONNABORTED') {
            message.error('❌ 上传超时，请减少图片数量或压缩后上传');
        } else {
            message.error('评论失败: ' + errorMsg)
        }
    } finally {
        isSubmitting.value = false
    }
}

const setReplyTarget = (comment) => {
    if (!isLoggedIn.value) return message.warning('请登录后回复')

    replyTarget.value = {
        id: comment.id,
        nickname: comment.nickname,
        rootId: comment.id
    }

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

const handleReply = (comment) => {
    setReplyTarget(comment)
}

const handleAction = async (comment, action) => {
    if (!isLoggedIn.value) return message.warning('请登录后参与互动')

    // 记录原始状态用于失败回滚
    const originalState = {
        liked: comment.is_liked,
        disliked: comment.is_disliked,
        count: comment.like_count,
        authorLiked: comment.author_liked // 🔥 记录这个状态
    }

    if (action === 'like') {
        if (comment.is_liked) {
            // 取消点赞逻辑
            comment.is_liked = false
            comment.like_count--

            // 🔥 新增：如果当前用户是博主，取消赞时立即隐藏“作者赞过”
            if (Number(currentUser.value.id) === Number(article.value.author_id)) {
                comment.author_liked = false
            }
        } else {
            // 点赞逻辑
            comment.is_liked = true
            comment.like_count++
            if (comment.is_disliked) comment.is_disliked = false

            // 🔥 新增：如果当前用户是博主，点赞时立即显示“作者赞过”
            if (Number(currentUser.value.id) === Number(article.value.author_id)) {
                comment.author_liked = true
            }
        }
    } else if (action === 'dislike') {
        if (comment.is_disliked) {
            comment.is_disliked = false
        } else {
            comment.is_disliked = true
            // 🔥 如果作者改点“踩”，也要立刻同步取消“作者赞过”的显示
            if (comment.is_liked) {
                comment.is_liked = false
                comment.like_count--
            }
            if (Number(currentUser.value.id) === Number(article.value.author_id)) {
                comment.author_liked = false
            }
        }
    }

    try {
        await api.post(`/comments/${comment.id}/action`, { action })
    } catch (e) {
        // 如果后端报错，回滚所有状态
        Object.assign(comment, originalState)
        comment.author_liked = originalState.authorLiked // 🔥 回滚作者赞过状态
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


// 🔥 1. 新增一个将十六进制颜色转换为 RGB 的工具函数
const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ?
        `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` :
        '214, 163, 84'; // 默认经典色的 RGB
};

// 🔥 2. 增强 contentStyle，使其支持 RGB 变量
const contentStyle = computed(() => ({
    '--highlight-color': highlightColor.value,
    '--highlight-color-rgb': hexToRgb(highlightColor.value)
}));


// 订阅功能
const isSubscribed = ref(false)
const handleSubscribe = async () => {
    if (!isLoggedIn.value) {
        message.warning('请先登录后订阅')
        router.push('/login')
        return
    }

    try {
        isSubscribed.value = !isSubscribed.value
        if (isSubscribed.value && !isFollowing.value) {
            await toggleFollow()
        }

        if (isSubscribed.value) {
            message.success('订阅成功！作者的新文章将通知您')
        } else {
            message.info('已取消订阅')
        }
    } catch (e) {
        message.error('操作失败')
    }
}

// 分享卡片
const showShareModal = ref(false)
const shareCardRef = ref(null)
const isGeneratingCard = ref(false)
const cardBgColor = ref('#fff9c4')

const cardColors = [
    '#fff9c4', '#e1bee7', '#b2dfdb', '#ffccbc',
    '#f0f4c3', '#cfd8dc', '#ffffff'
]

const handleShareClick = () => {
    if (!isLoggedIn.value) {
        message.warning('请先登录后下载分享卡片')
        router.push('/login')
        return
    }
    showShareModal.value = true
}

const closeShareModal = (e) => {
    if (e.target.classList.contains('share-modal-overlay')) {
        showShareModal.value = false
    }
}

const downloadCard = async () => {
    if (!shareCardRef.value) return
    isGeneratingCard.value = true

    try {
        await nextTick()

        const canvas = await html2canvas(shareCardRef.value, {
            useCORS: true,
            allowTaint: false,
            scale: 2,
            backgroundColor: null,
            logging: false
        })

        const imgUrl = canvas.toDataURL('image/png')
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

const getProxyUrl = (url) => {
    if (!url) return ''
    if (url.startsWith('/uploads') || url.startsWith('data:') || url.startsWith('/api')) {
        return url
    }
    const isDev = import.meta.env.VITE_APP_ENV === 'development'
    const apiBase = isDev ? import.meta.env.VITE_API_TARGET : window.location.origin
    return `${apiBase}/api/proxy-image?url=${encodeURIComponent(url)}`
}

const handleImageError = (event, fallbackUrl = null) => {
    const img = event.target
    if (img.dataset.fallback === 'true') {
        console.warn('降级图片也加载失败')
        return
    }
    img.dataset.fallback = 'true'
    const defaultImage = fallbackUrl || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800'
    img.src = getProxyUrl(defaultImage)
}

const formatCount = (count) => {
    if (!count || count === 0) return '0'
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
    return count
}

const scrollToComments = () => {
    const el = document.getElementById('comments')
    if (el) {
        const offset = 80
        const bodyRect = document.body.getBoundingClientRect().top
        const elementRect = el.getBoundingClientRect().top
        const elementPosition = elementRect - bodyRect
        window.scrollTo({
            top: elementPosition - offset,
            behavior: 'smooth'
        })
    }
}

// 生命周期
onMounted(() => {
    fetchArticle()
    fetchComments()
    window.scrollTo(0, 0)
    document.addEventListener('click', closeEmojiPicker)
    window.addEventListener('keydown', handleEsc)

    // 监听滚动和窗口大小变化
    window.addEventListener('scroll', handleSmartSidebar, { passive: true })
    window.addEventListener('resize', handleSmartSidebar)

    // 初始触发一次检查
    nextTick(() => {
        setTimeout(handleSmartSidebar, 800) // 等待 Markdown 渲染完毕后再检测
    })
})

onUnmounted(() => {
    document.removeEventListener('click', closeEmojiPicker)
    window.removeEventListener('scroll', handleSmartSidebar)
    window.removeEventListener('resize', handleSmartSidebar)
    window.removeEventListener('keydown', handleEsc)
    if (rafId) cancelAnimationFrame(rafId)
})
</script>

<template>
    <div class="article-page" v-if="article">
        <!-- 智能侧边栏 -->
        <aside class="side-toolbar-wrapper" :style="sidebarStyle">
            <div class="side-toolbar">
                <div class="tool-item progress-item" :class="{ 'completed': scrollPercent >= 98 }" title="阅读进度">
                    <svg class="progress-circle" viewBox="0 0 44 44">
                        <circle class="progress-circle-bg" cx="22" cy="22" r="20"></circle>
                        <circle class="progress-circle-bar" cx="22" cy="22" r="20" :style="{
                            // 🔥 添加逻辑保护：如果 scrollPercent 是 NaN 或 0，给个默认值 125.6 (即进度为0)
                            strokeDashoffset: (isNaN(scrollPercent) || !scrollPercent) ? 125.6 : (125.6 - (125.6 * scrollPercent) / 100),
                            stroke: progressColor
                        }">
                        </circle>
                    </svg>
                    <span class="percent-text" :style="{ color: progressColor }">
                        {{ scrollPercent }}<small>%</small>
                    </span>
                </div>
                <div class="tool-divider"></div>
                <div class="tool-item" :class="{ active: isLiked }" @click="handleLike" title="点赞">
                    <span class="icon">{{ isLiked ? '❤️' : '🤍' }}</span>
                    <span class="count">{{ formatCount(likeCount) }}</span>
                </div>
                <div class="tool-item" @click="scrollToComments" title="评论">
                    <span class="icon">💬</span>
                    <span class="count">{{ totalCommentCount }}</span>
                </div>
                <div class="tool-item" :class="{ active: isFavorited }" @click="handleFavorite" title="收藏">
                    <span class="icon">{{ isFavorited ? '⭐' : '☆' }}</span>
                    <span class="count">{{ formatCount(favoriteCount) }}</span>
                </div>
                <div class="tool-item" @click="handleAddToColumn" title="加入专栏">
                    <span class="icon">📁</span>
                </div>
            </div>
        </aside>

        <header class="hero-header">
            <div class="hero-bg"
                :style="{ backgroundImage: `url(${article.cover_image || 'https://w.wallhaven.cc/full/9o/wallhaven-9oog5d.jpg'})` }">
            </div>
            <div class="hero-overlay"></div>
            <div class="hero-container animate__animated animate__fadeInUp">
                <div class="hero-info">
                    <h1 class="article-title">{{ article.title }}</h1>
                    <div class="article-meta">
                        <div class="meta-item author" @click="goToAuthorProfile" title="查看作者主页">
                            <div class="author-avatar-wrapper">
                                <img :src="article.author_avatar || 'https://w.wallhaven.cc/full/9o/wallhaven-9oog5d.jpg'"
                                    class="author-avatar" alt="作者头像">
                                <button v-if="currentUser?.id !== article.author_id" class="mini-follow-btn"
                                    :class="{ 'followed': isFollowing }" @click.stop="toggleFollow">
                                    <svg v-if="!isFollowing" viewBox="0 0 24 24" width="14" height="14" fill="none"
                                        stroke="currentColor" stroke-width="3">
                                        <line x1="12" y1="5" x2="12" y2="19"></line>
                                        <line x1="5" y1="12" x2="19" y2="12"></line>
                                    </svg>
                                    <svg v-else viewBox="0 0 24 24" width="14" height="14" fill="none"
                                        stroke="currentColor" stroke-width="3">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                </button>
                            </div>
                            <span class="author-name">{{ article.author_name || 'Veritas' }}</span>
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
                <div class="article-preface" v-if="article.summary">
                    <div class="preface-content">
                        <span class="quote-left">“</span>
                        <p class="summary-text">{{ article.summary }}</p>
                        <span class="quote-right">”</span>
                    </div>
                    <div class="preface-divider"></div>
                </div>

                <hr class="dashed-line" :class="{ 'preface-gap': article.summary }">

                <div class="markdown-body article-content" v-html="renderedContent"></div>

                <div class="last-updated">
                    文章最后更新于 {{ formatFullTime(article.updated_at || article.created_at) }}
                </div>

                <div class="action-buttons-row">
                    <button class="btn-large btn-like" :class="{ active: isLiked }" @click="handleLike">
                        <span class="icon">{{ isLiked ? '❤️' : '🤍' }}</span>
                        {{ isLiked ? '已点赞' : '点赞' }}
                    </button>
                    <button class="btn-large btn-favorite" :class="{ active: isFavorited }" @click="handleFavorite">
                        <span class="icon">{{ isFavorited ? '⭐' : '☆' }}</span>
                        {{ isFavorited ? '已收藏' : '收藏' }}
                    </button>
                    <button class="btn-large btn-purple" @click="handleSubscribe">
                        <span class="icon">{{ isSubscribed ? '✅' : '☁️' }}</span>
                        {{ isSubscribed ? '已订阅' : '订阅' }}
                    </button>
                    <button class="btn-large btn-pink" @click="handleShareClick">
                        <span class="icon">🖼️</span> 卡片分享
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
                                    <img :src="img.url" alt="预览图" />
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
                            :article-author-id="article.author_id" @reply="handleReply"
                            @like="(c) => handleAction(c, 'like')" @dislike="(c) => handleAction(c, 'dislike')"
                            @delete="deleteComment" />

                        <div v-if="comments.length === 0" class="empty-state">
                            暂无评论，快来抢沙发~
                        </div>
                    </div>
                </div>
            </div>
        </main>

        <!-- 专栏弹窗 -->
        <Teleport to="body">
            <div v-if="showColumnModal" class="column-modal-overlay" @click="showColumnModal = false">
                <div class="column-modal" @click.stop>
                    <div class="modal-header">
                        <h3>{{ isCreatingInModal ? '新建专栏文件夹' : '添加到我的专栏' }}</h3>
                        <button class="close-btn" @click="showColumnModal = false">×</button>
                    </div>

                    <div class="modal-body">
                        <template v-if="!isCreatingInModal">
                            <div class="column-list-container">
                                <div v-for="col in userColumns" :key="col.id" class="column-select-item"
                                    @click="selectColumnAndAdd(col.id)">
                                    <span class="col-icon">📘</span>
                                    <span class="col-name">{{ col.name }}</span>
                                    <span class="add-mark">+</span>
                                </div>

                                <div v-if="userColumns.length === 0" class="empty-columns-guide">
                                    <p>您还没有创建过专栏哦</p>
                                    <button class="btn-create-now" @click="isCreatingInModal = true">
                                        ✨ 立即创建一个
                                    </button>
                                </div>
                            </div>

                            <div v-if="userColumns.length > 0" class="modal-action-footer">
                                <button class="text-btn" @click="isCreatingInModal = true">+ 新建专栏文件夹</button>
                            </div>
                        </template>

                        <template v-else>
                            <div class="quick-create-form">
                                <input v-model="newColumnData.name" type="text" placeholder="专栏名称 (如：我的必读清单)"
                                    class="modal-input">
                                <textarea v-model="newColumnData.description" placeholder="简单描述一下这个专栏吧..."
                                    class="modal-input"></textarea>
                                <div class="form-ops">
                                    <button class="btn-secondary" @click="isCreatingInModal = false">返回选择</button>
                                    <button class="btn-primary" @click="handleCreateColumnInModal"
                                        :disabled="isSubmitting">
                                        {{ isSubmitting ? '同步中...' : '确认创建' }}
                                    </button>
                                </div>
                            </div>
                        </template>
                    </div>
                </div>
            </div>
        </Teleport>

        <!-- 分享卡片弹窗 -->
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
                                    <img v-if="article.cover_image" :src="getProxyUrl(article.cover_image)"
                                        @error="handleImageError($event, 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800')"
                                        class="card-cover" crossorigin="anonymous" alt="文章封面">
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



        <Teleport to="body">
            <Transition name="fade">
                <div v-if="isLightboxOpen" class="lightbox-overlay" @click="closeLightbox">
                    <div class="lightbox-content">
                        <img :src="lightboxUrl" class="lightbox-image" @click.stop alt="预览大图" />
                        <button class="lightbox-close-btn" @click="closeLightbox">✕</button>
                    </div>
                </div>
            </Transition>
        </Teleport>

        <!-- 火箭回到顶部 -->
        <div class="floating-tools">
            <div class="tool-btn rocket-btn" :class="{ 'launching': isLaunching }" @click="handleScrollToTop"
                title="回到顶部">
                <div class="rocket-wrapper">
                    <svg class="rocket-icon" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="32"
                        height="32">
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
        </div>

        <div style="height: 100px;"></div>
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
    width: 50px;
    /* 调大头像 */
    height: 50px;
    border-radius: 50%;
    border: 2px solid #fff;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
    object-fit: cover;
}

.author-avatar:hover {
    transform: scale(1.05);
}

.author-name {
    font-size: 1.1rem;
    font-weight: 700;
    letter-spacing: 0.5px;
}

.meta-item.author {
    display: flex;
    align-items: center;
    gap: 15px;
    cursor: pointer;
    /* 鼠标变为手型 */
    transition: opacity 0.2s;
    user-select: none;
}

/* 悬停效果：名字稍微变亮或加下划线 */
.meta-item.author:hover .author-name {
    text-decoration: underline;
}

/* 头像悬停轻微放大已经在之前帮你写好了 */
.author-avatar:hover {
    transform: scale(1.05);
}

.author-avatar-wrapper {
    position: relative;
    display: inline-flex;
}

/* 🔥 迷你关注按钮样式 */
.mini-follow-btn {
    position: absolute;
    top: -2px;
    right: -5px;
    width: 22px;
    height: 22px;
    background: #42b883;
    /* Veritas 绿 */
    color: #fff;
    border: 2px solid #fff;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.mini-follow-btn:hover {
    transform: scale(1.2);
}

.mini-follow-btn.followed {
    background: #fff;
    color: #42b883;
    border-color: #42b883;
}

.meta-divider {
    margin: 0 5px;
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
    --highlight-color-rgb: 214, 163, 84;
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

.last-updated {
    font-size: 0.85rem;
    color: #999;
    margin-top: 40px;
    text-align: left;
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
    color: rgb(59, 59, 59);
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

/* ==================== 🔥 垂直升空火箭 ==================== */

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
    /* 🔥 修改：从 -45deg 改为 0deg，让它笔直向上 */
    transform: rotate(0deg);
    transition: transform 0.4s ease;
    transform-style: preserve-3d;
}

/* 3. 火箭图标本体 */
.rocket-icon {
    width: 28px;
    height: 28px;
    filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1));
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
        /* 🔥 修改：保持 0deg */
        transform: rotate(0deg) translateY(0);
    }

    100% {
        /* 🔥 修改：保持 0deg */
        transform: rotate(0deg) translateY(-4px);
    }
}

/* 🔥 发射：垂直旋转直插云霄 (Drill Effect) */
@keyframes rocket-drilling {
    0% {
        /* 🔥 修改：起始角度设为 0deg */
        transform: rotate(0deg) rotateY(0deg);
    }

    100% {
        /* 🔥 修改：结束角度设为 0deg，旋转 360 度 */
        transform: rotate(0deg) rotateY(360deg);
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

.side-toolbar-wrapper {
    position: fixed;
    /* 1. 将 top 调大，确保避开顶部的 Hero 封面和标题区 */
    top: 400px;
    /* 2. 这里的偏移量需要根据 .content-card 的 max-width (900px) 来微调 */
    /* 900/2 = 450, 再往左挪 70px 左右比较合适 */
    left: calc(50% - 530px);
    z-index: 100;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.side-toolbar {
    display: flex;
    flex-direction: column;
    gap: 18px;
    /* 间距稍微收紧，更精致 */
    background: rgba(255, 255, 255, 0.6);
    /* 半透明背景 */
    backdrop-filter: blur(10px);
    /* 磨砂玻璃效果 */
    padding: 12px 8px;
    border-radius: 40px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.4);
}

.tool-item {
    width: 44px;
    height: 44px;
    background: #fff;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    transition: all 0.3s;
    position: relative;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.tool-item:hover {
    background: #f8f9fa;
    transform: scale(1.1);
}

/* 气泡计数器优化 */
.tool-item .count {
    position: absolute;
    top: -4px;
    left: 30px;
    background: #94a3b8;
    color: #fff;
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 10px;
    font-weight: 700;
    border: 2px solid #fff;
    /* 增加白色描边，更有立体感 */
}

.tool-item.active {
    background: #fff1f2;
}

.tool-item.active .icon {
    filter: drop-shadow(0 0 5px rgba(255, 95, 126, 0.3));
    transform: scale(1.1);
}

.tool-item.active .count {
    background: #ff5f7e;
}

/* --- 🔥 底部按钮增强 --- */
.btn-like.active {
    background: #ff5f7e;
    color: #fff;
}

.btn-favorite.active {
    background: #fdcb6e;
    color: #fff;
}

.btn-favorite {
    background: #ffeaa7;
    color: #d63031;
}

/* --- 🔥 专栏弹窗样式 --- */
.column-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    backdrop-filter: blur(4px);
}

.column-modal {
    background: #fff;
    width: 350px;
    border-radius: 16px;
    overflow: hidden;
    animation: slideUp 0.3s ease;
}

@keyframes slideUp {
    from {
        transform: translateY(20px);
        opacity: 0;
    }

    to {
        transform: translateY(0);
        opacity: 1;
    }
}

.column-select-item {
    padding: 15px 20px;
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    transition: background 0.2s;
    border-bottom: 1px solid #f5f5f5;
}

.column-select-item:hover {
    background: #f0fdf4;
}

.column-select-item .col-name {
    flex: 1;
    font-weight: 500;
}

.add-mark {
    color: #42b983;
    font-weight: bold;
}

/* 响应式适配 */
@media (max-width: 1200px) {
    .side-toolbar-wrapper {
        left: 30px;
        /* 屏幕变窄时，固定在左侧一定距离 */
    }
}

/* 🔥 当屏幕宽度低于 1050px 时，侧边栏可能会遮挡正文，此时隐藏它 */
@media (max-width: 1050px) {
    .side-toolbar-wrapper {
        opacity: 0;
        pointer-events: none;
        transform: translateX(-20px);
        /* 侧向滑出消失 */
    }
}

/* 进场动画 */
.fade-slide-enter-active,
.fade-slide-leave-active {
    transition: all 0.3s ease;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
    opacity: 0;
    transform: translate(-50%, 10px);
}

/* 引导创建按钮 */
.empty-columns-guide {
    padding: 30px 10px;
    text-align: center;
    color: #999;
}

.btn-create-now {
    margin-top: 12px;
    background: #42b883;
    color: white;
    border: none;
    padding: 8px 20px;
    border-radius: 20px;
    cursor: pointer;
    font-weight: 600;
    transition: 0.3s;
}

.modal-action-footer {
    padding: 10px;
    text-align: center;
    border-top: 1px solid #f5f5f5;
}

.text-btn {
    background: none;
    border: none;
    color: #42b883;
    font-size: 14px;
    cursor: pointer;
    font-weight: 500;
}

/* 快捷创建表单 */
.quick-create-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
}

.modal-input {
    width: 100%;
    padding: 12px;
    border: 1px solid #eee;
    border-radius: 8px;
    background: #fcfcfc;
    font-size: 14px;
    outline: none;
}

.modal-input:focus {
    border-color: #42b883;
    background: #fff;
}

.form-ops {
    display: flex;
    gap: 10px;
    margin-top: 10px;
}

.btn-secondary {
    flex: 1;
    padding: 10px;
    background: #f5f5f5;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    color: #666;
}

.btn-primary {
    flex: 2;
    padding: 10px;
    background: #42b883;
    border: none;
    border-radius: 8px;
    color: white;
    font-weight: 600;
    cursor: pointer;
}

.btn-primary:disabled {
    background: #a5d6a7;
    cursor: not-allowed;
}

/* 引导创建按钮 */
.empty-columns-guide {
    padding: 30px 10px;
    text-align: center;
    color: #999;
}

.btn-create-now {
    margin-top: 12px;
    background: #42b883;
    color: white;
    border: none;
    padding: 8px 20px;
    border-radius: 20px;
    cursor: pointer;
    font-weight: 600;
    transition: 0.3s;
}

.modal-action-footer {
    padding: 10px;
    text-align: center;
    border-top: 1px solid #f5f5f5;
}

.text-btn {
    background: none;
    border: none;
    color: #42b883;
    font-size: 14px;
    cursor: pointer;
    font-weight: 500;
}

/* 快捷创建表单 */
.quick-create-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
}

.modal-input {
    width: 100%;
    padding: 12px;
    border: 1px solid #eee;
    border-radius: 8px;
    background: #fcfcfc;
    font-size: 14px;
    outline: none;
}

.modal-input:focus {
    border-color: #42b883;
    background: #fff;
}

.form-ops {
    display: flex;
    gap: 10px;
    margin-top: 10px;
}

.btn-secondary {
    flex: 1;
    padding: 10px;
    background: #f5f5f5;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    color: #666;
}

.btn-primary {
    flex: 2;
    padding: 10px;
    background: #42b883;
    border: none;
    border-radius: 8px;
    color: white;
    font-weight: 600;
    cursor: pointer;
}

.btn-primary:disabled {
    background: #a5d6a7;
    cursor: not-allowed;
}


/* 确保 side-toolbar-wrapper 的 transition 不会跟 inline-style 冲突 */
.side-toolbar-wrapper {
    position: fixed;
    top: 400px;
    left: calc(50% - 530px);
    z-index: 100;
    /* 移除 CSS 里的 transition，改由 computed 的 sidebarStyle 统一控制，避免抖动 */
    will-change: opacity, transform;
}

/* 当屏幕变窄，侧边栏在左侧固定位置 */
@media (max-width: 1200px) {
    .side-toolbar-wrapper {
        left: 20px;
    }
}

/* 屏幕太小时完全不显示，避免遮挡 */
@media (max-width: 1050px) {
    .side-toolbar-wrapper {
        display: none !important;
    }
}

/* --- 🌀 阅读进度环专用样式 --- */
.progress-item {
    background: #fdfdfd !important;
    cursor: default !important;
    /* 进度仅展示，不可点 */
}

.progress-circle {
    width: 40px;
    height: 40px;
    transform: rotate(-90deg);
    /* 让进度从正上方开始 */
}

.progress-circle-bg {
    fill: none;
    stroke: #f1f1f1;
    /* 底色环 */
    stroke-width: 3.5;
}

/* --- 🌀 阅读进度环升级样式 --- */
.progress-circle-bar {
    fill: none;
    stroke-width: 3.5;
    stroke-linecap: round;
    stroke-dasharray: 125.6;
    /* 🔥 关键：增加 stroke 的过渡动画，让变色不生硬 */
    transition: stroke-dashoffset 0.1s linear, stroke 0.4s ease;
}

.percent-text {
    position: absolute;
    font-size: 10px;
    font-weight: 800;
    font-family: 'Inter', sans-serif;
    letter-spacing: -0.5px;
    /* 🔥 颜色也增加过渡 */
    transition: color 0.4s ease;
}

/* 🔥 亮点：当进度 >= 98% 时的发光效果 */
.progress-item.completed {
    filter: drop-shadow(0 0 3px rgba(255, 152, 0, 0.4));
    animation: pulse-orange 2s infinite;
}

@keyframes pulse-orange {
    0% {
        transform: scale(1);
    }

    50% {
        transform: scale(1.05);
    }

    100% {
        transform: scale(1);
    }
}

.percent-text small {
    font-size: 7px;
}

/* 分割线 */
.tool-divider {
    width: 20px;
    height: 1px;
    background: rgba(0, 0, 0, 0.05);
    margin: -5px auto 5px;
}

/* --- 🔥 文章导读区：主题联动优化 --- */
.article-preface {
    margin-bottom: 0;
    padding: 0 20px;
    position: relative;
    transition: all 0.5s ease;
    /* 增加整体切换时的过渡感 */
}

.preface-content {
    position: relative;
    padding: 25px 40px;
    /* 🔥 联动背景色：使用主题色的 RGB 变量，赋予极低的透明度 (0.05) */
    background: linear-gradient(to right, rgba(var(--highlight-color-rgb), 0.08), transparent);
    border-radius: 12px;
    transition: background 0.5s ease;
}

.summary-text {
    font-size: 1.08rem;
    line-height: 2;
    /* 🔥 联动字体颜色：紧跟主题高亮色 */
    color: var(--highlight-color);
    font-style: italic;
    font-family: "Kaiti", "STKaiti", serif;
    /* 使用更具文学气息的字体 */
    margin: 0;
    text-align: justify;
    transition: color 0.5s ease;
}

/* --- 🔥 虚线间距优化 --- */
.dashed-line {
    border: 0;
    border-top: 1px dashed #ccc2c2;
    margin: 30px 0;
    /* 原来是 40px，统一减小到 30px */
}

/* 优化虚线间距 */
.dashed-line.preface-gap {
    margin-top: 20px;
    margin-bottom: 30px;
    border-top: 1px dashed rgba(var(--highlight-color-rgb), 0.3);
    /* 虚线也带一点主题色调 */
    transition: border-color 0.5s ease;
}

/* 🔥 联动引号颜色 */
.quote-left,
.quote-right {
    position: absolute;
    font-size: 4.5rem;
    font-family: serif;
    /* 🔥 使用主题色并配合低透明度，显得深邃且高级 */
    color: var(--highlight-color);
    opacity: 0.2;
    line-height: 1;
    transition: color 0.5s ease;
}

.quote-left {
    top: -5px;
    left: 10px;
}

.quote-right {
    bottom: -35px;
    right: 10px;
}

/* 🔥 联动底部短下划线 */
.preface-divider {
    width: 80px;
    height: 4px;
    /* 🔥 颜色完全同步主题色 */
    background: var(--highlight-color);
    margin: 25px auto 0;
    border-radius: 10px;
    opacity: 0.8;
    box-shadow: 0 2px 10px rgba(var(--highlight-color-rgb), 0.2);
    /* 增加淡淡的同色系投影 */
    transition: all 0.5s ease;
}

.article-content {
    margin-top: 0;
}

/* 1. 遮罩层：全屏铺满，背景加深 */
.lightbox-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.9);
    z-index: 99999;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: zoom-out;
    /* 提示用户：点这里可以退出 */
    backdrop-filter: blur(10px);
}

/* 2. 图片容器 */
.lightbox-content {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    max-width: 95vw;
    max-height: 95vh;
}

/* 3. 核心：图片本体样式 */
.lightbox-image {
    /* 🔥 关键逻辑 */
    max-width: 100%;
    /* 绝不超出浏览器宽度 */
    max-height: 95vh;
    /* 绝不超出浏览器高度（留5%余量） */
    width: auto;
    /* 保持图片原有的宽度比例 */
    height: auto;
    /* 保持图片原有的高度比例 */

    object-fit: contain;
    /* 确保图片完整显示，不被裁剪 */
    border-radius: 4px;
    box-shadow: 0 0 40px rgba(0, 0, 0, 0.6);

    /* 进场动画：轻微放大弹出 */
    animation: lightbox-zoom 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* 关闭按钮位置微调 */
.lightbox-close-btn {
    position: absolute;
    top: -40px;
    right: 0;
    color: rgba(255, 255, 255, 0.8);
    font-size: 32px;
    cursor: pointer;
    background: none;
    border: none;
}

@keyframes lightbox-zoom {
    from {
        transform: scale(0.9);
        opacity: 0;
    }

    to {
        transform: scale(1);
        opacity: 1;
    }
}
</style>