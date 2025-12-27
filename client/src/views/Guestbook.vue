<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { api } from '@/utils/api'
import { useUserStore } from '@/stores/user'
import { message } from '@/utils/message'
import Navbar from '@/components/Navbar.vue'
import Footer from '@/components/Footer.vue'

const userStore = useUserStore()
const isLoading = ref(true)
const comments = ref([])
const barrageList = ref([]) // 弹幕池
const barrageInput = ref('')
const bottomContent = ref('')
const isSending = ref(false)

// 弹幕配置
const tracks = ref([[], [], [], []]) // 4条轨道
let barrageTimer = null

// 1. 获取留言数据
const fetchComments = async () => {
    try {
        const res = await api.get('/comments', {
            params: { article_id: 100000, page: 1, limit: 200 }
        })

        if (res.data.success) {
            const list = res.data.data.list || [];
            comments.value = list;

            if (list.length > 0) {
                // 格式化弹幕数据
                barrageList.value = list.map(c => ({
                    id: c.id,
                    text: c.content,
                    avatar: c.user_avatar || 'https://w.wallhaven.cc/full/9o/wallhaven-9oog5d.jpg',
                    color: getRandomColor()
                }));

                // 🔥 核心升级：数据加载完，立即“撒满”屏幕
                initBarrageOnScreen();
            }
        }
    } catch (err) {
        console.error('留言加载失败:', err)
        comments.value = []
    } finally {
        isLoading.value = false
    }
}

// 2. 🚀 开局撒点：让屏幕一开始就是满的
const initBarrageOnScreen = () => {
    // 如果没有数据，就不撒了
    if (barrageList.value.length === 0) return;

    // 随机取 10-15 条数据，随机分布在屏幕各个位置
    const initCount = Math.min(barrageList.value.length, 15);
    for (let i = 0; i < initCount; i++) {
        // 随机取一条留言
        const item = barrageList.value[Math.floor(Math.random() * barrageList.value.length)];

        // 随机轨道
        const trackId = Math.floor(Math.random() * tracks.value.length);

        // 🔥 随机起始位置：从 10% 到 90% 的屏幕宽度
        // 这样用户一进来就能看到满屏都在动
        const randomLeft = 10 + Math.random() * 80;

        const duration = 12 + Math.random() * 8; // 慢一点，看起来优雅

        pushToTrack(trackId, {
            ...item,
            left: randomLeft + '%', // 📍 覆盖默认的 100%
            duration: duration
        });
    }
}

// 3. 🛡️ 永动发射器
const startBarrageLoop = () => {
    if (barrageTimer) clearInterval(barrageTimer);

    let index = 0;

    // 启动定时器：不管有没有数据，定时器一直跑
    // 只要有数据进来，立马开始发射
    barrageTimer = setInterval(() => {
        if (barrageList.value.length === 0) return;

        // 顺序取数据，取模实现无限循环
        const item = barrageList.value[index % barrageList.value.length];

        // 发射一条标准的（从最右边出来）
        shootBarrage(item);

        index++;
    }, 1200); // 1.2秒一条，保持节奏
}

// 发射单条逻辑
const shootBarrage = (item) => {
    const trackId = Math.floor(Math.random() * tracks.value.length);
    const duration = 10 + Math.random() * 8; // 随机速度

    pushToTrack(trackId, {
        ...item,
        left: '100%', // 默认从屏幕右外侧开始
        duration: duration
    });
}

// 统一推入轨道并销毁
const pushToTrack = (trackId, itemData) => {
    const uniqueKey = Date.now() + Math.random();

    tracks.value[trackId].push({
        ...itemData,
        key: uniqueKey,
    });

    // 动画结束后自动销毁 DOM，防止卡顿
    // 时间给得宽裕一点 (duration * 1000 + 2000)
    setTimeout(() => {
        const index = tracks.value[trackId].findIndex(i => i.key === uniqueKey);
        if (index !== -1) {
            tracks.value[trackId].splice(index, 1);
        }
    }, itemData.duration * 1000 + 3000);
}

// 4. 发送留言
const handleSend = async (content, from = 'barrage') => {
    if (!content || !content.trim()) return message.warning('写点什么吧~')
    if (!userStore.isLoggedIn) return message.warning('请先登录')

    const payload = {
        article_id: 100000,
        content: content,
        parent_id: null,
        work_type: 'article'
    }

    try {
        if (from === 'barrage') isSending.value = true

        const res = await api.post('/comments', payload)

        if (res.data.success) {
            message.success('发送成功！')
            const newComment = res.data.data
            const currentUser = userStore.user || {};
            const currentAvatar = currentUser.avatar || 'https://w.wallhaven.cc/full/9o/wallhaven-9oog5d.jpg';
            const currentNickname = currentUser.nickname || currentUser.username || '热心网友';

            // 更新下方列表
            comments.value.unshift({
                ...newComment,
                nickname: currentNickname,
                user_avatar: currentAvatar,
                created_at: new Date()
            })

            // 🔥 更新弹幕池 (插到最前面，保证循环时能尽快再次看到)
            const newItem = {
                id: newComment.id,
                text: newComment.content,
                avatar: currentAvatar,
                color: '#fff',
                isSelf: true
            };
            barrageList.value.unshift(newItem);

            // 立即发射给自己看
            shootBarrage(newItem);

            if (from === 'barrage') barrageInput.value = ''
            if (from === 'bottom') bottomContent.value = ''
        }
    } catch (e) {
        console.error(e)
        message.error('发送失败')
    } finally {
        isSending.value = false
    }
}

