<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router' // 引入 useRoute
import { api } from '@/utils/api'
import { message } from '@/utils/message'

const router = useRouter()
const route = useRoute() // 🔥 获取路由参数

// =========================
// 1. 数据定义
// =========================

const form = reactive({
    title: '',
    summary: '',
    content: '',
    category: 'Veritas',
    cover_image: ''
})

const categories = [
    'Veritas', '生活倒影', '视听盛宴', '学习人生',
    '海外趣事', '爱心资源', '技术分享', '心情随笔'
]

const isUploading = ref(false)
const isSubmitting = ref(false)
const fileInput = ref(null)

// 🔥 核心：判断当前模式
const isEditMode = computed(() => !!route.query.id)
const pageTitle = computed(() => isEditMode.value ? '✍️ 编辑文章' : '📝 发布新文章')

// =========================
// 2. 核心逻辑
// =========================

// 触发文件选择
const triggerUpload = () => { fileInput.value.click() }

// 处理上传
const handleFileUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) return message.warning('图片大小不能超过 5MB')

    isUploading.value = true
    const formData = new FormData()
    formData.append('image', file)

    try {
        const res = await api.post('/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        })
        if (res.data.success) {
            form.cover_image = res.data.data.url
            message.success('✅ 封面上传成功！')
        }
    } catch (error) {
        console.error(error)
        message.error('❌ 图片上传失败')
    } finally {
        isUploading.value = false
        event.target.value = ''
    }
}

// 🔥 获取文章详情 (编辑模式专用)
const fetchArticleDetails = async (id) => {
    try {
        const res = await api.get(`/articles/${id}`)
        if (res.data.success) {
            const data = res.data.data
            // 回填表单
            form.title = data.title
            form.summary = data.summary
            form.content = data.content
            form.category = data.category
            form.cover_image = data.cover_image
            message.success('已加载文章数据')
        }
    } catch (error) {
        console.error(error)
        message.error('加载文章详情失败')
        router.push('/admin/articles') // 失败退回列表
    }
}

// 提交文章 (自动判断 新增 还是 更新)
const submitArticle = async () => {
    if (!form.title.trim()) return message.warning('标题不能为空')
    if (!form.content.trim()) return message.warning('正文内容不能为空')
    if (!form.category) return message.warning('请选择文章分类')

    isSubmitting.value = true

    try {
        let res;
        if (isEditMode.value) {
            // 🔥 编辑模式：调用 PUT 接口
            res = await api.put(`/articles/${route.query.id}`, form)
        } else {
            // 🔥 新增模式：调用 POST 接口
            res = await api.post('/articles', form)
        }

        if (res.data.success) {
            message.success(isEditMode.value ? '🎉 文章更新成功！' : '🎉 文章发布成功！')
            // 成功后跳转回列表页，或者去详情页
            router.push('/admin/articles')
        }
    } catch (error) {
        console.error(error)
        message.error('操作失败: ' + (error.response?.data?.message || '服务器错误'))
    } finally {
        isSubmitting.value = false
    }
}

// 辅助：图片预览
const getPreviewUrl = (path) => {
    if (!path) return ''
    if (path.startsWith('http') || path.startsWith('data:')) return path
    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
    const host = apiBase.replace(/\/api\/?$/, '')
    const cleanPath = path.startsWith('/') ? path : '/' + path
    return `${host}${cleanPath}`
}

// 🔥 初始化：如果是编辑模式，加载数据
onMounted(() => {
    if (isEditMode.value) {
        fetchArticleDetails(route.query.id)
    }
})
</script>

