<script setup>
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user.js'
import { message } from '@/utils/message.js'
import { api } from '@/utils/api'
import MarkdownIt from 'markdown-it'
import 'github-markdown-css/github-markdown-light.css'

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
const selectedImages = ref([]) // { file, url }
const imageInputRef = ref(null)

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
    if (!e.target.closest('.emoji-panel') &&
        !e.target.closest('.windmill')) {
        showEmojiPicker.value = false
    }
}

// 🔥 新增：登录提示相关
const showLoginTip = () => {
    if (!isLoggedIn.value) {
        message.warning('请先登录后再留言')
    }
}

const goToLogin = () => {
    router.push('/login')
}

// 在登录成功后显示欢迎消息
const showWelcomeMessage = () => {
    message.success(`欢迎回来，${currentUser.value.nickname || currentUser.value.username}！`)
}

// 如果用户在没有登录的情况下输入了内容，登录后可以恢复
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

// Markdown 渲染
const renderedContent = computed(() => {
    if (!article.value || !article.value.content) return ''
    return md.render(article.value.content)
})

// 日期格式化
const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

// 精确时间格式化 (用于底部更新时间)
const formatFullTime = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const h = String(date.getHours()).padStart(2, '0')
    const min = String(date.getMinutes()).padStart(2, '0')
    const s = String(date.getSeconds()).padStart(2, '0')
    return `${y}-${m}-${d} ${h}:${min}:${s}`
}

const formatCommentDate = (dateStr) => {
    if (!dateStr) return ''
    return new Date(dateStr).toISOString().split('T')[0]
}

// 主题色控制
const highlightColor = ref('#f7d794')
const textThemes = [
    { id: 'classic', name: '经典', color: '#f7d794', fontColor: '#d6a354' },
    { id: 'chocolate', name: '巧克力', color: '#d2a679', fontColor: '#8b5a2b' },
    { id: 'purple', name: '暮山紫', color: '#dcd6f7', fontColor: '#9370db' }
]
const changeHighlightColor = (theme) => {
    highlightColor.value = theme.fontColor
    message.success(`主题已切换为：${theme.name}`)
}
const contentStyle = computed(() => ({ '--highlight-color': highlightColor.value }))

// API 请求
// 获取文章详情时，同时调用浏览量接口
const fetchArticle = async () => {
    loading.value = true;
    try {
        // 1. 获取文章内容
        const res = await api.get(`/articles/${route.params.id}`);
        if (res.data.success) {
            article.value = res.data.data;

            // 2. 异步增加浏览量（不阻塞页面加载）
            api.post(`/articles/${route.params.id}/view`).catch(err => {
                console.warn('浏览量统计失败:', err);
            });

            // 3. 检查文章是否被修改过
            const updateRes = await api.get(`/articles/${route.params.id}/update-status`);
            if (updateRes.data.success) {
                article.value.has_been_updated = updateRes.data.data.has_been_updated;
            }
        } else {
            message.error('文章不存在');
            router.push('/');
        }
    } catch (error) {
        message.error('加载文章失败');
        console.error('加载文章失败:', error);
    } finally {
        loading.value = false;
    }
};

const fetchComments = async () => {
    try {
        const res = await api.get('/comments', { params: { article_id: route.params.id } })
        if (res.data.success) comments.value = res.data.data
    } catch (error) {
        console.error('加载评论失败:', error)
    }
}

const submitComment = async () => {
    console.log('🔐 当前 Token:', localStorage.getItem('token'))
    console.log('👤 当前用户:', localStorage.getItem('user'))

    if (!isLoggedIn.value) {
        return message.error('您还没有登录，不可进行评论！！')
    }

    if (!commentContent.value.trim() && selectedImages.value.length === 0) {
        return message.warning('不能发送空评论')
    }

    isSubmitting.value = true

    try {
        let imageUrls = []

        // 如果有图片，先上传图片
        if (selectedImages.value.length) {
            const formData = new FormData()
            selectedImages.value.forEach(i => {
                formData.append('images', i.file)
            })

            const uploadRes = await api.post('/upload/comment-images', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            })

            if (uploadRes.data.success) {
                imageUrls = uploadRes.data.data.urls
            }
        }

        // 提交评论
        const res = await api.post('/comments', {
            article_id: route.params.id,
            content: commentContent.value,
            images: imageUrls
        })

        if (res.data.success) {
            message.success('留言成功！')
            commentContent.value = ''
            selectedImages.value = []
            fetchComments()
        }
    } catch (e) {
        message.error('评论失败: ' + (e.response?.data?.message || e.message))
        console.error('评论失败:', e)
    } finally {
        isSubmitting.value = false
    }
}

