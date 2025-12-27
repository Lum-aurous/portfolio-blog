<script setup>
import { ref } from 'vue'
import Navbar from '@/components/Navbar.vue'
import Footer from '@/components/Footer.vue'
import { message } from '@/utils/message'

// ==================== 1. 工具列表数据 ====================
// 这里为了演示，我们内置几个前端实现的小工具
const tools = ref([
    {
        id: 'pomodoro',
        title: '专注时钟',
        desc: '基于番茄工作法，通过25分钟的专注，提升工作与学习效率。',
        icon: '🍅',
        category: '效率',
        type: 'internal', // 内部工具，弹窗打开
        color: '#ff6b6b'
    },
    {
        id: 'password',
        title: '强密码生成器',
        desc: '一键生成包含大小写字母、数字和符号的高强度随机密码。',
        icon: '🔐',
        category: '安全',
        type: 'internal',
        color: '#4ecdc4'
    },
    {
        id: 'color',
        title: '配色灵感',
        desc: '随机生成 Material Design 配色方案，为你的设计寻找灵感。',
        icon: '🎨',
        category: '设计',
        type: 'internal',
        color: '#ffbe76'
    },
    {
        id: 'img-compress',
        title: 'TinyPNG',
        desc: '智能 WebP、PNG 和 JPEG 图片压缩，让你的网站加载更快。',
        icon: '🖼️',
        category: '开发',
        type: 'external', // 外部链接
        url: 'https://tinypng.com',
        color: '#a29bfe'
    },
    {
        id: 'json-format',
        title: 'JSON 格式化',
        desc: '简洁好用的 JSON 编辑器，支持格式化、校验和压缩。',
        icon: '🛠️',
        category: '开发',
        type: 'external',
        url: 'https://jsonformatter.curiousconcept.com',
        color: '#6c5ce7'
    },
    {
        id: 'chatgpt',
        title: 'ChatGPT',
        desc: '目前最强大的 AI 对话模型，你的全能助手。',
        icon: '🤖',
        category: 'AI',
        type: 'external',
        url: 'https://chat.openai.com',
        color: '#00b894'
    }
])

// ==================== 2. 交互逻辑 ====================
const activeModal = ref(null) // 当前打开的模态框 ID

// 专注时钟逻辑
const timer = ref(null)
const timeLeft = ref(25 * 60)
const isTimerRunning = ref(false)
const timerMode = ref('focus') // focus | break

// 密码生成器逻辑
const passwordResult = ref('')
const passLength = ref(16)

// 配色逻辑
const colors = ref([])

const openTool = (tool) => {
    if (tool.type === 'external') {
        window.open(tool.url, '_blank')
    } else {
        activeModal.value = tool.id
        // 初始化特定工具
        if (tool.id === 'color') generateColors()
    }
}

const closeModal = () => {
    activeModal.value = null
    // 清理逻辑
    if (timer.value) clearInterval(timer.value)
    isTimerRunning.value = false
    timeLeft.value = 25 * 60
}

// --- 小工具：番茄钟 ---
const toggleTimer = () => {
    if (isTimerRunning.value) {
        clearInterval(timer.value)
        isTimerRunning.value = false
    } else {
        isTimerRunning.value = true
        timer.value = setInterval(() => {
            if (timeLeft.value > 0) {
                timeLeft.value--
            } else {
                clearInterval(timer.value)
                isTimerRunning.value = false
                message.success(timerMode.value === 'focus' ? '专注结束，休息一下吧！' : '休息结束，开始工作！')
                // 自动切换模式
                timerMode.value = timerMode.value === 'focus' ? 'break' : 'focus'
                timeLeft.value = timerMode.value === 'focus' ? 25 * 60 : 5 * 60
            }
        }, 1000)
    }
}
const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
}

// --- 小工具：密码生成 ---
const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+'
    let res = ''
    for (let i = 0; i < passLength.value; i++) {
        res += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    passwordResult.value = res
}
const copyPass = () => {
    navigator.clipboard.writeText(passwordResult.value)
    message.success('已复制')
}

// --- 小工具：配色 ---
const generateColors = () => {
    colors.value = Array(5).fill(0).map(() => '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'))
}
const copyColor = (c) => {
    navigator.clipboard.writeText(c)
    message.success(`色值 ${c} 已复制`)
}

</script>