<template>
    <div class="publish-page">
        <div class="page-header">
            <div class="header-left">
                <h2>{{ pageTitle }}</h2>
                <span class="sub-text">
                    {{ isEditMode ? '正在修改已发布的文章内容' : '分享你的知识与见解' }}
                </span>
            </div>
            <div class="header-actions">
                <button class="btn-draft" @click="router.back()">取消</button>
                <button class="btn-publish" @click="submitArticle" :disabled="isSubmitting">
                    <span v-if="isSubmitting">提交中...</span>
                    <span v-else>{{ isEditMode ? '💾 保存修改' : '🚀 发布文章' }}</span>
                </button>
            </div>
        </div>

        <div class="editor-layout">
            <div class="main-column">
                <div class="input-group title-group">
                    <input v-model="form.title" type="text" class="title-input" placeholder="请输入文章标题...">
                </div>

                <div class="markdown-editor-container">
                    <div class="toolbar">
                        <span title="加粗"><b>B</b></span>
                        <span title="斜体"><i>I</i></span>
                        <span title="链接">🔗</span>
                        <span title="图片">🖼️</span>
                        <span title="代码块">&lt;/&gt;</span>
                        <span class="toolbar-spacer"></span>
                        <span class="mode-switch">Markdown</span>
                    </div>
                    <textarea v-model="form.content" class="content-textarea" placeholder="开始你的创作... (支持 Markdown 语法)"
                        spellcheck="false"></textarea>
                </div>
            </div>

            <aside class="settings-column">
                <div class="setting-card">
                    <h3>📂 分类专栏</h3>
                    <div class="category-list">
                        <label v-for="cat in categories" :key="cat" class="radio-label"
                            :class="{ active: form.category === cat }">
                            <input type="radio" v-model="form.category" :value="cat" hidden>
                            {{ cat }}
                        </label>
                    </div>
                </div>

                <div class="setting-card">
                    <h3>🖼️ 文章封面</h3>
                    <div class="cover-upload-area" @click="triggerUpload" :class="{ 'has-image': form.cover_image }">
                        <input ref="fileInput" type="file" @change="handleFileUpload" accept="image/*" hidden>
                        <div v-if="form.cover_image" class="cover-preview">
                            <img :src="getPreviewUrl(form.cover_image)" alt="封面">
                            <div class="overlay"><span class="icon">🔄</span> 点击更换</div>
                        </div>
                        <div v-else class="upload-placeholder">
                            <div class="icon-box">☁️</div>
                            <span>点击上传封面</span>
                            <span class="tip">支持 JPG, PNG (Max 5MB)</span>
                        </div>
                        <div v-if="isUploading" class="uploading-mask">上传中...</div>
                    </div>
                </div>

                <div class="setting-card">
                    <h3>📝 摘要简介</h3>
                    <textarea v-model="form.summary" rows="5" class="summary-input"
                        placeholder="写一段简短的介绍..."></textarea>
                </div>
            </aside>
        </div>
    </div>
</template>

<style scoped>
/* ================= 全局深色模式适配 ================= */
.publish-page {
    max-width: 1400px;
    margin: 0 auto;
    animation: fadeIn 0.5s ease;
    color: #e0e0e0;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(10px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 25px;
}

.header-left h2 {
    margin: 0;
    color: #fff;
    /* 亮白标题 */
    font-weight: 700;
    font-size: 1.5rem;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.sub-text {
    font-size: 0.9rem;
    color: #94a3b8;
    /* 灰蓝 */
    margin-top: 5px;
    display: block;
}

.header-actions {
    display: flex;
    gap: 12px;
}

/* ================= 按钮样式 (霓虹感) ================= */
.btn-publish {
    padding: 10px 24px;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 0.3s;
    background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
    /* 紫色渐变 */
    color: white;
    box-shadow: 0 4px 15px rgba(139, 92, 246, 0.4);
    /* 紫色光晕 */
}

.btn-publish:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(139, 92, 246, 0.6);
}

.btn-publish:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
}

.btn-draft {
    padding: 10px 24px;
    border-radius: 8px;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.05);
    color: #ccc;
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: 0.3s;
}

.btn-draft:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    border-color: rgba(255, 255, 255, 0.3);
}

/* ================= 编辑区域网格 ================= */
.editor-layout {
    display: grid;
    grid-template-columns: 1fr 320px;
    gap: 25px;
}

