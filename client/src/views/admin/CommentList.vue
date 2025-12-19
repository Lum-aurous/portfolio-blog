<script setup>
import { ref, onMounted, reactive } from 'vue'
import { api } from '@/utils/api'
import { message } from '@/utils/message'

const comments = ref([])
const isLoading = ref(false)

const query = reactive({ page: 1, limit: 10, keyword: '' })
const pagination = reactive({ total: 0, totalPages: 1 })

const fetchComments = async () => {
    isLoading.value = true
    try {
        const res = await api.get('/admin/comments', { params: query })
        if (res.data.success) {
            comments.value = res.data.data.list
            pagination.total = res.data.data.pagination.total
            pagination.totalPages = res.data.data.pagination.totalPages
        }
    } catch (error) {
        console.error(error)
        message.error('加载评论失败')
    } finally {
        isLoading.value = false
    }
}

const changePage = (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages) return
    query.page = newPage
    fetchComments()
}

const handleSearch = () => {
    query.page = 1
    fetchComments()
}

const handleDelete = async (id) => {
    if (!confirm('确定要删除这条评论吗？')) return
    try {
        const res = await api.delete(`/comments/${id}`)
        if (res.data.success) {
            message.success('删除成功')
            fetchComments()
        }
    } catch (error) {
        message.error('删除失败')
    }
}

// 🔥 新增：专门用于打开大图的函数
const viewImage = (url) => {
    // 1. 获取处理后的路径 (带域名或 / 开头)
    const targetUrl = getProxyUrl(url)

    // 2. 打开新窗口
    window.open(targetUrl, '_blank')
}

// 🔥 核心修复：路径处理函数 (同时用于头像和评论图片)
const getProxyUrl = (url) => {
    if (!url) return 'https://w.wallhaven.cc/full/9o/wallhaven-9oog5d.jpg'
    // 网络图片直接返回
    if (url.startsWith('http') || url.startsWith('data:')) return url

    // 🔥 暴力修复：把所有反斜杠转为正斜杠
    const normalizedUrl = url.replace(/\\/g, '/')

    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
    const host = apiBase.replace(/\/api\/?$/, '')
    const cleanPath = normalizedUrl.startsWith('/') ? normalizedUrl : '/' + normalizedUrl

    return `${host}${cleanPath}`
}

const formatDate = (str) => new Date(str).toLocaleString()

onMounted(fetchComments)
</script>

<template>
    <div class="comment-list-page">
        <div class="page-header animate__animated animate__fadeInDown">
            <div class="header-title">
                <h2>💬 评论管理</h2>
                <span class="sub-text">共 {{ pagination.total }} 条留言</span>
            </div>
            <div class="search-box">
                <span class="search-icon">🔍</span>
                <input v-model="query.keyword" @keyup.enter="handleSearch" type="text" placeholder="搜索评论...">
            </div>
        </div>

        <div class="table-container glass-panel animate__animated animate__fadeInUp">
            <table class="data-table">
                <thead>
                    <tr>
                        <th width="180">用户</th>
                        <th>评论内容</th>
                        <th width="200">所属文章</th>
                        <th width="160">时间</th>
                        <th width="80" class="text-right">操作</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-if="isLoading">
                        <td colspan="5" class="state-cell">
                            <div class="loading-spinner"></div> 加载中...
                        </td>
                    </tr>
                    <tr v-else-if="comments.length === 0">
                        <td colspan="5" class="state-cell">暂无评论 🦗</td>
                    </tr>

                    <tr v-for="item in comments" :key="item.id" class="data-row">
                        <td>
                            <div class="user-info">
                                <img :src="getProxyUrl(item.avatar)" class="avatar">
                                <span class="nickname">{{ item.nickname }}</span>
                            </div>
                        </td>
                        <td>
                            <div class="content-wrapper">
                                <div v-if="item.content" class="content-bubble">
                                    {{ item.content }}
                                </div>

                                <div v-if="item.images && item.images.length > 0" class="image-gallery">
                                    <div v-for="(img, idx) in item.images" :key="idx" class="img-box">
                                        <img :src="getProxyUrl(img)" loading="lazy" title="点击查看大图"
                                            @click="viewImage(img)">
                                    </div>
                                </div>
                            </div>
                        </td>
                        <td>
                            <div class="article-link">📄 {{ item.article_title }}</div>
                        </td>
                        <td class="date-cell">{{ formatDate(item.created_at) }}</td>
                        <td>
                            <div class="action-group">
                                <button class="btn-icon delete" @click="handleDelete(item.id)">🗑</button>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>

            <div class="pagination-bar" v-if="pagination.totalPages > 1">
                <button class="page-btn prev" :disabled="query.page === 1"
                    @click="changePage(query.page - 1)">上一页</button>
                <span class="page-info">{{ query.page }} / {{ pagination.totalPages }}</span>
                <button class="page-btn next" :disabled="query.page === pagination.totalPages"
                    @click="changePage(query.page + 1)">下一页</button>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* 复用 ArticleList 的深色玻璃风格，保持一致性 */