<template>
    <div class="toolkit-page">
        <Navbar />

        <header class="toolkit-hero">
            <div class="hero-content animate__animated animate__fadeInDown">
                <h1 class="hero-title">TOOLKIT</h1>
                <p class="hero-desc">工欲善其事，必先利其器。收录高效率工具与资源。</p>
            </div>
        </header>

        <main class="toolkit-container">
            <div class="tool-grid">
                <div v-for="tool in tools" :key="tool.id" class="tool-card animate__animated animate__fadeInUp"
                    @click="openTool(tool)">
                    <div class="card-icon" :style="{ background: tool.color }">{{ tool.icon }}</div>
                    <div class="card-info">
                        <div class="card-header">
                            <h3 class="card-title">{{ tool.title }}</h3>
                            <span class="category-badge">{{ tool.category }}</span>
                        </div>
                        <p class="card-desc">{{ tool.desc }}</p>
                    </div>
                    <div class="card-arrow">↗</div>
                </div>
            </div>
        </main>

        <div v-if="activeModal" class="modal-overlay" @click.self="closeModal">

            <div v-if="activeModal === 'pomodoro'" class="modal-card pomodoro-modal animate__animated animate__zoomIn">
                <div class="modal-header">
                    <h3>🍅 专注时钟</h3>
                    <button class="close-btn" @click="closeModal">×</button>
                </div>
                <div class="timer-display" :class="timerMode">
                    {{ formatTime(timeLeft) }}
                </div>
                <div class="timer-controls">
                    <button class="control-btn main" @click="toggleTimer">
                        {{ isTimerRunning ? '暂停' : '开始' }}
                    </button>
                    <button class="control-btn" @click="closeModal">放弃</button>
                </div>
                <p class="timer-tip">{{ timerMode === 'focus' ? '保持专注，请勿切出页面' : '起来走走，喝杯水' }}</p>
            </div>

            <div v-if="activeModal === 'password'" class="modal-card password-modal animate__animated animate__zoomIn">
                <div class="modal-header">
                    <h3>🔐 密码生成器</h3>
                    <button class="close-btn" @click="closeModal">×</button>
                </div>
                <div class="pass-result">
                    <input type="text" v-model="passwordResult" readonly placeholder="点击生成...">
                    <button @click="copyPass">复制</button>
                </div>
                <div class="pass-controls">
                    <label>长度: {{ passLength }}</label>
                    <input type="range" v-model="passLength" min="6" max="32">
                    <button class="gen-btn" @click="generatePassword">生成</button>
                </div>
            </div>

            <div v-if="activeModal === 'color'" class="modal-card color-modal animate__animated animate__zoomIn">
                <div class="modal-header">
                    <h3>🎨 随机配色</h3>
                    <button class="close-btn" @click="closeModal">×</button>
                </div>
                <div class="color-palette">
                    <div v-for="c in colors" :key="c" class="color-strip" :style="{ background: c }"
                        @click="copyColor(c)">
                        <span>{{ c }}</span>
                    </div>
                </div>
                <button class="gen-btn full" @click="generateColors">换一组</button>
            </div>

        </div>
    </div>
</template>

<style scoped>
.toolkit-page {
    background-color: #f8f9fa;
    min-height: 100vh;
}

/* Hero */
.toolkit-hero {
    height: 300px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    justify-content: center;
    align-items: center;
    text-align: center;
    color: white;
}

.hero-title {
    font-size: 3rem;
    margin-bottom: 10px;
    font-weight: 800;
    letter-spacing: 4px;
}

.hero-desc {
    font-size: 1.1rem;
    opacity: 0.9;
}

/* Grid */
.toolkit-container {
    max-width: 1200px;
    margin: -50px auto 50px;
    padding: 0 20px;
}

.tool-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 25px;
}

.tool-card {
    background: white;
    border-radius: 16px;
    padding: 25px;
    display: flex;
    gap: 20px;
    cursor: pointer;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
    transition: all 0.3s;
    position: relative;
    border: 1px solid rgba(0, 0, 0, 0.02);
}

.tool-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
}

.card-icon {
    width: 60px;
    height: 60px;
    border-radius: 12px;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 1.8rem;
    flex-shrink: 0;
    color: white;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
}

.card-info {
    flex: 1;
}

.card-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
}

.card-title {
    font-weight: 700;
    font-size: 1.1rem;
    color: #333;
}

.category-badge {
    font-size: 0.75rem;
    background: #f0f0f0;
    color: #666;
    padding: 2px 8px;
    border-radius: 4px;
}

.card-desc {
    font-size: 0.85rem;
    color: #888;
    line-height: 1.5;
}

.card-arrow {
    position: absolute;
    top: 20px;
    right: 20px;
    color: #ddd;
    font-size: 1.2rem;
    transition: 0.3s;
}

.tool-card:hover .card-arrow {
    color: #42b883;
    transform: translate(3px, -3px);
}

/* Modal Styles */
.modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 2000;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(5px);
    display: flex;
    justify-content: center;
    align-items: center;
}

.modal-card {
    background: white;
    width: 400px;
    padding: 30px;
    border-radius: 20px;
    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.2);
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}

.modal-header h3 {
    margin: 0;
}

.close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #999;
}

/* Pomodoro */
.timer-display {
    font-size: 4rem;
    font-weight: 700;
    text-align: center;
    margin: 20px 0;
    font-variant-numeric: tabular-nums;
}

.timer-display.focus {
    color: #ff6b6b;
}

.timer-display.break {
    color: #4ecdc4;
}

.timer-controls {
    display: flex;
    justify-content: center;
    gap: 15px;
}

.control-btn {
    padding: 10px 30px;
    border-radius: 50px;
    border: none;
    cursor: pointer;
    font-weight: 600;
}

.control-btn.main {
    background: #333;
    color: white;
}

.timer-tip {
    text-align: center;
    color: #999;
    font-size: 0.9rem;
    margin-top: 20px;
}

/* Password */
.pass-result {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
}

.pass-result input {
    flex: 1;
    padding: 10px;
    border: 1px solid #eee;
    border-radius: 8px;
    font-family: monospace;
    font-size: 1.1rem;
}

.pass-controls {
    display: flex;
    align-items: center;
    gap: 15px;
}

.gen-btn {
    padding: 8px 20px;
    background: #4ecdc4;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
}

.gen-btn.full {
    width: 100%;
    margin-top: 20px;
    height: 40px;
    font-size: 1rem;
}

/* Color */
.color-palette {
    display: flex;
    height: 100px;
    border-radius: 12px;
    overflow: hidden;
    cursor: copy;
}

.color-strip {
    flex: 1;
    display: flex;
    align-items: end;
    justify-content: center;
    padding-bottom: 10px;
    color: white;
    font-size: 0.8rem;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    transition: flex 0.3s;
}

.color-strip:hover {
    flex: 2;
}
</style>