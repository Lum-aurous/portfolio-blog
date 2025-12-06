<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios' // 引入 axios

// 背景图状态
const bgUrl = ref('')
const activeTab = ref('personal')
const isSaving = ref(false)

// 用户数据
const user = ref({
    username: '',
    nickname: '',
    email: '',
    avatar: '',
    birthday: '',
    gender: '',
    phone: '',
    // 👇 新增
    region: '',
    bio: '',
    social_link: ''
})

// 💾 数据备份 (用于“取消”操作回滚)
const originalUser = ref({})

// 侧边栏菜单 (保持不变)
const menuItems = [
    { id: 'personal', label: '个人信息', iconPath: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' },
    { id: 'security', label: '安全与登录', iconPath: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-9-2c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z' },
    { id: 'data', label: '数据与隐私', iconPath: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z' },
    { id: 'people', label: '用户与分享', iconPath: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z' },
]

// ==================== 核心逻辑区域 ====================

// 1. 获取用户信息 (从后端数据库拉取)
const fetchUserInfo = async () => {
    // 从登录时保存的 localStorage 中获取当前用户名
    const currentUsername = localStorage.getItem('username')
    if (!currentUsername) return

    try {
        // 向后端请求数据
        const res = await axios.get('/api/user/profile', {
            params: { username: currentUsername }
        })

        if (res.data.success) {
            const dbUser = res.data.user
            // 将数据库的数据填充到前端 user 对象
            user.value = {
                username: dbUser.username,
                nickname: dbUser.nickname || dbUser.username, // 如果没设置昵称，默认显示用户名
                email: dbUser.email || '',
                avatar: dbUser.avatar || '',
                birthday: dbUser.birthday || '未设置',
                gender: dbUser.gender || '未设置',
                phone: dbUser.phone || '',
                // 👇 新增
                region: dbUser.region || '',
                bio: dbUser.bio || '',
                social_link: dbUser.social_link || ''
            }

            // 备份一份，用于“取消”功能
            originalUser.value = { ...user.value }

            // 🔥 重要：同步更新 localStorage，保证 Navbar 头像能立即显示
            if (dbUser.avatar) localStorage.setItem('userAvatar', dbUser.avatar)
            if (dbUser.nickname) localStorage.setItem('nickname', dbUser.nickname)
            if (dbUser.email) localStorage.setItem('email', dbUser.email)
        }
    } catch (error) {
        console.error('获取用户信息失败', error)
    }
}

// 2. 取消修改 (Cancel)
const handleCancel = () => {
    // 恢复到刚进入页面时的数据
    user.value = { ...originalUser.value }
    alert('已重置为最新保存的状态')
}

// 3. 发布/保存修改 (Publish) - 存入数据库
const handlePublish = async () => {
    if (!user.value.nickname) return alert('昵称不能为空')

    isSaving.value = true

    try {
        // 发送给后端
        const res = await axios.post('/api/user/update', user.value)

        if (res.data.success) {
            alert('🎉 保存成功！数据已同步到数据库')

            // 更新 localStorage 供 Navbar 使用 (不用刷新页面也能同步)
            localStorage.setItem('nickname', user.value.nickname)
            localStorage.setItem('email', user.value.email)
            localStorage.setItem('userAvatar', user.value.avatar)

            // 更新备份数据
            originalUser.value = { ...user.value }

            // 刷新页面，确保 Navbar 组件重新挂载并读取最新头像
            window.location.reload()
        } else {
            alert('保存失败：' + res.data.message)
        }

    } catch (error) {
        console.error(error)
        alert('❌ 保存失败，服务器错误')
    } finally {
        isSaving.value = false
    }
}

// 头像上传 (逻辑不变，依然转 Base64，但现在会存入数据库)
const fileInput = ref(null)
const triggerUpload = () => fileInput.value.click()
const handleFileChange = (event) => {
    const file = event.target.files[0]
    if (file) {
        // 限制图片大小 (建议限制在 500KB 以内，因为 Base64 很占数据库空间)
        if (file.size > 500 * 1024) {
            alert('图片太大啦，请上传 500KB 以内的图片')
            return
        }

        const reader = new FileReader()
        reader.onload = (e) => {
            // 这里的更改只在当前页面预览，必须点击右上角“发布”才会存入数据库
            user.value.avatar = e.target.result
        }
        reader.readAsDataURL(file)
    }
}

onMounted(() => {
    const savedBg = localStorage.getItem('activeWallpaperUrl')
    bgUrl.value = savedBg || 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?ixlib=rb-4.0.3&auto=format&fit=crop&w=2940&q=80'

    fetchUserInfo() // 🚀 页面加载时，从数据库拉取数据
})
</script>

<template>
    <div class="account-page" :style="{ backgroundImage: `url(${bgUrl})` }">
        <div class="bg-overlay"></div>

        <div class="glass-container animate__animated animate__fadeInUp">

            <div class="action-bar">
                <button class="btn-cancel" @click="handleCancel" :disabled="isSaving">取消</button>
                <button class="btn-publish" @click="handlePublish" :disabled="isSaving">
                    {{ isSaving ? '保存中...' : '发布' }}
                </button>
            </div>

            <aside class="sidebar">
                <div class="sidebar-header">
                    <div class="mini-avatar">
                        <img v-if="user.avatar" :src="user.avatar" />
                        <span v-else>{{ user.username ? user.username.charAt(0).toUpperCase() : 'U' }}</span>
                    </div>
                    <div class="sidebar-title">
                        <h3>{{ user.nickname }}</h3>
                        <p>@{{ user.username }}</p>
                    </div>
                </div>

                <ul class="nav-list">
                    <li v-for="item in menuItems" :key="item.id" class="nav-item"
                        :class="{ active: activeTab === item.id }" @click="activeTab = item.id">
                        <svg viewBox="0 0 24 24" class="nav-icon">
                            <path :d="item.iconPath" fill="currentColor" />
                        </svg>
                        <span class="nav-label">{{ item.label }}</span>
                    </li>
                </ul>
            </aside>

            <main class="main-content">
                <div class="content-header">
                    <h1>{{ activeTab === 'personal' ? '个人信息' : '用户设置' }}</h1>
                    <p class="sub-text">管理您的个人资料及安全设置</p>
                </div>

                <div v-if="activeTab === 'personal'" class="info-group">
                    <div class="info-block">
                        <div class="block-header">
                            <h3>基本信息</h3>
                            <p>查看并编辑您的基本资料</p>
                        </div>

                        <div class="info-row avatar-row" @click="triggerUpload">
                            <div class="row-left">头像</div>
                            <div class="row-center">添加照片以个性化您的账户</div>
                            <div class="row-right">
                                <div class="current-avatar">
                                    <img v-if="user.avatar" :src="user.avatar" />
                                    <span v-else>{{ user.username ? user.username.charAt(0).toUpperCase() : 'U'
                                        }}</span>
                                    <div class="camera-icon">📷</div>
                                </div>
                            </div>
                            <input type="file" ref="fileInput" @change="handleFileChange" accept="image/*" hidden />
                        </div>

                        <div class="info-row">
                            <div class="row-left">昵称</div>
                            <div class="row-center">
                                <input type="text" v-model="user.nickname" class="transparent-input"
                                    placeholder="输入昵称" />
                            </div>
                            <div class="row-right edit-icon">✎</div>
                        </div>

                        <div class="info-row">
                            <div class="row-left">生日</div>
                            <div class="row-center">
                                <input type="text" v-model="user.birthday" class="transparent-input" />
                            </div>
                            <div class="row-right edit-icon">✎</div>
                        </div>

                        <div class="info-row no-border">
                            <div class="row-left">性别</div>
                            <div class="row-center">
                                <input type="text" v-model="user.gender" class="transparent-input" />
                            </div>
                            <div class="row-right edit-icon">✎</div>
                        </div>

                        <div class="info-row">
                            <div class="row-left">地区</div>
                            <div class="row-center">
                                <input type="text" v-model="user.region" class="transparent-input" placeholder="添加地区" />
                            </div>
                            <div class="row-right edit-icon">✎</div>
                        </div>

                        <div class="info-row bio-row">
                            <div class="row-left">自我介绍</div>
                            <div class="row-center">
                                <textarea v-model="user.bio" class="transparent-textarea" placeholder="写一句话介绍自己..."
                                    rows="1"></textarea>
                            </div>
                            <div class="row-right edit-icon">✎</div>
                        </div>
                    </div>

                    <div class="info-block mt-40">
                        <div class="block-header">
                            <h3>联系信息</h3>
                            <p>管理您的联系方式</p>
                        </div>

                        <div class="info-row">
                            <div class="row-left">电子邮件</div>
                            <div class="row-center">
                                <input type="email" v-model="user.email" class="transparent-input" />
                            </div>
                            <div class="row-right edit-icon">✎</div>
                        </div>

                        <div class="info-row no-border">
                            <div class="row-left">电话</div>
                            <div class="row-center">
                                <input type="tel" v-model="user.phone" class="transparent-input" placeholder="未设置" />
                            </div>
                            <div class="row-right edit-icon">✎</div>
                        </div>

                        <div class="info-row">
                            <div class="row-left">社交媒体</div>
                            <div class="row-center">
                                <input type="text" v-model="user.social_link" class="transparent-input"
                                    placeholder="输入链接 (如 GitHub/Twitter)" />
                            </div>
                            <div class="row-right edit-icon">✎</div>
                        </div>
                    </div>
                </div>

                <div v-else class="content-view placeholder-view">
                    <div class="empty-state">
                        <h2>功能开发中</h2>
                        <p>请点击“个人信息”查看演示。</p>
                    </div>
                </div>
            </main>
        </div>
    </div>
</template>

<style scoped>
/* ================= 页面容器 ================= */
.account-page {
    min-height: 100vh;
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 120px;
    padding-bottom: 60px;
    position: relative;
    background-size: cover;
    background-position: center;
    background-attachment: fixed;
    box-sizing: border-box;
}

.bg-overlay {
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(15px);
    z-index: 0;
}

/* ================= 大毛玻璃容器 ================= */
.glass-container {
    position: relative;
    z-index: 1;
    width: 1100px;
    max-width: 90%;
    min-height: 700px;
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(40px);
    -webkit-backdrop-filter: blur(40px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 24px;
    box-shadow: 0 30px 60px rgba(0, 0, 0, 0.4);
    display: flex;
    overflow: hidden;
    /* 这里很重要，保证 Action Bar 不溢出 */
}

/* ================= 🌟 顶部操作栏 (Action Bar) ================= */
.action-bar {
    position: absolute;
    top: 0;
    right: 0;
    width: 100%;
    height: 60px;
    padding: 0 30px;
    display: flex;
    justify-content: flex-end;
    /* 按钮靠右 */
    align-items: center;
    gap: 15px;
    background: rgba(0, 0, 0, 0.1);
    /* 轻微的底色区分 */
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    z-index: 10;
    pointer-events: none;
    /* 让鼠标能穿透空白区域 */
}

.action-bar button {
    pointer-events: auto;
    /* 按钮恢复点击 */
    font-size: 0.9rem;
    font-weight: 600;
    padding: 8px 24px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-cancel {
    background: transparent;
    border: none;
    color: #aaa;
}

.btn-cancel:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.1);
}

.btn-publish {
    background: #3ea6ff;
    /* YouTube 蓝 */
    border: none;
    color: #0f0f0f;
    /* 黑色文字对比度高 */
}

.btn-publish:hover {
    background: #65b8ff;
}

.btn-publish:disabled {
    background: #555;
    color: #888;
    cursor: not-allowed;
}

/* ================= 左侧：侧边导航 ================= */
.sidebar {
    width: 280px;
    flex-shrink: 0;
    background: rgba(0, 0, 0, 0.2);
    border-right: 1px solid rgba(255, 255, 255, 0.1);
    padding: 80px 20px 20px;
    /* 顶部留出 Action Bar 的位置 */
    display: flex;
    flex-direction: column;
}

.sidebar-header {
    display: flex;
    align-items: center;
    gap: 15px;
    margin-bottom: 40px;
    padding: 0 10px;
}

.mini-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #1296db;
    display: flex;
    justify-content: center;
    align-items: center;
    font-weight: bold;
    color: white;
    overflow: hidden;
}

.mini-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

/* 👇 修改处：头部信息样式优化 */
.sidebar-title {
    display: flex;
    flex-direction: column;
    justify-content: center;
    overflow: hidden;
    /* 防止长名字溢出 */
}

.sidebar-title h3 {
    margin: 0 0 2px 0;
    font-size: 1.1rem;
    color: #fff;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    /* 长名字显示省略号 */
}

.sidebar-title p {
    margin: 0;
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.6);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.nav-list {
    list-style: none;
    padding: 0;
    margin: 0;
}

.nav-item {
    display: flex;
    align-items: center;
    padding: 14px 20px;
    margin-bottom: 5px;
    border-radius: 50px;
    cursor: pointer;
    transition: all 0.2s;
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.95rem;
}

.nav-item:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
}

.nav-item.active {
    background: rgba(66, 184, 131, 0.2);
    color: #42b883;
    font-weight: 500;
}

.nav-icon {
    width: 22px;
    height: 22px;
    margin-right: 15px;
    fill: currentColor;
}

/* ================= 右侧：内容区 ================= */
.main-content {
    flex: 1;
    padding: 80px 80px 40px;
    /* 顶部留出 Action Bar 空间 */
    overflow-y: auto;
}

/* 头部 */
.content-header {
    text-align: center;
    margin-bottom: 50px;
}

.content-header h1 {
    font-size: 2.2rem;
    color: #fff;
    margin-bottom: 10px;
    font-weight: 500;
}

.sub-text {
    font-size: 1rem;
    color: rgba(255, 255, 255, 0.6);
}

/* 信息区块 */
.info-block {
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    overflow: hidden;
    background: transparent;
}

.block-header {
    padding: 24px;
}

.block-header h3 {
    margin: 0 0 5px 0;
    font-size: 1.3rem;
    color: #fff;
    font-weight: 400;
}

.block-header p {
    margin: 0;
    font-size: 0.95rem;
    color: rgba(255, 255, 255, 0.5);
}

/* 列表行 */
.info-row {
    display: flex;
    align-items: center;
    padding: 20px 24px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    cursor: text;
    transition: background 0.2s;
}

.info-row:hover {
    background: rgba(255, 255, 255, 0.05);
}

.row-left {
    width: 25%;
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.6);
    font-weight: 500;
}

.row-center {
    flex: 1;
    font-size: 1.1rem;
    color: #fff;
}

.row-right {
    margin-left: 20px;
    color: rgba(255, 255, 255, 0.4);
}

/* 透明输入框 */
.transparent-input {
    background: transparent;
    border: none;
    color: white;
    font-size: 1.1rem;
    width: 100%;
    outline: none;
    border-bottom: 1px solid transparent;
    transition: border-color 0.3s;
    padding: 4px 0;
}

.transparent-input:focus {
    border-bottom: 1px solid #42b883;
}

.edit-icon {
    font-size: 1.2rem;
    cursor: pointer;
}

/* 头像行 */
.avatar-row {
    padding: 12px 24px;
    cursor: pointer;
}

.current-avatar {
    width: 60px;
    height: 60px;
    position: relative;
}

.current-avatar img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
}

