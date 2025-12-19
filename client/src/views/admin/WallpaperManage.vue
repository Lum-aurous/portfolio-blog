<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { api } from '@/utils/api'
import { message } from '@/utils/message'

// ==================== 全局壁纸管理 ====================
const globalWallpaper = ref({
    mode: 'random',
    websiteUrl: '',
    dailyUrl: '',
    randomUrls: []
})

const isLoadingGlobal = ref(false)
const isSavingGlobal = ref(false)

// 新增壁纸URL输入框
const newWallpaperUrl = ref('')

// 🔥 文件上传相关
const isUploading = ref(false)
const uploadProgress = ref(0)
const fileInputRef = ref(null)

// 🔥 新增：全屏预览相关
const previewVisible = ref(false)
const previewImageUrl = ref('')

// 打开全屏预览
const openPreview = (url) => {
    previewImageUrl.value = url
    previewVisible.value = true
    document.body.style.overflow = 'hidden' // 防止背景滚动
}

// 关闭全屏预览
const closePreview = () => {
    previewVisible.value = false
    document.body.style.overflow = 'auto'
}

// ESC键关闭预览
const handleKeydown = (e) => {
    if (e.key === 'Escape' && previewVisible.value) {
        closePreview()
    }
}

// 🔥 新增：复制图片链接
const copyImageUrl = async () => {
    try {
        await navigator.clipboard.writeText(previewImageUrl.value)
        message.success('链接已复制到剪贴板')
    } catch (error) {
        // 备用方法
        const textArea = document.createElement('textarea')
        textArea.value = previewImageUrl.value
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
        message.success('链接已复制到剪贴板')
    }
}

// 获取全局壁纸配置
const fetchGlobalWallpaper = async () => {
    isLoadingGlobal.value = true
    try {
        const res = await api.get('/wallpaper/global')
        if (res.data.success) {
            const data = res.data.data
            globalWallpaper.value = {
                mode: data.mode || 'random',
                websiteUrl: data.websiteUrl || '',
                dailyUrl: data.dailyUrl || '',
                randomUrls: Array.isArray(data.randomUrls) ? data.randomUrls : []
            }
        }
    } catch (error) {
        message.error('加载全局壁纸失败')
    } finally {
        isLoadingGlobal.value = false
    }
}

// 添加URL壁纸
const addWallpaper = () => {
    const url = newWallpaperUrl.value.trim()
    if (!url) return message.warning('请输入壁纸URL')

    if (!url.startsWith('http')) {
        return message.error('请输入有效的图片URL (http/https)')
    }

    if (globalWallpaper.value.randomUrls.includes(url)) {
        return message.warning('该壁纸已存在')
    }

    globalWallpaper.value.randomUrls.push(url)
    newWallpaperUrl.value = ''
    message.success('添加成功，记得保存配置')
}

// 🔥 新增：触发文件选择
const triggerFileUpload = () => {
    fileInputRef.value?.click()
}

// 🔥 新增：处理文件上传（支持批量）
const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files)
    if (files.length === 0) return

    // 验证文件类型
    const validFiles = files.filter(file => {
        const isImage = file.type.startsWith('image/')
        if (!isImage) {
            message.warning(`${file.name} 不是图片文件，已跳过`)
        }
        return isImage
    })

    if (validFiles.length === 0) {
        return message.error('没有有效的图片文件')
    }

    // 验证文件大小（每张最大10MB）
    const oversized = validFiles.filter(file => file.size > 10 * 1024 * 1024)
    if (oversized.length > 0) {
        return message.error(`有 ${oversized.length} 张图片超过10MB，请压缩后上传`)
    }

    isUploading.value = true
    uploadProgress.value = 0

    // 在 handleFileUpload 函数中修改：
    const successUrls = []
    const failedFiles = []

    for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i]

        try {
            // 创建 FormData
            const formData = new FormData()
            formData.append('image', file)

            // 上传到服务器
            const res = await api.post('/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round(
                        ((i + progressEvent.loaded / progressEvent.total) / validFiles.length) * 100
                    )
                    uploadProgress.value = percentCompleted
                }
            })

            if (res.data.success) {
                // 🔥 核心修复：直接使用后端返回的路径，不拼接baseURL
                // 因为Vite代理已经处理了路径转发
                const fullUrl = res.data.data.url
                successUrls.push(fullUrl)

                console.log(`✅ 上传成功: ${file.name}`);
                console.log(`  返回URL: ${fullUrl}`);
            } else {
                failedFiles.push(file.name)
            }
        } catch (error) {
            console.error(`上传 ${file.name} 失败:`, error)
            failedFiles.push(file.name)
        }
    }

    isUploading.value = false
    uploadProgress.value = 0

    // 添加到列表
    if (successUrls.length > 0) {
        globalWallpaper.value.randomUrls.push(...successUrls)
        message.success(`成功上传 ${successUrls.length} 张壁纸！记得保存配置`)
    }

    if (failedFiles.length > 0) {
        message.error(`${failedFiles.length} 张上传失败: ${failedFiles.join(', ')}`)
    }

    // 清空文件输入
    event.target.value = ''
}

