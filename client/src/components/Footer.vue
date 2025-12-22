<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router' // 🔥 引入路由用于跳转
import { useUserStore } from '@/stores/user.js'
import { message } from '@/utils/message.js'

const router = useRouter()
const userStore = useUserStore()
const currentYear = new Date().getFullYear()

// --- 🔥 核心逻辑：暗门计数器 ---
const clickCount = ref(0)
const lastClickTime = ref(0)

const handleAdminClick = () => {
    const now = Date.now()

    // 如果两次点击间隔超过 3 秒，重置计数器
    if (now - lastClickTime.value > 3000) {
        clickCount.value = 0
    }

    lastClickTime.value = now
    clickCount.value++

    // 当点击次数达到 5 次时
    if (clickCount.value === 5) {
        clickCount.value = 0 // 重置计数

        // 校验身份：如果是管理员直接跳后台，否则提示权限不足
        if (userStore.user?.role === 'admin') {
            message.success('身份确认：正在进入管理系统...')
            router.push('/admin')
        } else {
            console.log('🤫 发现暗门，但你不是管理员哦')
            // 保持神秘感，可以不给任何提示，或者给一个调皮的提示
        }
    }
}

// 动态判断显示名称
const adminDisplayName = computed(() => {
    const user = userStore.user
    return (user && user.role === 'admin') ? user.username : 'Veritas'
})
</script>

<template>
    <footer class="site-footer">
        <div class="footer-container">
            <div class="copyright-line">
                <span class="c-text">© {{ currentYear }} <span class="brand-text">Veritas WEBlog</span></span>
                <span class="divider">|</span>
                <span class="dev-text">
                    Designed & Developed by
                    <span class="admin-name" @click="handleAdminClick" title="Veritas">{{ adminDisplayName }}</span>
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
    padding: 20px 0 25px;
    margin-top: 40px;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-top: 1px solid rgba(255, 255, 255, 0.2);
    text-align: center;
}

.footer-container {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.copyright-line {
    font-size: 0.85rem;
    color: #334155;
    font-weight: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    text-shadow: 0 1px 1px rgba(255, 255, 255, 0.5);
    /* 确保文字不会被选中，增加“点击”的隐蔽性 */
    user-select: none;
}

.brand-text {
    color: #1e293b;
    font-weight: 600;
}

.divider {
    color: #94a3b8;
    margin: 0 4px;
}

/* 管理员名字样式 */
.admin-name {
    color: #059669;
    font-weight: 700;
    cursor: pointer;
    /* 虽然是暗门，但管理员鼠标放上去还是要有反馈 */
    transition: all 0.3s ease;
}

/* 点击时的微小缩放反馈，仅管理员自己能感觉到 */
.admin-name:active {
    transform: scale(0.95);
}

.footer-links {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    font-size: 0.8rem;
}

.link-item {
    color: #475569;
    cursor: pointer;
    transition: all 0.3s ease;
    text-decoration: none;
}

.highlight-link {
    color: #059669 !important;
    font-weight: 700;
}

.link-item:hover {
    opacity: 0.8;
    text-decoration: underline;
}

.dot {
    color: #94a3b8;
    font-weight: bold;
}

@media (max-width: 768px) {
    .site-footer {
        padding: 15px 0 20px;
    }

    .copyright-line {
        flex-direction: column;
        gap: 4px;
    }

    .divider {
        display: none;
    }
}
</style>