<script setup>
import { ref } from 'vue'
import { api } from '@/utils/api'
import { message } from '@/utils/message'
import Navbar from '@/components/Navbar.vue'
import Footer from '@/components/Footer.vue'

// 表单数据
const form = ref({
    name: '',
    email: '',
    subject: '',
    content: ''
})

const isSubmitting = ref(false)

// 社交链接配置 (你可以换成你自己的真实链接)
const socialLinks = [
    { name: 'GitHub', icon: 'github', url: 'https://github.com', color: '#333' },
    { name: 'Twitter', icon: 'twitter', url: 'https://twitter.com', color: '#1da1f2' },
    { name: 'Email', icon: 'envelope', url: 'mailto:jackbo@example.com', color: '#ea4335' },
    // { name: 'WeChat', icon: 'wechat', url: '#', color: '#07c160' }
]

// 提交表单
const handleSubmit = async () => {
    if (!form.value.name || !form.value.email || !form.value.content) {
        return message.warning('请填写必要信息 (姓名、邮箱、内容)')
    }

    isSubmitting.value = true
    try {
        const res = await api.post('/contact', form.value)
        if (res.data.success) {
            message.success('发送成功！我会尽快回复。')
            // 重置表单
            form.value = { name: '', email: '', subject: '', content: '' }
        }
    } catch (err) {
        message.error('发送失败，请稍后重试')
    } finally {
        isSubmitting.value = false
    }
}

// 复制邮箱功能
const copyEmail = () => {
    navigator.clipboard.writeText('jackbo@example.com')
    message.success('邮箱已复制到剪贴板')
}
</script>

<template>
    <div class="contact-page">
        <Navbar />

        <div class="bg-decoration">
            <div class="blob blob-1"></div>
            <div class="blob blob-2"></div>
        </div>

        <main class="contact-container animate__animated animate__fadeInUp">
            <div class="contact-card">
                <div class="contact-info">
                    <h2 class="info-title">Let's Talk</h2>
                    <p class="info-desc">
                        无论是技术探讨、项目合作，还是只是想交个朋友，<br>
                        我都非常乐意收到你的来信。
                    </p>

                    <div class="info-details">
                        <div class="detail-item" @click="copyEmail">
                            <span class="icon">📧</span>
                            <div class="text">
                                <span class="label">Email Me</span>
                                <span class="value">jackbo@example.com</span>
                            </div>
                        </div>
                        <div class="detail-item">
                            <span class="icon">📍</span>
                            <div class="text">
                                <span class="label">Location</span>
                                <span class="value">Shanghai, China</span>
                            </div>
                        </div>
                    </div>

                    <div class="social-links">
                        <a v-for="link in socialLinks" :key="link.name" :href="link.url" target="_blank"
                            class="social-btn" :style="{ '--hover-color': link.color }">
                            {{ link.name[0] }}
                        </a>
                    </div>
                </div>

                <div class="contact-form-wrapper">
                    <form @submit.prevent="handleSubmit" class="contact-form">
                        <div class="form-group">
                            <label>您的姓名</label>
                            <input v-model="form.name" type="text" placeholder="怎么称呼您？" required>
                        </div>

                        <div class="form-group">
                            <label>联系邮箱</label>
                            <input v-model="form.email" type="email" placeholder="example@mail.com" required>
                        </div>

                        <div class="form-group full-width">
                            <label>主题 (可选)</label>
                            <input v-model="form.subject" type="text" placeholder="关于什么事？">
                        </div>

                        <div class="form-group full-width">
                            <label>消息内容</label>
                            <textarea v-model="form.content" placeholder="请在这里写下您的想法..." rows="5" required></textarea>
                        </div>

                        <button type="submit" class="submit-btn" :disabled="isSubmitting">
                            <span v-if="!isSubmitting">发送消息 ✈️</span>
                            <span v-else class="loading-spinner"></span>
                        </button>
                    </form>
                </div>
            </div>
        </main>
    </div>
</template>

<style scoped>
.contact-page {
    min-height: 100vh;
    background-color: #f0f2f5;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
    /* 防止背景球溢出 */
}

/* --- 背景装饰 (动态流体球) --- */
.bg-decoration {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
    pointer-events: none;
}