// 删除壁纸
const removeWallpaper = (index) => {
    if (confirm('确定删除这张壁纸吗？')) {
        globalWallpaper.value.randomUrls.splice(index, 1)
        message.success('删除成功，记得保存配置')
    }
}

// 🔥 新增：拖拽排序相关
let draggedIndex = null

const handleDragStart = (index) => {
    draggedIndex = index
}

const handleDragOver = (event) => {
    event.preventDefault()
}

const handleDrop = (index) => {
    if (draggedIndex === null || draggedIndex === index) return

    const urls = [...globalWallpaper.value.randomUrls]
    const [removed] = urls.splice(draggedIndex, 1)
    urls.splice(index, 0, removed)

    globalWallpaper.value.randomUrls = urls
    draggedIndex = null

    message.info('顺序已调整，记得保存配置')
}

// 🔥 新增：上传固定壁纸/每日壁纸
const uploadSingleWallpaper = async (type) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'

    input.onchange = async (e) => {
        const file = e.target.files[0]
        if (!file) return

        if (file.size > 10 * 1024 * 1024) {
            return message.error('图片大小不能超过10MB')
        }

        isUploading.value = true

        try {
            const formData = new FormData()
            formData.append('image', file)

            const res = await api.post('/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })

            if (res.data.success) {
                // 🔥 直接使用后端返回的URL，不拼接baseURL
                const fullUrl = res.data.data.url

                if (type === 'website') {
                    globalWallpaper.value.websiteUrl = fullUrl
                } else if (type === 'daily') {
                    globalWallpaper.value.dailyUrl = fullUrl
                }

                console.log(`✅ ${type}壁纸上传成功:`, fullUrl);
                message.success('上传成功！记得保存配置')
            }
        } catch (error) {
            message.error('上传失败: ' + (error.response?.data?.message || error.message))
        } finally {
            isUploading.value = false
        }
    }

    input.click()
}

// 保存全局壁纸配置
const saveGlobalWallpaper = async () => {
    isSavingGlobal.value = true
    try {
        const res = await api.put('/admin/wallpaper/global', globalWallpaper.value)
        if (res.data.success) {
            message.success('保存成功！前台壁纸已更新')
            fetchGlobalWallpaper()
        }
    } catch (error) {
        message.error('保存失败: ' + (error.response?.data?.message || error.message))
    } finally {
        isSavingGlobal.value = false
    }
}

// 手动触发洗牌
const shuffleWallpapers = async () => {
    if (!confirm('确定要洗牌壁纸顺序吗？这会立即刷新前台显示')) return

    try {
        const res = await api.post('/wallpaper/shuffle')
        if (res.data.success) {
            message.success('洗牌成功！前台壁纸顺序已更新')
            fetchGlobalWallpaper()
        }
    } catch (error) {
        message.error('洗牌失败')
    }
}

// 🔥 新增：一键清空所有壁纸
const clearAllWallpapers = () => {
    if (!confirm('⚠️ 确定清空所有轮播壁纸吗？此操作不可恢复！')) return
    globalWallpaper.value.randomUrls = []
    message.warning('已清空，记得保存配置')
}

// ==================== 用户壁纸管理 ====================
const userWallpapers = ref([])
const isLoadingUsers = ref(false)
const currentPage = ref(1)
const pageSize = 20

const fetchUserWallpapers = async () => {
    isLoadingUsers.value = true
    try {
        const res = await api.get('/admin/wallpapers/users', {
            params: { page: currentPage.value, limit: pageSize }
        })
        if (res.data.success) {
            userWallpapers.value = res.data.data.list || []
        }
    } catch (error) {
        message.error('加载用户壁纸失败')
    } finally {
        isLoadingUsers.value = false
    }
}

