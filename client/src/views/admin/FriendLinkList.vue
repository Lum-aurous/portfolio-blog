<script setup>
import { ref, onMounted, reactive } from 'vue'
import { api } from '@/utils/api'
import { message } from '@/utils/message'

const links = ref([])
const isLoading = ref(false)
const showModal = ref(false)
const isSubmitting = ref(false)
const isEditMode = ref(false) // 是否是编辑模式

const form = reactive({
    id: null,
    name: '',
    link: '',
    avatar: '',
    description: ''
})

// 获取列表
const fetchLinks = async () => {
    isLoading.value = true
    try {
        const res = await api.get('/friend_links') // 复用公共接口即可
        if (res.data.success) {
            links.value = res.data.data
        }
    } catch (error) {
        message.error('加载失败')
    } finally {
        isLoading.value = false
    }
}

// 打开新增弹窗
const openAddModal = () => {
    isEditMode.value = false
    Object.assign(form, { id: null, name: '', link: '', avatar: '', description: '' })
    showModal.value = true
}

// 打开编辑弹窗
const openEditModal = (item) => {
    isEditMode.value = true
    Object.assign(form, item) // 填充数据
    showModal.value = true
}

// 提交 (新增或修改)
const handleSubmit = async () => {
    if (!form.name || !form.link) return message.warning('名称和链接必填')

    isSubmitting.value = true
    try {
        if (isEditMode.value) {
            await api.put(`/admin/friend_links/${form.id}`, form)
            message.success('修改成功')
        } else {
            await api.post('/admin/friend_links', form)
            message.success('添加成功')
        }
        showModal.value = false
        fetchLinks()
    } catch (error) {
        message.error('操作失败')
    } finally {
        isSubmitting.value = false
    }
}

// 删除
const handleDelete = async (id) => {
    if (!confirm('确认删除这个友链吗？')) return
    try {
        await api.delete(`/admin/friend_links/${id}`)
        message.success('删除成功')
        links.value = links.value.filter(l => l.id !== id)
    } catch (error) {
        message.error('删除失败')
    }
}

onMounted(fetchLinks)
</script>

<template>
    <div class="link-manager">
        <div class="page-header animate__animated animate__fadeInDown">
            <h2>🔗 友链管理</h2>
            <button class="btn-primary" @click="openAddModal">+ 添加友链</button>
        </div>

        <div class="table-container glass-panel animate__animated animate__fadeInUp">
            <table class="data-table">
                <thead>
                    <tr>
                        <th width="80">图标</th>
                        <th>网站名称</th>
                        <th>简介</th>
                        <th>链接</th>
                        <th width="120" class="text-right">操作</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in links" :key="item.id" class="data-row">
                        <td>
                            <img :src="item.avatar || 'https://via.placeholder.com/40'" class="link-icon" alt="icon">
                        </td>
                        <td class="font-bold">{{ item.name }}</td>
                        <td class="desc-cell">{{ item.description }}</td>
                        <td><a :href="item.link" target="_blank" class="link-url">{{ item.link }}</a></td>
                        <td>
                            <div class="action-group">
                                <button class="btn-icon edit" @click="openEditModal(item)">✎</button>
                                <button class="btn-icon delete" @click="handleDelete(item.id)">🗑</button>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
            <div class="modal-card animate__animated animate__zoomIn">
                <h3>{{ isEditMode ? '✏️ 编辑友链' : '✨ 添加友链' }}</h3>

                <div class="form-item">
                    <label>网站名称 *</label>
                    <input v-model="form.name" type="text" placeholder="例如: Vue.js">
                </div>

                <div class="form-item">
                    <label>网站链接 *</label>
                    <input v-model="form.link" type="text" placeholder="https://...">
                </div>

                <div class="form-item">
                    <label>Logo/头像链接</label>
                    <input v-model="form.avatar" type="text" placeholder="https://.../logo.png">
                </div>

                <div class="form-item">
                    <label>简介</label>
                    <textarea v-model="form.description" rows="3" placeholder="一句话介绍..."></textarea>
                </div>

                <div class="modal-actions">
                    <button class="btn-cancel" @click="showModal = false">取消</button>
                    <button class="btn-confirm" @click="handleSubmit" :disabled="isSubmitting">
                        {{ isSubmitting ? '保存中...' : '确定保存' }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* 复用之前的 Glass 风格，稍微调整细节 */
.link-manager {
    max-width: 1200px;
    margin: 0 auto;
    color: #fff;
}

.page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}

.glass-panel {
    background: rgba(30, 41, 59, 0.4);
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(10px);
    padding: 5px;
}

.data-table {
    width: 100%;
    border-collapse: collapse;
}

.data-table th {
    text-align: left;
    padding: 15px;
    color: #94a3b8;
    background: rgba(0, 0, 0, 0.2);
}

.data-table td {
    padding: 15px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    vertical-align: middle;
}

.link-icon {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
    background: #fff;
}

.font-bold {
    font-weight: 600;
    color: #e2e8f0;
}

.desc-cell {
    color: #94a3b8;
    font-size: 0.9rem;
    max-width: 300px;
}

.link-url {
    color: #3b82f6;
    text-decoration: none;
    font-size: 0.85rem;
}

.link-url:hover {
    text-decoration: underline;
}

.btn-primary {
    background: linear-gradient(135deg, #10b981, #059669);
    border: none;
    padding: 10px 20px;
    border-radius: 8px;
    color: #fff;
    cursor: pointer;
    font-weight: 600;
    transition: 0.2s;
}

.btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
}

.action-group {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
}

.btn-icon {
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: 0.2s;
}

.edit {
    background: rgba(59, 130, 246, 0.1);
    color: #3b82f6;
}

.edit:hover {
    background: #3b82f6;
    color: #fff;
}

.delete {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
}

.delete:hover {
    background: #ef4444;
    color: #fff;
}

/* Modal Inputs */
.modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(5px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
}

.modal-card {
    background: #1e293b;
    width: 450px;
    padding: 30px;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
}

.modal-card h3 {
    margin: 0 0 20px 0;
    color: #fff;
}

.form-item {
    margin-bottom: 15px;
}

.form-item label {
    display: block;
    margin-bottom: 5px;
    color: #94a3b8;
    font-size: 0.9rem;
}

.form-item input,
.form-item textarea {
    width: 100%;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 10px;
    border-radius: 6px;
    color: #fff;
    outline: none;
}

.form-item input:focus,
.form-item textarea:focus {
    border-color: #3b82f6;
}

.modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 25px;
}

.btn-cancel {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: #ccc;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
}

.btn-confirm {
    background: #3b82f6;
    border: none;
    color: #fff;
    padding: 8px 20px;
    border-radius: 6px;
    cursor: pointer;
}
</style>