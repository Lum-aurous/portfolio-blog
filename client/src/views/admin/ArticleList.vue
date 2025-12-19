<script setup>
import { ref, onMounted, reactive, watch } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/utils/api'
import { message } from '@/utils/message'

const router = useRouter()

// 数据状态
const articles = ref([])
const isLoading = ref(false)

// 查询参数
const query = reactive({
    page: 1,
    limit: 10,
    keyword: '',
    category: ''
})

// 分页信息
const pagination = reactive({
    total: 0,
    totalPages: 1
})

// 获取文章列表
const fetchArticles = async () => {
    isLoading.value = true
    try {
        const res = await api.get('/articles', { params: query })

        if (res.data.success) {
            // 兼容处理：后端如果直接返回数组（旧接口）和返回分页对象（新接口）
            if (res.data.data.list) {
                articles.value = res.data.data.list
                pagination.total = res.data.data.pagination.total
                pagination.totalPages = res.data.data.pagination.totalPages
            } else {
                // 如果后端没更新，防止报错
                articles.value = Array.isArray(res.data.data) ? res.data.data : []
            }
        }
    } catch (error) {
        console.error(error)
        message.error('加载列表失败')
    } finally {
        isLoading.value = false
    }
}

// 翻页
const changePage = (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages) return
    query.page = newPage
    fetchArticles()
}

// 搜索 (防抖或回车触发，这里简化为回车)
const handleSearch = () => {
    query.page = 1 // 搜索时重置回第一页
    fetchArticles()
}

// 删除文章
const handleDelete = async (id, title) => {
    if (!confirm(`确定要删除文章《${title}》吗？此操作不可恢复！`)) return

    try {
        const res = await api.delete(`/articles/${id}`)
        if (res.data.success) {
            message.success('删除成功')
            fetchArticles() // 刷新列表
        }
    } catch (error) {
        message.error('删除失败: ' + error.message)
    }
}

// 编辑文章
const handleEdit = (id) => {
    // 🔥 修改：带上 id 参数跳转到发布页
    router.push({ path: '/admin/publish', query: { id } })
}

// 初始化
onMounted(() => {
    fetchArticles()
})

// 辅助：处理图片路径
const getProxyUrl = (url) => {
    if (!url) return 'https://w.wallhaven.cc/full/9o/wallhaven-9oog5d.jpg'
    if (url.startsWith('http')) return url
    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
    return `${apiBase.replace(/\/api\/?$/, '')}${url}`
}

// 辅助：日期格式化
const formatDate = (str) => {
    return new Date(str).toLocaleDateString()
}
</script>

<template>
    <div class="article-list-page">
        <div class="page-header animate__animated animate__fadeInDown">
            <div class="header-title">
                <h2>📄 文章管理</h2>
                <span class="sub-text">共 {{ pagination.total }} 篇内容</span>
            </div>

            <div class="header-tools">
                <div class="search-box">
                    <span class="search-icon">🔍</span>
                    <input v-model="query.keyword" @keyup.enter="handleSearch" type="text" placeholder="搜索标题或摘要...">
                </div>
                <button class="btn-create" @click="router.push('/admin/publish')">
                    <span class="plus">+</span> 新建文章
                </button>
            </div>
        </div>

        <div class="table-container glass-panel animate__animated animate__fadeInUp">
            <table class="data-table">
                <thead>
                    <tr>
                        <th width="80">封面</th>
                        <th width="30%">标题</th>
                        <th>分类</th>
                        <th>作者</th>
                        <th>数据 (阅/评)</th>
                        <th>发布时间</th>
                        <th width="120" class="text-right">操作</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-if="isLoading">
                        <td colspan="7" class="state-cell">
                            <div class="loading-spinner"></div> 加载中...
                        </td>
                    </tr>

                    <tr v-else-if="articles.length === 0">
                        <td colspan="7" class="state-cell">暂无数据 📭</td>
                    </tr>

                    <tr v-for="item in articles" :key="item.id" class="data-row">
                        <td>
                            <div class="cover-thumb">
                                <img :src="getProxyUrl(item.cover_image)" loading="lazy">
                            </div>
                        </td>
                        <td>
                            <div class="title-wrap">
                                <span class="main-title" :title="item.title">{{ item.title }}</span>
                                <span class="sub-summary">{{ item.summary?.substring(0, 20) }}...</span>
                            </div>
                        </td>
                        <td>
                            <span class="category-tag">{{ item.category || '未分类' }}</span>
                        </td>
                        <td>
                            <div class="author-info">
                                <img :src="getProxyUrl(item.author_avatar)" class="author-face">
                                <span>{{ item.author_name || 'Admin' }}</span>
                            </div>
                        </td>
                        <td>
                            <div class="stats-box">
                                <span title="阅读">🔥 {{ item.views }}</span>
                                <span title="评论">💬 {{ item.comments }}</span>
                            </div>
                        </td>
                        <td class="date-cell">{{ formatDate(item.created_at) }}</td>
                        <td>
                            <div class="action-group">
                                <button class="btn-icon edit" title="编辑" @click="handleEdit(item.id)">✎</button>
                                <button class="btn-icon delete" title="删除"
                                    @click="handleDelete(item.id, item.title)">🗑</button>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>

            <div class="pagination-bar" v-if="pagination.totalPages > 1">
                <button class="page-btn prev" :disabled="query.page === 1"
                    @click="changePage(query.page - 1)">上一页</button>

                <span class="page-info">第 {{ query.page }} / {{ pagination.totalPages }} 页</span>

                <button class="page-btn next" :disabled="query.page === pagination.totalPages"
                    @click="changePage(query.page + 1)">下一页</button>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* 全局容器：适配深色主题 */