const replyTo = (nickname) => {
    const prefix = `@${nickname} `
    if (!commentContent.value.startsWith(prefix)) commentContent.value = prefix + commentContent.value
    document.getElementById('comment-input')?.focus()
}

const deleteComment = async (id) => {
    if (!confirm('确定删除?')) return
    try {
        await api.delete(`/comments/${id}`)
        message.success('已删除')
        fetchComments()
    } catch (e) {
        message.error('删除失败')
        console.error('删除失败:', e)
    }
}

const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })


// 监听登录状态变化
watch(isLoggedIn, (newVal) => {
    if (newVal) {
        restoreCommentContent()
        showWelcomeMessage()
    }
})

// 当用户未登录时输入内容，可以临时保存
watch(commentContent, (newVal) => {
    if (!isLoggedIn.value && newVal.trim()) {
        localStorage.setItem('temp_comment', newVal)
    }
})

onMounted(() => {
    fetchArticle()
    fetchComments()
    window.scrollTo(0, 0)
    document.addEventListener('click', closeEmojiPicker)
})

onUnmounted(() => {
    document.removeEventListener('click', closeEmojiPicker)
    // 清理所有图片 URL
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
                    <h1 class="article-title">【年度更新】{{ article.title }}</h1>
                    <div class="article-meta">
                        <div class="meta-item author">
                            <img :src="article.author_avatar || 'https://w.wallhaven.cc/full/9o/wallhaven-9oog5d.jpg'"
                                class="author-avatar">
                            <span>{{ article.author_name || 'Veritas' }}</span>
                        </div>
                        <span class="meta-divider">·</span>
                        <div class="meta-item">📅 {{ formatDate(article.created_at) }}</div>
                        <span class="meta-divider">·</span>
                        <div class="meta-item">🔥 {{ article.views || 1201 }}</div>
                        <span class="meta-divider">·</span>
                        <div class="meta-item">💬 {{ comments.length }}</div>
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
                    <p><strong>作者：</strong> {{ article.author_name || 'Veritas' }}</p>
                    <p>1. 本网站部分内容可能来源于网络,仅供大家学习与参考,如有侵权,请联系站长删除处理。</p>
                    <p>2. 本网站一切内容不代表本站立场,并不代表本站赞同其观点和对其真实性负责。</p>
                    <p>3. 版权&许可请详阅 <span class="link">版权声明</span></p>
                </div>

                <div class="action-buttons-row">
                    <button class="btn-large btn-purple"><span class="icon">☁️</span> 订阅</button>
                    <button class="btn-large btn-pink"><span class="icon">❤️</span> 卡片分享</button>
                </div>

                <div class="comment-section" id="comments">
                    <div class="comment-header-row">
                        <span class="icon-edit">📝</span>
                        <span class="comment-title">留言</span>
                    </div>

                    <!-- 🔥 新增：登录提示区域 -->
                    <div v-if="!isLoggedIn" class="login-prompt-card">
                        <div class="prompt-content">
                            <div class="prompt-icon">🔐</div>
                            <div class="prompt-text">
                                <p class="prompt-title">登录后即可留言</p>
                                <p class="prompt-desc">与作者和其他读者交流互动</p>
                            </div>
                            <button class="prompt-login-btn" @click="goToLogin">立即登录</button>
                        </div>
                    </div>

                    <div class="comment-box-wrapper">
                        <div class="comment-box-beige">
                            <textarea id="comment-input" v-model="commentContent" placeholder="写下点什么..."
                                :disabled="!isLoggedIn">
                            </textarea>

                            <!-- 🔥 调整：当未登录时，给一个半透明遮罩 -->
                            <div v-if="!isLoggedIn" class="disabled-overlay" @click="showLoginTip"></div>

                            <div v-if="selectedImages.length" class="image-preview">
                                <div v-for="(img, index) in selectedImages" :key="index" class="preview-item">
                                    <img :src="img.url" />
                                    <span class="remove" @click="removeImage(index)">×</span>
                                </div>
                            </div>

                            <div class="input-illustration">
                                <img src="https://cdna.artstation.com/p/assets/images/images/024/538/827/original/pixel-jeff-clipa-s.gif"
                                    alt="cat">
                            </div>
                            <Teleport to="body">
                                <div v-if="showEmojiPicker" class="emoji-panel" @click.stop>
                                    <span v-for="emoji in emojis" :key="emoji" class="emoji-item"
                                        @click="insertEmoji(emoji)">
                                        {{ emoji }}
                                    </span>
                                </div>
                            </Teleport>

                        </div>

                        <div class="comment-toolbar">
                            <!-- 移除Teleport，将emoji面板直接放在tool-left内部 -->
                            <div class="tool-left">
                                <!-- Emoji -->
                                <div class="tool-icon-btn windmill" title="Emoji"
                                    @click.stop="showEmojiPicker = !showEmojiPicker">
                                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                                        <path
                                            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                                    </svg>
                                </div>

                                <!-- Emoji 面板 -->
                                <div v-if="showEmojiPicker" class="emoji-panel" @click.stop>
                                    <span v-for="emoji in emojis" :key="emoji" class="emoji-item"
                                        @click="insertEmoji(emoji)">
                                        {{ emoji }}
                                    </span>
                                </div>

                                <!-- 图片 -->
                                <div class="tool-icon-btn image-upload" title="上传图片" @click="handleImageUpload">
                                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                                        <path
                                            d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                                    </svg>
                                </div>

                                <!-- 隐藏 input -->
                                <input ref="imageInputRef" type="file" accept="image/*" multiple hidden
                                    @change="handleSelectImage" />
                            </div>

                            <button class="submit-btn-purple" @click="submitComment"
                                :disabled="isSubmitting || !isLoggedIn">
                                {{ isLoggedIn ? '提交' : '登录' }}
                            </button>
                        </div>
                    </div>

                    <div class="comment-list-header">Comments | {{ comments.length }} 条留言</div>

                    <div class="comment-list">
                        <div v-for="item in comments" :key="item.id" class="yt-comment-item">
                            <!-- 左侧头像 -->
                            <div class="yt-avatar">
                                <img :src="item.avatar || 'https://w.wallhaven.cc/full/9o/wallhaven-9oog5d.jpg'"
                                    alt="avatar" />
                            </div>

                            <!-- 右侧主体 -->
                            <div class="yt-main">
                                <!-- 用户名 -->
                                <div class="yt-username">
                                    @{{ item.nickname }}
                                    <span class="yt-date">
                                        {{ formatCommentDate(item.created_at) }}
                                    </span>
                                </div>

                                <!-- 内容 -->
                                <div class="yt-content">
                                    <div>{{ item.content }}</div>

                                    <div v-if="item.images?.length" class="comment-images">
                                        <img v-for="(img, i) in item.images" :key="i" :src="img" />
                                    </div>
                                </div>

                                <!-- 操作栏 -->
                                <div class="yt-actions">
                                    <div class="yt-action-btn">
                                        👍 <span class="count">0</span>
                                    </div>
                                    <div class="yt-action-btn">
                                        👎
                                    </div>
                                    <div class="yt-action-reply" @click="replyTo(item.nickname)">
                                        回复
                                    </div>

                                    <div v-if="isAdmin" class="yt-action-delete" @click="deleteComment(item.id)">
                                        删除
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </main>

        <div class="floating-tools">
            <div class="tool-btn" title="目录"><span class="icon">☰</span></div>
            <div class="tool-btn" @click="scrollToTop" title="回到顶部"><span class="icon">🚀</span></div>
            <div class="tool-btn" title="设置"><span class="icon">⚙️</span></div>
        </div>

        <div style="height: 100px;"></div>
    </div>

    <div v-else class="loading-screen">
        <div class="loading-spinner"></div>
    </div>
</template>

<style scoped>
/* ==================== 1. Markdown 样式隔离 (关键) ==================== */
.markdown-body {
    box-sizing: border-box;
    min-width: 200px;
    max-width: 100%;
    margin: 0 auto;
    padding: 10px 0;
    font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif;
    background: transparent !important;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3) {
    border-bottom: none;
    font-weight: 700;
    color: #333;
    margin-top: 40px;
    margin-bottom: 20px;
    position: relative;
}

.markdown-body :deep(h1)::before,
.markdown-body :deep(h2)::before,
.markdown-body :deep(h3)::before {
    content: "# ";
    color: #ff7e5f;
    font-weight: 900;
    margin-right: 8px;
}

.markdown-body :deep(strong) {
    color: var(--highlight-color);
    transition: color 0.3s;
}

/* ==================== 2. Header 样式 ==================== */
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

.meta-item {
    display: flex;
    align-items: center;
    gap: 6px;
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
    transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    user-select: none;
}

.q-btn:hover {
    transform: scale(1.15) translateY(-5px);
    box-shadow: 0 8px 15px rgba(0, 0, 0, 0.3);
}

.q-btn:active {
    transform: scale(0.95);
}

/* ==================== 3. 主体内容区 ==================== */
.article-page {
    background-color: #ffffff;
    min-height: 100vh;
    font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', sans-serif;
}

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
}

.custom-h2 {
    font-size: 1.4rem;
    font-weight: 700;
    color: #333;
    margin: 30px 0 20px;
    display: flex;
    align-items: center;
    gap: 8px;
}

.hash {
    color: #ff7e5f;
    font-weight: 900;
}

.intro-text {
    font-size: 1rem;
    color: #e74c3c;
    line-height: 1.6;
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
    font-family: Arial, sans-serif;
    letter-spacing: 0.5px;
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

.copyright-box p {
    margin: 5px 0;
}

.copyright-box .link {
    color: #007bff;
    cursor: pointer;
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

/* ==================== 4. 评论区 ==================== */
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

/* 登录提示卡片 */
.login-prompt-card {
    background: linear-gradient(135deg, #f8f9ff 0%, #fff4f4 100%);
    border: 2px solid #ffd6d6;
    border-radius: 12px;
    padding: 16px 20px;
    margin-bottom: 20px;
    box-shadow: 0 4px 12px rgba(255, 107, 107, 0.1);
    animation: fadeIn 0.5s ease;
}

.prompt-content {
    display: flex;
    align-items: center;
    gap: 15px;
}

.prompt-icon {
    font-size: 32px;
    background: #ff7e5f;
    color: white;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
}

.prompt-text {
    flex: 1;
}

.prompt-title {
    font-weight: 600;
    color: #333;
    margin: 0 0 4px 0;
    font-size: 1rem;
}

.prompt-desc {
    color: #666;
    margin: 0;
    font-size: 0.85rem;
}

.prompt-login-btn {
    background: linear-gradient(135deg, #ff7e5f 0%, #feb47b 100%);
    color: white;
    border: none;
    padding: 8px 20px;
    border-radius: 25px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(255, 126, 95, 0.3);
}

.prompt-login-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(255, 126, 95, 0.4);
}

/* 评论框容器 */
.comment-box-wrapper {
    margin-bottom: 40px;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
}

.comment-box-beige {
    background: #fff9e6;
    border: 2px solid #f0e6d2;
    border-radius: 12px 12px 0 0;
    padding: 20px;
    position: relative;
    min-height: 180px;
    box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.02);
    overflow: hidden;
}

/* 禁用状态遮罩 */
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
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
}

.disabled-overlay:hover {
    opacity: 1;
}

.disabled-overlay::after {
    content: "点击登录后留言";
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 0.9rem;
    animation: pulse 2s infinite;
}

textarea {
    width: 100%;
    border: none;
    background: transparent;
    outline: none;
    resize: vertical;
    min-height: 120px;
    font-size: 1rem;
    color: #555;
    z-index: 2;
    position: relative;
    font-family: inherit;
}

textarea:disabled {
    background-color: transparent;
    cursor: not-allowed;
    color: #999;
}

.input-illustration {
    position: absolute;
    right: 15px;
    bottom: 0;
    z-index: 1;
    opacity: 0.85;
    pointer-events: none;
}

.input-illustration img {
    width: 120px;
    display: block;
    mix-blend-mode: multiply;
    filter: drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.05));
    transition: transform 0.3s ease;
}