.comment-list-page {
    max-width: 1400px;
    margin: 0 auto;
    color: #e0e0e0;
}

.page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 25px;
}

.header-title h2 {
    margin: 0;
    color: #fff;
    font-size: 1.6rem;
    font-weight: 700;
}

.sub-text {
    color: #94a3b8;
    font-size: 0.9rem;
    margin-top: 5px;
    display: block;
}

.search-box {
    display: flex;
    align-items: center;
    background: rgba(30, 41, 59, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 0 12px;
    transition: all 0.3s;
}

.search-box:focus-within {
    border-color: #8b5cf6;
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2);
    background: rgba(30, 41, 59, 0.8);
}

.search-icon {
    margin-right: 8px;
    opacity: 0.6;
}

.search-box input {
    background: transparent;
    border: none;
    outline: none;
    color: #fff;
    padding: 10px 0;
    width: 220px;
}

.glass-panel {
    background: rgba(30, 41, 59, 0.4);
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(10px);
    overflow: hidden;
}

.data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.95rem;
}

.data-table th {
    text-align: left;
    padding: 18px 20px;
    color: #94a3b8;
    font-weight: 600;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(0, 0, 0, 0.2);
}

.data-table td {
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    vertical-align: middle;
}

.data-row:hover {
    background: rgba(255, 255, 255, 0.03);
}

/* 用户信息 */
.user-info {
    display: flex;
    align-items: center;
    gap: 10px;
}

.avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    object-fit: cover;
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.nickname {
    color: #fff;
    font-weight: 500;
}

/* 评论气泡 */
.content-bubble {
    background: rgba(255, 255, 255, 0.05);
    padding: 8px 12px;
    border-radius: 8px;
    color: #e2e8f0;
    line-height: 1.5;
    max-width: 400px;
}

.article-link {
    color: #60a5fa;
    font-size: 0.9rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 180px;
}

.date-cell {
    color: #64748b;
    font-size: 0.85rem;
    font-family: monospace;
}

.action-group {
    display: flex;
    justify-content: flex-end;
}

.btn-icon.delete {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    background: rgba(244, 63, 94, 0.15);
    color: #fb7185;
    transition: 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
}

.btn-icon.delete:hover {
    background: #f43f5e;
    color: #fff;
}

.state-cell {
    text-align: center;
    padding: 40px;
    color: #64748b;
}

.loading-spinner {
    display: inline-block;
    width: 20px;
    height: 20px;
    border: 2px solid #8b5cf6;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-right: 10px;
    vertical-align: middle;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.pagination-bar {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 20px;
    padding: 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.page-btn {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: #fff;
    padding: 6px 16px;
    border-radius: 6px;
    cursor: pointer;
    transition: 0.3s;
}

.page-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    border-color: #fff;
}

.page-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
}

.page-info {
    color: #94a3b8;
    font-size: 0.9rem;
}

.text-right {
    text-align: right;
}

/* 评论内容容器 */
.content-wrapper {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: 400px;
    /* 🔥 关键：限制整个评论内容的最大宽度，防止撑开表格 */
}

/* 文本气泡 */
.content-bubble {
    background: rgba(255, 255, 255, 0.05);
    padding: 8px 12px;
    border-radius: 8px;
    color: #e2e8f0;
    line-height: 1.5;
    word-break: break-all;
    /* 防止长串字符撑开 */
}

/* 🔥 图片画廊容器 */
.image-gallery {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    /* 允许换行，防止多图横向撑开 */
}

/* 🔥 单个图片盒子 */
.img-box {
    width: 60px;
    /* 固定宽度 */
    height: 60px;
    /* 固定高度 */
    border-radius: 6px;
    overflow: hidden;
    cursor: zoom-in;
    /* 鼠标放上去显示放大镜 */
    border: 1px solid rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
    /* 防止被压缩 */
    transition: transform 0.2s;
}

.img-box:hover {
    transform: scale(1.05);
    /* 悬停微放大 */
    border-color: #8b5cf6;
}

/* 🔥 图片本体 */
.img-box img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    /* 关键：裁剪填充，不变形 */
}
</style>