const getRandomColor = () => {
    const colors = ['#ffffff', '#e0f7fa', '#fff9c4', '#e1bee7', '#b2dfdb', '#ffccbc'];
    return colors[Math.floor(Math.random() * colors.length)];
}

onMounted(() => {
    // 1. 无论有没有数据，先把引擎发动起来
    startBarrageLoop();
    // 2. 去拉数据，拉到了会自动填充弹幕池
    fetchComments();
})

onUnmounted(() => {
    if (barrageTimer) clearInterval(barrageTimer)
})
</script>

<template>
    <div class="guestbook-page">
        <Navbar />

        <header class="barrage-hero">
            <div class="hero-mask"></div>

            <div class="barrage-container">
                <div v-for="(track, tIdx) in tracks" :key="tIdx" class="barrage-track">
                    <div v-for="item in track" :key="item.key" class="barrage-item" :class="{ 'is-self': item.isSelf }"
                        :style="{
                            left: item.left, /* 🔥 关键：位置由 JS 决定 */
                            animationDuration: item.duration + 's'
                        }">
                        <img :src="item.avatar" class="b-avatar" alt="avatar">
                        <span :style="{ color: item.color }">{{ item.text }}</span>
                    </div>
                </div>
            </div>

            <div class="hero-center-box animate__animated animate__fadeInUp">
                <h1 class="page-title">留言板</h1>
                <p class="page-desc">在这里留下你的足迹，与世界分享你的声音。</p>

                <div class="barrage-input-wrapper">
                    <input v-model="barrageInput" type="text" placeholder="发送弹幕，留下你的故事..."
                        @keyup.enter="handleSend(barrageInput)" :disabled="isSending">
                    <button class="send-btn" @click="handleSend(barrageInput)" :disabled="isSending">
                        {{ isSending ? '...' : '发射 🚀' }}
                    </button>
                </div>
            </div>
        </header>

        <main class="comments-section">
            <div class="section-header">
                <h2>全部留言 ({{ comments.length }})</h2>
                <span class="sub-text">即使相隔万里，我们依然在此相遇。</span>
            </div>

            <div class="comment-box-card">
                <textarea class="main-textarea" v-model="bottomContent" placeholder="写下你的留言，加入这片星空..."
                    @keydown.ctrl.enter="handleSend(bottomContent, 'bottom')">
                </textarea>

                <div class="action-bar">
                    <span class="tip">Ctrl + Enter 发送</span>
                    <button class="submit-btn-small" @click="handleSend(bottomContent, 'bottom')">
                        提交留言
                    </button>
                </div>
            </div>

            <div class="comment-list">
                <div v-if="isLoading" class="loading">加载中...</div>
                <div v-else-if="comments.length === 0" class="empty">还没有人留言，快抢沙发！</div>

                <div v-else class="comment-items">
                    <div v-for="comment in comments" :key="comment.id"
                        class="comment-row animate__animated animate__fadeIn">
                        <img :src="comment.user_avatar || 'https://w.wallhaven.cc/full/9o/wallhaven-9oog5d.jpg'"
                            class="c-avatar">
                        <div class="c-content">
                            <div class="c-meta">
                                <span class="c-name">{{ comment.nickname }}</span>
                                <span class="c-date">{{ new Date(comment.created_at).toLocaleString() }}</span>
                            </div>
                            <div class="c-text">{{ comment.content }}</div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </div>
</template>

<style scoped>
.guestbook-page {
    background-color: #f6f8fa;
    min-height: 100vh;
}

/* --- Hero & 弹幕 --- */
.barrage-hero {
    position: relative;
    height: 60vh;
    min-height: 500px;
    background-image: url('https://w.wallhaven.cc/full/48/wallhaven-4813e7.jpg');
    /* 你的图5背景 */
    background-size: cover;
    background-position: center;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
}

.hero-mask {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.3);
    /* 遮罩 */
    backdrop-filter: blur(2px);
}

.barrage-container {
    position: absolute;
    top: 10%;
    left: 0;
    width: 100%;
    height: 60%;
    pointer-events: none;
    /* 让鼠标穿透，不影响点击输入框 */
    z-index: 1;
}