.comment-box-beige:focus-within .input-illustration img {
    transform: translateY(-5px) scale(1.05);
}

/* 工具栏 */
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

/* 风车旋转特效 */
.tool-icon-btn.windmill:hover svg {
    animation: spin 0.8s linear infinite;
}

/* Emoji 面板 */
.emoji-panel {
    position: absolute;
    bottom: 100%;
    left: 0;
    background: #fff;
    border: 1px solid #eee;
    border-radius: 8px;
    padding: 10px;
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 8px;
    z-index: 100;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    min-width: 280px;
    margin-bottom: 8px;
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

/* 图片预览 */
.image-preview {
    display: flex;
    gap: 10px;
    margin-top: 10px;
    flex-wrap: wrap;
}

.preview-item {
    position: relative;
}

.preview-item img {
    width: 80px;
    height: 80px;
    border-radius: 6px;
    object-fit: cover;
    border: 1px solid #ddd;
}

.preview-item .remove {
    position: absolute;
    top: -6px;
    right: -6px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #000;
    color: #fff;
    font-size: 12px;
    text-align: center;
    line-height: 18px;
    cursor: pointer;
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

/* 评论列表 */
.comment-list-header {
    font-size: 1rem;
    color: #666;
    margin-bottom: 20px;
    border-left: 4px solid #666;
    padding-left: 10px;
    line-height: 1;
}

/* ================= YouTube 风格评论 ================= */
.yt-comment-item {
    display: flex;
    gap: 16px;
    padding: 16px 0;
    border-bottom: 1px solid #eee;
}

.yt-avatar img {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    background: #ddd;
}

.yt-main {
    flex: 1;
}

.yt-username {
    font-size: 0.9rem;
    font-weight: 600;
    color: #0f0f0f;
}

.yt-date {
    margin-left: 8px;
    font-size: 0.75rem;
    color: #888;
}

.yt-content {
    margin-top: 6px;
    font-size: 0.95rem;
    line-height: 1.6;
    color: #111;
    white-space: pre-wrap;
}

.comment-images {
    display: flex;
    gap: 8px;
    margin-top: 10px;
    flex-wrap: wrap;
}

.comment-images img {
    max-width: 150px;
    max-height: 150px;
    border-radius: 8px;
    object-fit: cover;
    cursor: pointer;
    transition: transform 0.2s;
}

.comment-images img:hover {
    transform: scale(1.05);
}

.yt-actions {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 8px;
    font-size: 0.8rem;
    color: #606060;
}

.yt-action-btn {
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    transition: color 0.2s;
}

.yt-action-btn:hover {
    color: #0f0f0f;
}

.yt-action-reply {
    cursor: pointer;
    font-weight: 500;
    transition: color 0.2s;
}

.yt-action-reply:hover {
    color: #0f0f0f;
}

.yt-action-delete {
    cursor: pointer;
    color: #ff4d4f;
    transition: all 0.2s;
}

.yt-action-delete:hover {
    text-decoration: underline;
    color: #ff1a1a;
}

/* 悬浮工具栏 */
.floating-tools {
    position: fixed;
    right: 30px;
    bottom: 100px;
    display: flex;
    flex-direction: column;
    gap: 15px;
    z-index: 99;
}

.tool-btn {
    width: 45px;
    height: 45px;
    background: #222;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    transition: 0.3s;
    color: #fff;
    opacity: 0.9;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.tool-btn:hover {
    transform: translateY(-5px);
    background: #000;
    opacity: 1;
}

/* 加载动画 */
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

/* 动画定义 */
@keyframes spin {
    0% {
        transform: rotate(0deg);
    }

    100% {
        transform: rotate(360deg);
    }
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(-10px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes pulse {

    0%,
    100% {
        opacity: 0.8;
        transform: scale(1);
    }

    50% {
        opacity: 1;
        transform: scale(1.05);
    }
}

/* ==================== 响应式设计 ==================== */
@media (max-width: 768px) {
    .content-card {
        padding: 15px;
        margin-top: 20px;
    }

    .hero-header {
        height: 35vh;
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

    .article-title {
        font-size: 1.4rem;
    }

    .input-illustration {
        display: none;
    }

    .emoji-panel {
        grid-template-columns: repeat(6, 1fr);
        min-width: 220px;
    }

    .floating-tools {
        right: 15px;
        bottom: 60px;
    }

    .tool-btn {
        width: 40px;
        height: 40px;
    }

    .prompt-content {
        flex-direction: column;
        text-align: center;
        gap: 10px;
    }

    .prompt-login-btn {
        width: 100%;
        padding: 10px;
    }

    .disabled-overlay::after {
        font-size: 0.8rem;
        padding: 6px 12px;
    }
}
</style>