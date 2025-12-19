<script setup>
import { ref, onMounted, reactive } from 'vue'
import { api } from '@/utils/api'
import { message } from '@/utils/message'

// 数据状态
const notices = ref([])
const isLoading = ref(false)
const showModal = ref(false)
const isSubmitting = ref(false)

// 新建表单
const form = reactive({
    content: '',
    is_active: true
})

// 获取列表
const fetchNotices = async () => {
    isLoading.value = true
    try {
        const res = await api.get('/admin/notices')
        if (res.data.success) {
            notices.value = res.data.data
        }
    } catch (error) {
        console.error(error)
        message.error('加载失败')
    } finally {
        isLoading.value = false
    }
}

// 切换状态 (开关)
const toggleStatus = async (notice) => {
    // 乐观更新：先在UI上变
    const originalState = notice.is_active
    const newState = originalState === 1 ? 0 : 1
    notice.is_active = newState

    try {
        await api.put(`/admin/notices/${notice.id}`, { is_active: newState })
        message.success(newState ? '已启用' : '已停用')
    } catch (error) {
        // 失败回滚
        notice.is_active = originalState
        message.error('操作失败')
    }
}

// 删除
const handleDelete = async (id) => {
    if (!confirm('确认删除这条公告吗？')) return
    try {
        await api.delete(`/admin/notices/${id}`)
        message.success('删除成功')
        notices.value = notices.value.filter(n => n.id !== id)
    } catch (error) {
        message.error('删除失败')
    }
}

// 提交发布
const submitNotice = async () => {
    if (!form.content.trim()) return message.warning('写点什么吧...')

    isSubmitting.value = true
    try {
        const res = await api.post('/admin/notices', form)
        if (res.data.success) {
            message.success('发布成功')
            showModal.value = false
            form.content = '' // 重置
            fetchNotices() // 刷新
        }
    } catch (error) {
        message.error('发布失败')
    } finally {
        isSubmitting.value = false
    }
}

const formatDate = (str) => new Date(str).toLocaleString()

onMounted(fetchNotices)
</script>

<template>
    <div class="notice-list-page">
        <div class="page-header animate__animated animate__fadeInDown">
            <div class="header-left">
                <h2>📢 公告管理</h2>
                <span class="sub-text">管理全站滚动通知，建议只启用一条最新消息</span>
            </div>
            <button class="btn-primary" @click="showModal = true">
                <span class="icon">+</span> 发布公告
            </button>
        </div>

        <div class="table-container glass-panel animate__animated animate__fadeInUp">
            <table class="data-table">
                <thead>
                    <tr>
                        <th width="100">状态</th>
                        <th>公告内容</th>
                        <th width="200">发布时间</th>
                        <th width="100" class="text-right">操作</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-if="isLoading">
                        <td colspan="4" class="state-cell">加载中...</td>
                    </tr>
                    <tr v-else-if="notices.length === 0">
                        <td colspan="4" class="state-cell">暂无公告</td>
                    </tr>

                    <tr v-for="item in notices" :key="item.id" class="data-row"
                        :class="{ 'inactive': !item.is_active }">
                        <td>
                            <div class="toggle-switch" :class="{ active: item.is_active }" @click="toggleStatus(item)">
                                <div class="knob"></div>
                            </div>
                        </td>
                        <td>
                            <div class="content-text">{{ item.content }}</div>
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
        </div>

        <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
            <div class="modal-card animate__animated animate__zoomIn">
                <h3>📝 发布新公告</h3>
                <textarea v-model="form.content" rows="5" placeholder="请输入公告内容... (支持 Emoji 🎉)"
                    class="glass-input"></textarea>
                <div class="modal-actions">
                    <button class="btn-cancel" @click="showModal = false">取消</button>
                    <button class="btn-confirm" @click="submitNotice" :disabled="isSubmitting">
                        {{ isSubmitting ? '发布中...' : '🚀 立即发布' }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.notice-list-page {
    max-width: 1200px;
    margin: 0 auto;
    color: #fff;
}

.page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 25px;
}

.header-left h2 {
    margin: 0;
    font-size: 1.6rem;
}

.sub-text {
    color: #94a3b8;
    font-size: 0.9rem;
    margin-top: 5px;
    display: block;
}

.btn-primary {
    background: linear-gradient(135deg, #8b5cf6, #6366f1);
    border: none;
    padding: 10px 24px;
    border-radius: 8px;
    color: #fff;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: transform 0.2s;
    box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3);
}

.btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(139, 92, 246, 0.5);
}

/* 玻璃面板 & 表格 */
.glass-panel {
    background: rgba(30, 41, 59, 0.4);
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(10px);
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.data-table {
    width: 100%;
    border-collapse: collapse;
}

.data-table th {
    text-align: left;
    padding: 18px 24px;
    color: #94a3b8;
    background: rgba(0, 0, 0, 0.2);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.data-table td {
    padding: 16px 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    vertical-align: middle;
}

.data-row:hover {
    background: rgba(255, 255, 255, 0.03);
}

/* 开关样式 */
.toggle-switch {
    width: 44px;
    height: 24px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    position: relative;
    cursor: pointer;
    transition: 0.3s;
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.toggle-switch.active {
    background: #10b981;
    border-color: #10b981;
    box-shadow: 0 0 10px rgba(16, 185, 129, 0.4);
}

.knob {
    width: 18px;
    height: 18px;
    background: #fff;
    border-radius: 50%;
    position: absolute;
    top: 2px;
    left: 2px;
    transition: 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.toggle-switch.active .knob {
    transform: translateX(20px);
}

/* 内容 */
.content-text {
    font-size: 1rem;
    color: #e2e8f0;
    line-height: 1.5;
}

.data-row.inactive .content-text {
    color: #64748b;
    text-decoration: line-through;
    opacity: 0.7;
}

.date-cell {
    color: #64748b;
    font-family: monospace;
}

.text-right {
    text-align: right;
}

.action-group {
    display: flex;
    justify-content: flex-end;
}

.btn-icon.delete {
    width: 36px;
    height: 36px;
    background: rgba(239, 68, 68, 0.15);
    color: #fb7185;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: 0.2s;
}

.btn-icon.delete:hover {
    background: #f43f5e;
    color: #fff;
}

.state-cell {
    text-align: center;
    padding: 40px;
    color: #94a3b8;
}

/* 模态框 */
.modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(5px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.modal-card {
    background: #1e293b;
    width: 500px;
    padding: 30px;
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
}

.modal-card h3 {
    margin: 0 0 20px 0;
    font-size: 1.4rem;
}

.glass-input {
    width: 100%;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 16px;
    color: #fff;
    outline: none;
    resize: vertical;
    font-size: 1rem;
    transition: 0.3s;
}

.glass-input:focus {
    border-color: #8b5cf6;
    background: rgba(255, 255, 255, 0.08);
}

.modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 25px;
}

.btn-cancel {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: #ccc;
    padding: 10px 20px;
    border-radius: 8px;
    cursor: pointer;
}

.btn-cancel:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #fff;
}

.btn-confirm {
    background: #8b5cf6;
    border: none;
    color: #fff;
    padding: 10px 24px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
}

.btn-confirm:hover {
    background: #7c3aed;
}
</style>