<script setup>
import { ref, onMounted, reactive } from 'vue'
import { api } from '@/utils/api'
import { message } from '@/utils/message'

const users = ref([])
const isLoading = ref(false)

const query = reactive({
    page: 1,
    limit: 10,
    keyword: ''
})

const pagination = reactive({
    total: 0,
    totalPages: 1
})

// 获取用户列表
const fetchUsers = async () => {
    isLoading.value = true
    try {
        const res = await api.get('/admin/users', { params: query })
        if (res.data.success) {
            users.value = res.data.data.list
            pagination.total = res.data.data.pagination.total
            pagination.totalPages = res.data.data.pagination.totalPages
        }
    } catch (error) {
        console.error(error)
        message.error('加载用户失败')
    } finally {
        isLoading.value = false
    }
}

// 切换角色
const toggleRole = async (user) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin'
    const actionName = newRole === 'admin' ? '提拔为管理员' : '降级为普通用户'

    if (!confirm(`确定要将用户 "${user.nickname}" ${actionName} 吗？`)) return

    try {
        const res = await api.patch(`/admin/users/${user.id}/role`, { role: newRole })
        if (res.data.success) {
            message.success('权限修改成功')
            user.role = newRole // 本地更新状态，无需刷新
        }
    } catch (error) {
        message.error(error.response?.data?.message || '操作失败')
    }
}

const handleSearch = () => {
    query.page = 1
    fetchUsers()
}

const changePage = (p) => {
    if (p < 1 || p > pagination.totalPages) return
    query.page = p
    fetchUsers()
}

// 辅助：头像处理 (增强版：修复Windows路径 + 拼接后端地址)
const getAvatar = (url) => {
    // 1. 如果没有头像，返回默认图
    if (!url) return 'https://w.wallhaven.cc/full/9o/wallhaven-9oog5d.jpg'

    // 2. 如果是网络图片 (http/https) 或 Base64，直接返回
    if (url.startsWith('http') || url.startsWith('data:')) return url

    // 3. 🔥 核心修复：把所有的反斜杠 \ 替换为正斜杠 / (针对 Windows 旧数据)
    const normalizedUrl = url.replace(/\\/g, '/')

    // 4. 拼接后端地址
    // 这里的逻辑是：如果路径是相对的 (如 /uploads/xxx)，就加上 http://localhost:3000
    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
    const host = apiBase.replace(/\/api\/?$/, '')

    // 确保路径以 / 开头
    const cleanPath = normalizedUrl.startsWith('/') ? normalizedUrl : '/' + normalizedUrl

    return `${host}${cleanPath}`
}

const formatDate = (str) => new Date(str).toLocaleDateString()

onMounted(fetchUsers)
</script>

<template>
    <div class="user-list-page">
        <div class="page-header animate__animated animate__fadeInDown">
            <div class="header-title">
                <h2>👥 用户管理</h2>
                <span class="sub-text">共 {{ pagination.total }} 位注册用户</span>
            </div>

            <div class="search-box">
                <span class="search-icon">🔍</span>
                <input v-model="query.keyword" @keyup.enter="handleSearch" type="text" placeholder="搜索用户名或昵称...">
            </div>
        </div>

        <div class="table-container glass-panel animate__animated animate__fadeInUp">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>用户</th>
                        <th>联系方式</th>
                        <th>角色权限</th>
                        <th>注册时间</th>
                        <th class="text-right">操作</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-if="isLoading">
                        <td colspan="5" class="state-cell">
                            <div class="loading-spinner"></div> 加载中...
                        </td>
                    </tr>
                    <tr v-for="user in users" :key="user.id" class="data-row">
                        <td>
                            <div class="user-info">
                                <img :src="getAvatar(user.avatar)" class="avatar">
                                <div class="name-col">
                                    <span class="nickname">{{ user.nickname }}</span>
                                    <span class="username">@{{ user.username }}</span>
                                </div>
                            </div>
                        </td>
                        <td>
                            <div class="contact-info">
                                <div v-if="user.email">📧 {{ user.email }}</div>
                                <div v-if="user.phone">📱 {{ user.phone }}</div>
                                <div v-if="!user.email && !user.phone" class="dim">无联系方式</div>
                            </div>
                        </td>
                        <td>
                            <span class="role-badge" :class="user.role">
                                {{ user.role === 'admin' ? '👑 管理员' : '👤 普通用户' }}
                            </span>
                        </td>
                        <td class="date-cell">{{ formatDate(user.created_at) }}</td>
                        <td>
                            <div class="action-group">
                                <button class="btn-role" :class="user.role === 'admin' ? 'demote' : 'promote'"
                                    @click="toggleRole(user)" title="修改权限">
                                    {{ user.role === 'admin' ? '⬇️ 降级' : '⬆️ 提拔' }}
                                </button>
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
/* 同样复用深色玻璃风格 */
.user-list-page {
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

/* 用户信息列 */
.user-info {
    display: flex;
    align-items: center;
    gap: 12px;
}

.avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid rgba(255, 255, 255, 0.1);
}

.name-col {
    display: flex;
    flex-direction: column;
}

.nickname {
    color: #fff;
    font-weight: 500;
    font-size: 0.95rem;
}

.username {
    color: #64748b;
    font-size: 0.8rem;
}

.contact-info {
    font-size: 0.85rem;
    color: #94a3b8;
    line-height: 1.4;
}

.dim {
    opacity: 0.5;
    font-style: italic;
}

/* 角色徽章 */
.role-badge {
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: 600;
}

.role-badge.admin {
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.2);
}

.role-badge.user {
    background: rgba(148, 163, 184, 0.15);
    color: #cbd5e1;
    border: 1px solid rgba(148, 163, 184, 0.2);
}

.date-cell {
    color: #64748b;
    font-family: monospace;
}

/* 操作按钮 */
.action-group {
    display: flex;
    justify-content: flex-end;
}

.btn-role {
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    border: none;
    font-size: 0.8rem;
    transition: 0.2s;
    font-weight: 500;
}

.btn-role.promote {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
}

.btn-role.promote:hover {
    background: #059669;
    color: #fff;
}

.btn-role.demote {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
}

.btn-role.demote:hover {
    background: #dc2626;
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
}

.page-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    border-color: #fff;
}

.page-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
}

.text-right {
    text-align: right;
}
</style>