.blob {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    opacity: 0.6;
    animation: float 10s infinite alternate;
}

.blob-1 {
    width: 400px;
    height: 400px;
    background: #a8edea;
    top: -100px;
    left: -100px;
}

.blob-2 {
    width: 300px;
    height: 300px;
    background: #fed6e3;
    bottom: -50px;
    right: -50px;
    animation-delay: -5s;
}

@keyframes float {
    0% {
        transform: translate(0, 0) scale(1);
    }

    100% {
        transform: translate(30px, 50px) scale(1.1);
    }
}

/* --- 主容器 --- */
.contact-container {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 120px 20px 60px;
    /* 给 Navbar 留位置 */
    z-index: 1;
}

.contact-card {
    display: flex;
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(20px);
    border-radius: 24px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.05);
    width: 100%;
    max-width: 1000px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.6);
}

/* --- 左侧信息栏 --- */
.contact-info {
    flex: 2;
    background: linear-gradient(135deg, #42b883 0%, #35495e 100%);
    color: white;
    padding: 50px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    position: relative;
    overflow: hidden;
}

/* 左侧装饰纹理 */
.contact-info::before {
    content: '';
    position: absolute;
    width: 150px;
    height: 150px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 50%;
    top: -30px;
    right: -30px;
}

.info-title {
    font-size: 2.5rem;
    font-weight: 700;
    margin-bottom: 15px;
    letter-spacing: 1px;
}

.info-desc {
    font-size: 1rem;
    opacity: 0.9;
    line-height: 1.6;
    margin-bottom: 40px;
}

.info-details {
    display: flex;
    flex-direction: column;
    gap: 25px;
}

.detail-item {
    display: flex;
    align-items: center;
    gap: 15px;
    cursor: pointer;
    transition: transform 0.3s;
}

.detail-item:hover {
    transform: translateX(10px);
}

.detail-item .icon {
    width: 45px;
    height: 45px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 1.2rem;
}

.detail-item .text {
    display: flex;
    flex-direction: column;
}

.detail-item .label {
    font-size: 0.8rem;
    opacity: 0.7;
    text-transform: uppercase;
    letter-spacing: 1px;
}

.detail-item .value {
    font-size: 1rem;
    font-weight: 500;
}

.social-links {
    margin-top: 50px;
    display: flex;
    gap: 15px;
}

.social-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    display: flex;
    justify-content: center;
    align-items: center;
    text-decoration: none;
    font-weight: bold;
    transition: all 0.3s;
}

.social-btn:hover {
    background: white;
    color: var(--hover-color);
    transform: translateY(-3px);
}

/* --- 右侧表单栏 --- */
.contact-form-wrapper {
    flex: 3;
    padding: 50px;
}

.contact-form {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.full-width {
    grid-column: span 2;
}

.contact-form label {
    font-size: 0.9rem;
    color: #666;
    font-weight: 500;
}

.contact-form input,
.contact-form textarea {
    padding: 12px 15px;
    border: 1px solid #eee;
    border-radius: 8px;
    background: #f9f9f9;
    font-size: 0.95rem;
    outline: none;
    transition: all 0.3s;
    font-family: inherit;
}

.contact-form input:focus,
.contact-form textarea:focus {
    border-color: #42b883;
    background: white;
    box-shadow: 0 0 0 3px rgba(66, 184, 131, 0.1);
}

.submit-btn {
    grid-column: span 2;
    padding: 14px;
    background: #42b883;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s;
    margin-top: 10px;
    display: flex;
    justify-content: center;
    align-items: center;
}

.submit-btn:hover {
    background: #3aa876;
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(66, 184, 131, 0.3);
}

.submit-btn:disabled {
    background: #ccc;
    cursor: not-allowed;
    transform: none;
}

/* Loading 动画 */
.loading-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid #ffffff;
    border-top: 2px solid transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

/* --- 响应式 --- */
@media (max-width: 768px) {
    .contact-card {
        flex-direction: column;
        margin-top: 20px;
    }

    .contact-info,
    .contact-form-wrapper {
        padding: 30px;
    }

    .contact-form {
        grid-template-columns: 1fr;
    }

    .full-width {
        grid-column: span 1;
    }

    .submit-btn {
        grid-column: span 1;
    }
}
</style>