const deleteUserWallpaper = async (userId, username) => {
    if (!confirm(`确定删除用户 ${username} 的自定义壁纸吗？`)) return

    try {
        const res = await api.delete(`/admin/wallpapers/users/${userId}`)
        if (res.data.success) {
            message.success('删除成功')
            fetchUserWallpapers()
        }
    } catch (error) {
        message.error('删除失败')
    }
}

const activeTab = ref('global')

onMounted(() => {
    fetchGlobalWallpaper()
    fetchUserWallpapers()
    // 监听ESC键
    window.addEventListener('keydown', handleKeydown)

    // 🔥 添加调试日志
    console.log('环境变量:');
    console.log('VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL);
    console.log('当前环境:', import.meta.env.MODE);
    console.log('后端地址:', import.meta.env.VITE_API_TARGET);
})

// 组件卸载时移除事件监听
onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
})

// 日期格式化
const formatDate = (dateStr) => {
    if (!dateStr) return '未知'
    const date = new Date(dateStr)
    return date.toLocaleDateString('zh-CN') + ' ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
    <div class="wallpaper-manage-page">
        <!-- 全屏预览遮罩层 -->
        <div v-if="previewVisible" class="preview-overlay" @click.self="closePreview">
            <div class="preview-container">
                <img :src="previewImageUrl" alt="预览" class="preview-image" />
                <button class="preview-close" @click="closePreview">✕</button>
                <div class="preview-toolbar">
                    <a :href="previewImageUrl" target="_blank" class="preview-download">🔍 查看原图</a>
                    <button class="preview-copy" @click="copyImageUrl">
                        📋 复制链接
                    </button>
                </div>
            </div>
        </div>

        <!-- 标题 -->
        <div class="page-header animate__animated animate__fadeInDown">
            <h2>🖼️ 壁纸管理中心</h2>
            <p class="sub-text">上传、管理全站背景壁纸与用户自定义壁纸</p>
        </div>

        <!-- 标签切换 -->
        <div class="tabs animate__animated animate__fadeIn">
            <div class="tab-item" :class="{ active: activeTab === 'global' }" @click="activeTab = 'global'">
                🌐 全局壁纸
            </div>
            <div class="tab-item" :class="{ active: activeTab === 'users' }" @click="activeTab = 'users'">
                👤 用户壁纸
            </div>
        </div>

        <!-- 上传进度条 -->
        <div v-if="isUploading" class="upload-progress animate__animated animate__fadeIn">
            <div class="progress-bar">
                <div class="progress-fill" :style="{ width: uploadProgress + '%' }"></div>
            </div>
            <div class="progress-text">上传中... {{ uploadProgress }}%</div>
        </div>

        <!-- ==================== 全局壁纸管理 ==================== -->
        <div v-show="activeTab === 'global'" class="tab-content animate__animated animate__fadeIn">

            <!-- 模式选择 -->
            <div class="glass-panel mb-16">
                <h3 class="panel-title">壁纸模式</h3>
                <div class="mode-selector">
                    <label class="mode-option">
                        <input type="radio" value="website" v-model="globalWallpaper.mode">
                        <span class="mode-label">
                            <span class="mode-icon">🏠</span>
                            <span class="mode-name">网站背景</span>
                            <span class="mode-desc">使用单张固定图片</span>
                        </span>
                    </label>

                    <label class="mode-option">
                        <input type="radio" value="daily" v-model="globalWallpaper.mode">
                        <span class="mode-label">
                            <span class="mode-icon">📅</span>
                            <span class="mode-name">每日壁纸</span>
                            <span class="mode-desc">每天自动更换</span>
                        </span>
                    </label>

                    <label class="mode-option">
                        <input type="radio" value="random" v-model="globalWallpaper.mode">
                        <span class="mode-label">
                            <span class="mode-icon">🎲</span>
                            <span class="mode-name">随机轮播</span>
                            <span class="mode-desc">从列表随机切换</span>
                        </span>
                    </label>
                </div>
            </div>

            <!-- 固定壁纸 -->
            <div v-if="globalWallpaper.mode === 'website'" class="glass-panel mb-16">
                <div class="panel-header">
                    <h3 class="panel-title">
                        网站背景
                    </h3>
                    <button class="btn-upload-single" @click="uploadSingleWallpaper('website')">
                        📤 上传图片
                    </button>
                </div>
                <input type="text" class="glass-input" v-model="globalWallpaper.websiteUrl"
                    placeholder="https://example.com/wallpaper.jpg 或点击上传按钮">
                <div class="preview-box" v-if="globalWallpaper.websiteUrl">
                    <img :src="globalWallpaper.websiteUrl" alt="preview"
                        @click="openPreview(globalWallpaper.websiteUrl)">
                    <div class="preview-hint">点击图片预览</div>
                </div>
            </div>

            <!-- 每日壁纸 -->
            <div v-if="globalWallpaper.mode === 'daily'" class="glass-panel mb-16">
                <div class="panel-header">
                    <h3 class="panel-title">
                        每日壁纸
                    </h3>
                    <button class="btn-upload-single" @click="uploadSingleWallpaper('daily')">
                        📤 上传图片
                    </button>
                </div>
                <input type="text" class="glass-input" v-model="globalWallpaper.dailyUrl" placeholder="API地址或直接上传图片">
                <div class="preview-box" v-if="globalWallpaper.dailyUrl">
                    <img :src="globalWallpaper.dailyUrl" alt="preview" @click="openPreview(globalWallpaper.dailyUrl)">
                    <div class="preview-hint">点击图片预览</div>
                </div>
            </div>

            <!-- 随机轮播列表 -->
            <div v-if="globalWallpaper.mode === 'random'" class="glass-panel mb-16">
                <div class="panel-header">
                    <h3 class="panel-title">
                        轮播列表 (共 {{ globalWallpaper.randomUrls.length }} 张)
                    </h3>
                    <div class="title-actions">
                        <button class="btn-shuffle" @click="shuffleWallpapers">🔀 洗牌</button>
                        <button class="btn-clear" @click="clearAllWallpapers">🗑️ 清空</button>
                    </div>
                </div>

                <!-- 上传按钮区 -->
                <div class="upload-zone">
                    <button class="btn-batch-upload" @click="triggerFileUpload">
                        📤 批量上传图片
                    </button>
                    <div class="upload-hint">支持一次选择多张图片，每张最大10MB</div>
                    <input ref="fileInputRef" type="file" multiple accept="image/*" style="display: none"
                        @change="handleFileUpload">
                </div>

                <!-- 添加URL -->
                <div class="add-wallpaper-row">
                    <input type="text" class="glass-input flex-1" v-model="newWallpaperUrl" placeholder="或输入壁纸 URL"
                        @keyup.enter="addWallpaper">
                    <button class="btn-add" @click="addWallpaper">➕ 添加</button>
                </div>

                <!-- 壁纸网格（支持拖拽排序） -->
                <div class="wallpaper-grid">
                    <div v-for="(url, index) in globalWallpaper.randomUrls" :key="index" class="wallpaper-card"
                        draggable="true" @dragstart="handleDragStart(index)" @dragover="handleDragOver"
                        @drop="handleDrop(index)">
                        <!-- 图片预览区域 -->
                        <div class="image-preview-area" @click="openPreview(url)">
                            <img :src="url" alt="wallpaper" loading="lazy">
                            <div class="preview-overlay-hint">
                                <span class="preview-hint-text">🔍 点击预览</span>
                            </div>
                        </div>

                        <!-- 控制区域（序号和删除按钮） -->
                        <div class="card-controls">
                            <span class="card-index">
                                <span class="drag-icon">⋮⋮</span>
                                #{{ index + 1 }}
                            </span>
                            <button class="btn-delete" @click="removeWallpaper(index)">🗑️</button>
                        </div>
                    </div>
                </div>

                <div v-if="globalWallpaper.randomUrls.length === 0" class="empty-hint">
                    暂无壁纸，点击上方按钮上传或添加 URL
                </div>
            </div>

            <!-- 保存按钮 -->
            <div class="action-bar">
                <button class="btn-save" @click="saveGlobalWallpaper" :disabled="isSavingGlobal">
                    {{ isSavingGlobal ? '保存中...' : '💾 保存配置' }}
                </button>
            </div>
        </div>

        <!-- ==================== 用户壁纸管理 ==================== -->
        <div v-show="activeTab === 'users'" class="tab-content animate__animated animate__fadeIn">
            <div class="glass-panel">
                <h3 class="panel-title">用户自定义壁纸 ({{ userWallpapers.length }} 个)</h3>

                <div v-if="isLoadingUsers" class="loading-state">加载中...</div>

                <div v-else-if="userWallpapers.length === 0" class="empty-state">
                    暂无用户上传壁纸
                </div>

                <div v-else class="user-wallpaper-list">
                    <div v-for="item in userWallpapers" :key="item.user_id" class="user-wallpaper-item">
                        <div class="user-info">
                            <img :src="item.avatar || 'https://i.pravatar.cc/150'" class="user-avatar" alt="avatar">
                            <div class="user-details">
                                <div class="user-name">{{ item.nickname || item.username }}</div>
                                <div class="user-meta">ID: {{ item.user_id }} · 上传于 {{ formatDate(item.updated_at) }}
                                </div>
                            </div>
                        </div>

                        <div class="wallpaper-preview" @click="openPreview(item.wallpaper_url)">
                            <img :src="item.wallpaper_url" alt="user wallpaper">
                            <div class="preview-overlay-small">
                                <span class="preview-text">🔍 预览</span>
                            </div>
                        </div>

                        <button class="btn-delete-user" @click="deleteUserWallpaper(item.user_id, item.username)">
                            🗑️ 删除
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.wallpaper-manage-page {
    max-width: 1400px;
    margin: 0 auto;
    position: relative;
    padding: 0 20px 20px 20px;
}

.page-header {
    margin: 0 0 25px 0;
}

.page-header h2 {
    font-size: 1.6rem;
    margin: 0 0 6px 0;
    color: #fff;
    font-weight: 600;
}

.sub-text {
    color: #94a3b8;
    margin: 0;
    font-size: 0.9rem;
}

/* ==================== 全屏预览样式 ==================== */
.preview-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.95);
    backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    animation: fadeIn 0.3s ease;
}

