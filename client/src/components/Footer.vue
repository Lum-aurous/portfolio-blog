<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user.js'
import { message } from '@/utils/message.js'

const router = useRouter()
const userStore = useUserStore()
const currentYear = new Date().getFullYear()

// --- 1. 暗门逻辑 ---
const clickCount = ref(0)
const lastClickTime = ref(0)
const handleAdminClick = () => {
    const now = Date.now()
    if (now - lastClickTime.value > 3000) clickCount.value = 0
    lastClickTime.value = now
    clickCount.value++
    if (clickCount.value === 5) {
        clickCount.value = 0
        if (userStore.user?.role === 'admin') {
            message.success('验证成功，进入管理系统...')
            router.push('/admin')
        }
    }
}

const isAdmin = computed(() => userStore.user?.role === 'admin')
const adminDisplayName = computed(() => isAdmin.value ? userStore.user.username : 'Veritas')

// --- 2. 运行时间计时器逻辑 ---
const runtimeText = ref('')
let timer = null

const calculateRuntime = () => {
    const startDate = new Date('2024-01-01 00:00:00') // 👈 请设置你网站的真实诞生日
    const now = new Date()
    const diff = now - startDate

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
    const mins = Math.floor((diff / (1000 * 60)) % 60)
    const secs = Math.floor((diff / 1000) % 60)

    runtimeText.value = `${days}天 ${hours}时 ${mins}分 ${secs}秒`
}

onMounted(() => {
    calculateRuntime()
    timer = setInterval(calculateRuntime, 1000)
})

onUnmounted(() => {
    if (timer) clearInterval(timer)
})
</script>

<template>
    <footer class="site-footer">
        <div class="footer-container">
            <div class="runtime-info">
                <span class="clock-icon">🕒</span> 本站已平稳运行：<span class="time-text">{{ runtimeText }}</span>
            </div>

            <div class="copyright-line">
                <span>© {{ currentYear }} <span class="brand-text">Veritas WEBlog</span></span>
                <span class="divider">|</span>
                <span class="dev-text">
                    Designed & Developed by
                    <span class="admin-name" :class="{ 'admin-active': isAdmin }" @click="handleAdminClick">{{
                        adminDisplayName }}</span>
                </span>
            </div>

            <div class="footer-links">
                <router-link to="/copyright" class="link-item highlight-link">版权声明</router-link>
                <span class="dot">·</span>
                <router-link to="/blog" class="link-item">文章归档</router-link>
                <span class="dot">·</span>
                <a href="https://beian.miit.gov.cn/" target="_blank" class="link-item">沪ICP备XXXXXXXX号</a>
            </div>
        </div>
    </footer>
</template>

<style scoped>
.site-footer {
    width: 100%;
    padding: 25px 0 30px;
    margin-top: 40px;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(12px);
    border-top: 1px solid rgba(255, 255, 255, 0.2);
    text-align: center;
}

.footer-container {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

/* 运行时间样式 */
.runtime-info {
    font-size: 0.75rem;
    color: #64748b;
    margin-bottom: 4px;
}

.time-text {
    font-family: monospace;
    color: #475569;
    font-weight: 600;
}

.copyright-line {
    font-size: 0.85rem;
    color: #334155;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    text-shadow: 0 1px 1px rgba(255, 255, 255, 0.5);
    user-select: none;
}

.admin-name {
    color: #059669;
    font-weight: 700;
    transition: all 0.3s ease;
}

/* 🔥 管理员登录时的暗门提示：极细的虚线下划线，只有鼠标悬停才明显 */
.admin-active {
    cursor: pointer;
    border-bottom: 1px dashed transparent;
}

.admin-active:hover {
    border-bottom: 1px dashed #059669;
}

.footer-links {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    font-size: 0.8rem;
}

.highlight-link {
    color: #059669 !important;
    font-weight: 700;
}

.link-item {
    color: #475569;
    text-decoration: none;
}

.link-item:hover {
    text-decoration: underline;
}

.dot {
    color: #94a3b8;
}

@media (max-width: 768px) {
    .copyright-line {
        flex-direction: column;
        gap: 4px;
    }

    .divider {
        display: none;
    }
}
</style>