.article-list-page {
    max-width: 1400px;
    margin: 0 auto;
    color: #e0e0e0;
}

/* 头部样式 */
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

.header-title .sub-text {
    color: #94a3b8;
    font-size: 0.9rem;
    margin-top: 5px;
    display: block;
}

.header-tools {
    display: flex;
    gap: 15px;
}

/* 搜索框 (霓虹风格) */
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
    font-size: 1.1rem;
    opacity: 0.6;
    margin-right: 8px;
}

.search-box input {
    background: transparent;
    border: none;
    outline: none;
    color: #fff;
    padding: 10px 0;
    width: 220px;
    font-size: 0.9rem;
}

/* 新建按钮 */
.btn-create {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    border: none;
    color: white;
    padding: 0 20px;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: transform 0.2s;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.btn-create:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(16, 185, 129, 0.4);
}

.btn-create .plus {
    font-size: 1.2rem;
    font-weight: bold;
}

/* 表格容器 (毛玻璃) */
.glass-panel {
    background: rgba(30, 41, 59, 0.4);
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(10px);
    overflow: hidden;
    /* 圆角溢出隐藏 */
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.95rem;
}

.data-table thead th {
    text-align: left;
    padding: 18px 20px;
    color: #94a3b8;
    font-weight: 600;
    font-size: 0.85rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(0, 0, 0, 0.2);
}

.data-table tbody td {
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    vertical-align: middle;
    color: #e2e8f0;
}

.data-row {
    transition: background 0.2s;
}

.data-row:hover {
    background: rgba(255, 255, 255, 0.03);
}

/* 单元格内部样式 */
.cover-thumb img {
    width: 50px;
    height: 35px;
    object-fit: cover;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.title-wrap {
    display: flex;
    flex-direction: column;
}

.main-title {
    font-weight: 600;
    color: #fff;
    margin-bottom: 4px;
}

.sub-summary {
    font-size: 0.8rem;
    color: #64748b;
}

.category-tag {
    background: rgba(139, 92, 246, 0.15);
    color: #a78bfa;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 0.8rem;
    border: 1px solid rgba(139, 92, 246, 0.2);
}

.author-info {
    display: flex;
    align-items: center;
    gap: 8px;
}

.author-face {
    width: 24px;
    height: 24px;
    border-radius: 50%;
}

.stats-box {
    display: flex;
    gap: 12px;
    font-size: 0.85rem;
    color: #94a3b8;
}

.date-cell {
    font-family: monospace;
    color: #94a3b8;
}

.action-group {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
}

.btn-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: 0.2s;
}

.btn-icon.edit {
    background: rgba(59, 130, 246, 0.15);
    color: #60a5fa;
}

.btn-icon.edit:hover {
    background: #3b82f6;
    color: #fff;
}

.btn-icon.delete {
    background: rgba(244, 63, 94, 0.15);
    color: #fb7185;
}

.btn-icon.delete:hover {
    background: #f43f5e;
    color: #fff;
}

/* 状态展示 */
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

/* 分页条 */
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
</style>