.preview-container {
    position: relative;
    max-width: 95vw;
    max-height: 95vh;
    display: flex;
    flex-direction: column;
    align-items: center;
}

.preview-image {
    max-width: 100%;
    max-height: 85vh;
    object-fit: contain;
    border-radius: 6px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    animation: zoomIn 0.3s ease;
}

.preview-close {
    position: absolute;
    top: -45px;
    right: 0;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: white;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    font-size: 1rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s;
    backdrop-filter: blur(5px);
}

.preview-close:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: scale(1.1);
}

.preview-toolbar {
    margin-top: 16px;
    display: flex;
    gap: 12px;
}

.preview-download,
.preview-copy {
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    color: white;
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.3s;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 5px;
}

.preview-download:hover,
.preview-copy:hover {
    background: rgba(102, 126, 234, 0.5);
    border-color: #667eea;
    transform: translateY(-1px);
}

@keyframes fadeIn {
    from {
        opacity: 0;
    }

    to {
        opacity: 1;
    }
}

@keyframes zoomIn {
    from {
        opacity: 0;
        transform: scale(0.95);
    }

    to {
        opacity: 1;
        transform: scale(1);
    }
}

/* ==================== 图片预览提示 ==================== */
.preview-hint {
    text-align: center;
    margin-top: 8px;
    color: #94a3b8;
    font-size: 0.8rem;
    opacity: 0.7;
}