.current-avatar span {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: #1e293b;
    color: #1296db;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    font-weight: bold;
}

.camera-icon {
    position: absolute;
    bottom: 0;
    right: 0;
    background: #333;
    padding: 4px;
    border-radius: 50%;
    font-size: 12px;
}

.mt-40 {
    margin-top: 40px;
}

.placeholder-view {
    text-align: center;
    color: rgba(255, 255, 255, 0.5);
    padding-top: 100px;
}

/* 自我介绍行的特殊处理：允许变高 */
.bio-row {
    align-items: flex-start;
    /* 顶部对齐 */
}

/* 透明多行文本框 */
.transparent-textarea {
    background: transparent;
    border: none;
    color: white;
    font-size: 1.1rem;
    width: 100%;
    outline: none;
    border-bottom: 1px solid transparent;
    transition: border-color 0.3s;
    padding: 4px 0;
    resize: none;
    /* 禁止手动拖拽大小，保持整洁 */
    font-family: inherit;
    line-height: 1.5;
}

.transparent-textarea:focus {
    border-bottom: 1px solid #42b883;
}

@media (max-width: 900px) {
    .glass-container {
        flex-direction: column;
        height: auto;
    }

    .sidebar {
        width: 100%;
        border-right: none;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        padding-top: 20px;
    }

    .main-content {
        padding: 30px 20px;
    }

    .action-bar {
        position: relative;
        width: 100%;
        height: auto;
        padding: 15px;
        justify-content: flex-end;
        background: rgba(0, 0, 0, 0.2);
    }

    .info-row {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
    }

    .row-left {
        width: 100%;
    }

    .row-right {
        position: absolute;
        right: 20px;
        top: 50%;
        transform: translateY(-50%);
    }

    .info-row {
        position: relative;
    }
}
</style>