.barrage-track {
    height: 50px;
    margin-bottom: 20px;
    position: relative;
    white-space: nowrap;
}

/* 弹幕项 */
.barrage-item {
    position: absolute;
    /* ❌ 删掉 left: 100%; 因为现在通过 style 内联控制了 */
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(0, 0, 0, 0.4);
    padding: 6px 16px 6px 8px;
    border-radius: 50px;
    color: #fff;
    font-size: 0.95rem;
    white-space: nowrap;

    /* 动画配置 */
    animation-name: scrollLeft;
    animation-timing-function: linear;
    animation-fill-mode: forwards;

    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.1);

    /* 防止鼠标选中文本影响观感 */
    user-select: none;
    /* 鼠标放上去暂停，方便看清楚（可选体验优化） */
    transition: transform 0.2s;
}

.barrage-item:hover {
    z-index: 99;
    background: rgba(0, 0, 0, 0.7);
    border-color: #42b883;
    /* animation-play-state: paused;  <-- 如果你想让鼠标悬停时暂停，可以加这个 */
}

/* 自己的弹幕高亮 */
.barrage-item.is-self {
    background: rgba(66, 184, 131, 0.7);
    border-color: #42b883;
    z-index: 100;
    /* 保证自己在最上层 */
    box-shadow: 0 0 10px rgba(66, 184, 131, 0.5);
}

/* 弹幕头像的大小 */
.b-avatar {
    width: 26px;
    /* 设置合适的宽度 */
    height: 26px;
    /* 设置合适的高度 */
    border-radius: 50%;
    /* 圆形 */
    border: 1px solid rgba(255, 255, 255, 0.3);
    /* 加个小边框更好看 */
}

@keyframes scrollLeft {
    from {
        transform: translateX(0);
    }

    to {
        /* 移动距离 = 屏幕宽度 + 自己的宽度 + 初始偏移 */
        /* 简单粗暴一点，直接往左移足够的距离确保飞出屏幕 */
        transform: translateX(calc(-100vw - 500px));
    }
}

/* --- 中央输入区 --- */
.hero-center-box {
    position: relative;
    z-index: 10;
    text-align: center;
    color: #fff;
    width: 90%;
    max-width: 600px;
}

.page-title {
    font-size: 3rem;
    margin-bottom: 10px;
    font-weight: 700;
    letter-spacing: 4px;
    text-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
}

.page-desc {
    font-size: 1.1rem;
    opacity: 0.9;
    margin-bottom: 30px;
}

.barrage-input-wrapper {
    display: flex;
    background: rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(10px);
    border-radius: 50px;
    padding: 5px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    transition: all 0.3s;
}

.barrage-input-wrapper:focus-within {
    background: rgba(255, 255, 255, 0.9);
    transform: scale(1.05);
}

.barrage-input-wrapper input {
    flex: 1;
    background: transparent;
    border: none;
    padding: 12px 20px;
    color: #fff;
    font-size: 1rem;
    outline: none;
}

.barrage-input-wrapper:focus-within input {
    color: #333;
}

.send-btn {
    padding: 0 25px;
    border-radius: 40px;
    border: none;
    background: #42b883;
    color: #fff;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s;
}

.send-btn:hover {
    background: #3aa876;
}

/* --- 底部列表区 --- */
.comments-section {
    max-width: 900px;
    margin: -50px auto 50px;
    /* 上移重叠效果 */
    position: relative;
    z-index: 2;
    padding: 0 20px;
}

.section-header {
    margin-bottom: 20px;
    color: #333;
}

.section-header h2 {
    margin-bottom: 5px;
}

.sub-text {
    color: #666;
    font-size: 0.9rem;
}

.comment-box-card {
    background: #fff;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
    margin-bottom: 30px;
}

.main-textarea {
    width: 100%;
    height: 100px;
    border: 1px solid #eee;
    border-radius: 8px;
    padding: 10px;
    font-size: 0.95rem;
    resize: none;
    outline: none;
    transition: border-color 0.3s;
}

.main-textarea:focus {
    border-color: #42b883;
}

.action-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 10px;
}

.tip {
    font-size: 0.8rem;
    color: #999;
}

.submit-btn-small {
    padding: 8px 20px;
    background: #333;
    color: #fff;
    border: none;
    border-radius: 6px;
    cursor: pointer;
}

.comment-list {
    background: #fff;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
}

.comment-row {
    display: flex;
    gap: 15px;
    padding: 20px 0;
    border-bottom: 1px solid #f0f0f0;
}

.c-avatar {
    width: 45px;
    height: 45px;
    border-radius: 50%;
}

.c-content {
    flex: 1;
}

.c-meta {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
    font-size: 0.85rem;
}

.c-name {
    font-weight: 600;
    color: #333;
}

.c-date {
    color: #999;
}

.c-text {
    color: #555;
    line-height: 1.6;
}
</style>