.preview-hint:hover {
    opacity: 1;
}

/* 上传进度条 */
.upload-progress {
    background: rgba(30, 41, 59, 0.6);
    backdrop-filter: blur(10px);
    border-radius: 10px;
    padding: 12px 16px;
    margin-bottom: 16px;
    border: 1px solid rgba(102, 126, 234, 0.3);
}

.progress-bar {
    width: 100%;
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 6px;
}

.progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #667eea, #764ba2);
    transition: width 0.3s;
    border-radius: 3px;
}

.progress-text {
    text-align: center;
    color: #94a3b8;
    font-size: 0.85rem;
}

/* 标签切换 */
.tabs {
    display: flex;
    gap: 12px;
    margin-bottom: 20px;
}

.tab-item {
    padding: 10px 20px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.3s;
    font-weight: 600;
    font-size: 0.95rem;
    border: 2px solid transparent;
}

.tab-item:hover {
    background: rgba(255, 255, 255, 0.1);
}

.tab-item.active {
    background: linear-gradient(135deg, #667eea, #764ba2);
    border-color: rgba(255, 255, 255, 0.2);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.glass-panel {
    background: rgba(30, 41, 59, 0.4);
    backdrop-filter: blur(10px);
    border-radius: 14px;
    padding: 20px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

.mb-16 {
    margin-bottom: 16px;
}

.panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
}

.panel-title {
    font-size: 1.1rem;
    margin: 0;
    color: #fff;
    font-weight: 600;
}

.title-actions {
    display: flex;
    gap: 8px;
}

.mode-selector {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
    margin-top: 20px;
}

.mode-option {
    display: block;
    cursor: pointer;
}

.mode-option input[type="radio"] {
    display: none;
}

.mode-label {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    transition: all 0.3s;
    text-align: center;
}

.mode-option input:checked+.mode-label {
    background: rgba(102, 126, 234, 0.15);
    border-color: #667eea;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.25);
}

.mode-icon {
    font-size: 1.6rem;
    margin-bottom: 8px;
}

.mode-name {
    font-weight: 600;
    margin-bottom: 4px;
    font-size: 0.95rem;
}

.mode-desc {
    font-size: 0.8rem;
    color: #94a3b8;
}

.glass-input {
    width: 100%;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: #fff;
    font-size: 0.9rem;
    transition: all 0.3s;
    margin-bottom: 12px;
    box-sizing: border-box;
    /* 添加这一行 */
}

.glass-input:focus {
    outline: none;
    border-color: #667eea;
    background: rgba(255, 255, 255, 0.08);
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.preview-box {
    margin-top: 12px;
    border-radius: 10px;
    overflow: hidden;
    max-height: 320px;
    position: relative;
}

.preview-box img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    cursor: pointer;
    transition: transform 0.3s;
    background: rgba(0, 0, 0, 0.1);
    max-height: 280px;
}

.preview-box img:hover {
    transform: scale(1.02);
}

/* 上传区域 */
.upload-zone {
    background: rgba(102, 126, 234, 0.08);
    border: 2px dashed rgba(102, 126, 234, 0.4);
    border-radius: 10px;
    padding: 20px;
    text-align: center;
    margin-bottom: 16px;
    transition: all 0.3s;
}

.upload-zone:hover {
    background: rgba(102, 126, 234, 0.12);
    border-color: #667eea;
}

.btn-batch-upload {
    padding: 12px 32px;
    background: linear-gradient(135deg, #667eea, #764ba2);
    border: none;
    border-radius: 10px;
    color: #fff;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.btn-batch-upload:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
}

.upload-hint {
    margin-top: 8px;
    color: #94a3b8;
    font-size: 0.8rem;
}

.btn-upload-single {
    padding: 6px 12px;
    background: linear-gradient(135deg, #10b981, #059669);
    border: none;
    border-radius: 8px;
    color: #fff;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s;
}

.btn-upload-single:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 10px rgba(16, 185, 129, 0.3);
}

.add-wallpaper-row {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
    align-items: stretch;
    /* 确保子元素拉伸到相同高度 */
}

.flex-1 {
    flex: 1;
}

.btn-add {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 7px 20px;
    /* 修改为与输入框相同的上下padding */
    border: 1px solid transparent;
    /* 添加透明边框以保持与输入框相同的高度计算 */
    border-radius: 8px;
    background: linear-gradient(135deg, #10b981, #059669);
    color: #fff;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s;
    font-size: 0.9rem;
    box-sizing: border-box;
    height: 100%;
    /* 确保按钮高度与父容器一致 */
    line-height: normal;
}

.btn-add:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.3);
    /* 悬停时显示边框 */
}

.btn-shuffle,
.btn-clear {
    padding: 6px 12px;
    border: none;
    border-radius: 6px;
    color: #fff;
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.3s;
}

.btn-shuffle {
    background: rgba(249, 115, 22, 0.15);
    border: 1px solid rgba(249, 115, 22, 0.3);
    color: #f97316;
}

.btn-shuffle:hover {
    background: #f97316;
    color: #fff;
}

.btn-clear {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
}

.btn-clear:hover {
    background: #ef4444;
    color: #fff;
}

/* ==================== 轮播壁纸网格布局 ==================== */
.wallpaper-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 16px;
    margin-top: 16px;
}

.wallpaper-card {
    position: relative;
    border-radius: 10px;
    height: 160px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.08);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: grab;
    display: flex;
    flex-direction: column;
}