/* 左侧：主编辑器 (深色玻璃) */
.main-column {
    background: rgba(30, 41, 59, 0.4);
    border-radius: 16px;
    padding: 30px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(10px);
    display: flex;
    flex-direction: column;
    min-height: 80vh;
}

.title-input {
    width: 100%;
    font-size: 28px;
    font-weight: 800;
    border: none;
    background: transparent;
    outline: none;
    padding: 10px 0;
    margin-bottom: 20px;
    color: #fff;
    /* 亮白 */
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    transition: border-color 0.3s;
}

.title-input::placeholder {
    color: #475569;
    font-weight: 600;
}

.title-input:focus {
    border-bottom-color: #8b5cf6;
}

/* 聚焦变紫 */

.markdown-editor-container {
    flex: 1;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    transition: border-color 0.3s;
    background: rgba(0, 0, 0, 0.2);
    /* 编辑器内部更深 */
}

.markdown-editor-container:focus-within {
    border-color: #8b5cf6;
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2);
}

.toolbar {
    padding: 12px 15px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.03);
    border-radius: 8px 8px 0 0;
    display: flex;
    gap: 15px;
    color: #94a3b8;
    user-select: none;
}

.toolbar span {
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    transition: background 0.2s;
    font-size: 0.9rem;
}

.toolbar span:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
}

.toolbar-spacer {
    flex: 1;
}

.mode-switch {
    font-size: 0.8rem !important;
    color: #64748b;
    font-family: monospace;
}

.content-textarea {
    flex: 1;
    width: 100%;
    border: none;
    padding: 20px;
    font-size: 16px;
    line-height: 1.7;
    outline: none;
    resize: none;
    font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
    background: transparent;
    /* 透明背景 */
    color: #e2e8f0;
    /* 灰白文字 */
}

/* 右侧：设置侧边栏 */
.settings-column {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.setting-card {
    background: rgba(30, 41, 59, 0.4);
    border-radius: 16px;
    padding: 20px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(10px);
}

.setting-card h3 {
    margin: 0 0 15px 0;
    font-size: 15px;
    color: #fff;
    font-weight: 700;
    border-left: 3px solid #8b5cf6;
    /* 紫色竖条 */
    padding-left: 10px;
}

/* 分类标签 */
.category-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.radio-label {
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 20px;
    font-size: 13px;
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid transparent;
}

.radio-label:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
}

.radio-label.active {
    background: rgba(139, 92, 246, 0.2);
    color: #a78bfa;
    border-color: #8b5cf6;
    font-weight: 600;
    box-shadow: 0 0 10px rgba(139, 92, 246, 0.2);
}

/* 封面上传区 */
.cover-upload-area {
    width: 100%;
    height: 160px;
    border: 2px dashed rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
    position: relative;
    transition: all 0.3s;
    background: rgba(0, 0, 0, 0.2);
}

.cover-upload-area:hover {
    border-color: #8b5cf6;
    background: rgba(139, 92, 246, 0.05);
}

.upload-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: #64748b;
}

.icon-box {
    font-size: 32px;
    margin-bottom: 5px;
    opacity: 0.7;
}

.tip {
    font-size: 12px;
    color: #475569;
}

.cover-preview {
    width: 100%;
    height: 100%;
    position: relative;
}

.cover-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.cover-preview .overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    color: white;
    display: flex;
    justify-content: center;
    align-items: center;
    opacity: 0;
    transition: opacity 0.3s;
    font-weight: bold;
}

.cover-preview:hover .overlay {
    opacity: 1;
}

.uploading-mask {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    color: #8b5cf6;
}

/* 摘要输入 */
.summary-input {
    width: 100%;
    padding: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    font-size: 14px;
    line-height: 1.5;
    outline: none;
    resize: none;
    transition: all 0.3s;
    background: rgba(0, 0, 0, 0.2);
    color: #e2e8f0;
    box-sizing: border-box;
}

.summary-input:focus {
    border-color: #8b5cf6;
    background: rgba(0, 0, 0, 0.4);
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.1);
}

@media (max-width: 1024px) {
    .editor-layout {
        grid-template-columns: 1fr;
    }
}
</style>