.wallpaper-card:active {
    cursor: grabbing;
    transform: scale(0.98);
}

/* 图片预览区域 */
.image-preview-area {
    flex: 1;
    position: relative;
    overflow: hidden;
    cursor: pointer;
    background: rgba(0, 0, 0, 0.1);
}

.image-preview-area img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    transition: transform 0.5s ease;
}

.image-preview-area:hover img {
    transform: scale(1.05);
}

.preview-overlay-hint {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.3s;
}

.image-preview-area:hover .preview-overlay-hint {
    opacity: 1;
}

.preview-hint-text {
    color: white;
    font-size: 0.8rem;
    background: rgba(0, 0, 0, 0.7);
    padding: 4px 10px;
    border-radius: 16px;
    backdrop-filter: blur(5px);
}

/* 控制区域（序号和删除按钮） */
.card-controls {
    height: 32px;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.6) 0%, transparent 100%);
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.card-index {
    background: rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(4px);
    padding: 2px 6px;
    border-radius: 6px;
    font-size: 0.75rem;
    font-family: monospace;
    display: flex;
    align-items: center;
    gap: 4px;
    color: rgba(255, 255, 255, 0.9);
}

.drag-icon {
    font-size: 0.9rem;
    opacity: 0.7;
}

.btn-delete {
    background: rgba(239, 68, 68, 0.8);
    border: none;
    width: 26px;
    height: 26px;
    border-radius: 6px;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    font-size: 0.85rem;
}

.btn-delete:hover {
    background: #ef4444;
    transform: scale(1.05);
}

.empty-hint {
    text-align: center;
    padding: 30px;
    color: #64748b;
    border: 2px dashed rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    margin-top: 16px;
    font-size: 0.9rem;
}

/* ==================== 底部动作条 ==================== */
.action-bar {
    position: sticky;
    bottom: 0;
    background: rgba(30, 41, 59, 0.85);
    backdrop-filter: blur(15px);
    margin: 24px -20px -20px -20px;
    padding: 16px 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    justify-content: flex-end;
    z-index: 10;
    border-bottom-left-radius: 14px;
    border-bottom-right-radius: 14px;
}

.btn-save {
    padding: 10px 32px;
    background: linear-gradient(135deg, #10b981, #059669);
    border: none;
    border-radius: 10px;
    color: #fff;
    font-size: 0.95rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.3s;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.btn-save:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 18px rgba(16, 185, 129, 0.4);
}

.btn-save:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
}

/* ==================== 用户壁纸列表 ==================== */
.user-wallpaper-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.user-wallpaper-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(255, 255, 255, 0.03);
    padding: 12px;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    transition: all 0.3s;
}

.user-wallpaper-item:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(102, 126, 234, 0.25);
}

.user-info {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
}

.user-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 2px solid rgba(102, 126, 234, 0.4);
    object-fit: cover;
}

.user-details .user-name {
    font-weight: 600;
    color: #fff;
    font-size: 0.95rem;
}

.user-details .user-meta {
    font-size: 0.75rem;
    color: #64748b;
    margin-top: 2px;
}

.wallpaper-preview {
    width: 100px;
    height: 56px;
    border-radius: 8px;
    overflow: hidden;
    margin: 0 16px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    position: relative;
    cursor: pointer;
    transition: all 0.3s;
}

.wallpaper-preview:hover {
    transform: scale(1.04);
    border-color: rgba(102, 126, 234, 0.4);
}

.wallpaper-preview img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: rgba(0, 0, 0, 0.1);
}

.preview-overlay-small {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.3s;
}

.wallpaper-preview:hover .preview-overlay-small {
    opacity: 1;
}

.preview-text {
    color: white;
    font-size: 0.8rem;
    background: rgba(0, 0, 0, 0.7);
    padding: 4px 8px;
    border-radius: 12px;
}

.btn-delete-user {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.2);
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.3s;
}

.btn-delete-user:hover {
    background: #ef4444;
    color: #fff;
}

.loading-state,
.empty-state {
    text-align: center;
    padding: 40px;
    color: #94a3b8;
    font-style: italic;
    font-size: 0.9rem;
}
</style>