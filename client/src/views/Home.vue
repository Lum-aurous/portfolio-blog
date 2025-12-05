<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

const profile = ref(null)
const articles = ref([])

const fetchData = async () => {
    try {
        const [profileRes, articlesRes] = await Promise.all([
            axios.get('/api/profile'),
            axios.get('/api/articles')
        ])

        profile.value = profileRes.data
        articles.value = articlesRes.data
    } catch (error) {
        console.error('加载失败:', error)
    }
}

onMounted(() => {
    fetchData()
})
</script>

<template>
    <div class="app-container">

        <div v-if="profile" class="resume-card animate__animated animate__fadeInDown">
            <div class="header">
                <h1 class="typing-effect">{{ profile.name }}</h1>
                <p class="title">{{ profile.title }}</p>
            </div>
            <div class="content">
                <h3>👤 个人简介</h3>
                <p>{{ profile.bio }}</p>
                <h3>🛠 技术栈</h3>
                <p class="tech-tag">{{ profile.tech_stack }}</p>
                <div class="footer">
                    <a :href="'mailto:' + profile.email" class="btn">📧 发送邮件</a>
                    <a :href="profile.github" target="_blank" class="btn github">🐱 GitHub</a>
                </div>
            </div>
        </div>

        <div v-if="articles.length > 0" class="blog-section animate__animated animate__fadeInUp animate__delay-1s">
            <h2 class="section-title">📝 最新动态</h2>

            <div class="article-list">
                <div v-for="article in articles" :key="article.id" class="article-card">

                    <div v-if="article.cover_image" class="card-image">
                        <img :src="'/' + article.cover_image" alt="文章封面">
                    </div>
                    <div class="card-text">
                        <h4>
                            <router-link :to="'/article/' + article.id" class="article-link">
                                {{ article.title }}
                            </router-link>
                        </h4>
                        <p class="date">📅 {{ new Date(article.created_at).toLocaleDateString() }}</p>
                        <p class="summary">{{ article.summary }}</p>
                    </div>
                </div>
            </div>
        </div>

        <div v-else class="loading">正在加载数据...</div>

    </div>
</template>

<style scoped>
.app-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 50px 20px;
    font-family: sans-serif;
}

/* 简历卡片样式 */
.resume-card {
    background: var(--card-bg);
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    margin-bottom: 40px;
    border: 1px solid var(--border-color);
    color: var(--text-color);
    transition: all 0.3s ease;
    /* 让所有变化都平滑过渡 */
    border: 1px solid rgba(255, 255, 255, 0.1);
    /* 微妙的边框 */
}

.resume-card:hover {
    transform: translateY(-5px);
    /* 向上浮起 5px */
    box-shadow: 0 15px 30px rgba(0, 0, 0, 0.15);
    /* 阴影变大，营造空间感 */
}

.header {
    background: linear-gradient(135deg, #42b883 0%, #35495e 100%);
    color: white;
    padding: 40px;
    text-align: center;
}

.header h1 {
    font-size: 3rem;
    /* 👇 渐变文字魔法 */
    background: linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    /* 如果背景是浅色，就把上面的颜色换深一点，比如 #42b883 到 #35495e */
}

/* 打字机光标动画 */
@keyframes blink {
    50% {
        border-color: transparent;
    }
}

/* 打字机文字样式 */
.typing-effect {
    display: inline-block;
    overflow: hidden;
    /* 隐藏多余部分 */
    white-space: nowrap;
    /* 不换行 */
    border-right: 3px solid #fff;
    /* 光标 */
    width: 0;
    /* 初始宽度为0 */
    animation:
        typing 2s steps(10) forwards,
        /* 打字动画 */
        blink .70s step-end infinite;
    /* 光标闪烁 */
    margin: 0 auto;
}

/* 定义打字过程：从宽度0变到100% */
@keyframes typing {
    from {
        width: 0
    }

    to {
        width: 200px
    }

    /* 或者写具体宽度，比如 200px */
}

.title {
    margin-top: 10px;
    opacity: 0.9;
}

.content {
    padding: 30px;
}

h3 {
    color: #42b883;
    border-bottom: 2px solid #42b883;
    padding-bottom: 5px;
    display: inline-block;
    margin-top: 20px;
}

.tech-tag {
    background: rgba(66, 184, 131, 0.1);
    color: #42b883;
    padding: 10px;
    border-radius: 6px;
    font-weight: bold;
}

.footer {
    margin-top: 30px;
    text-align: center;
}

.btn {
    text-decoration: none;
    padding: 10px 20px;
    border-radius: 20px;
    margin: 0 10px;
    font-weight: bold;
    transition: 0.3s;
    background: #35495e;
    color: white;
}

.btn:hover {
    opacity: 0.8;
}

.github {
    background: #24292e;
}

/* 博客列表样式 */
.section-title {
    text-align: center;
    color: var(--text-color);
    margin-bottom: 20px;
    border-left: 5px solid #42b883;
    padding-left: 15px;
    display: inline-block;
}

.blog-section {
    text-align: left;
}

.article-card {
    background: var(--card-bg);
    margin-bottom: 20px;
    border-radius: 12px;
    /* 圆角大一点 */
    border: 1px solid var(--border-color);
    overflow: hidden;
    /* 防止图片溢出圆角 */
    transition: transform 0.2s;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.article-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
    transform: translateY(-5px);
    /* 向上浮起 5px */
    box-shadow: 0 15px 30px rgba(0, 0, 0, 0.15);
    /* 阴影变大，营造空间感 */
}

/* 👇 新增图片的样式 */
.card-image img {
    width: 100%;
    height: 200px;
    /* 固定高度，防止图片太高 */
    object-fit: cover;
    /* 裁剪模式，保证图片填满且不变形 */
    display: block;
}

/* 图片放大效果 */
.article-card:hover .card-image img {
    transform: scale(1.05);
    /* 图片微微放大 */
    transition: transform 0.5s ease;
}

.card-image {
    overflow: hidden;
}

/* 这一句很重要，防止图片放大溢出 */

.card-text {
    padding: 20px;
}

.article-card h4 {
    margin: 0 0 10px 0;
    font-size: 1.4rem;
}

.article-link {
    text-decoration: none;
    color: var(--text-color);
    transition: 0.3s;
}

.article-link:hover {
    color: #42b883;
}

.date {
    font-size: 0.85rem;
    color: #999;
    margin-bottom: 10px;
}

.summary {
    color: var(--text-secondary);
    line-height: 1.6;
}
</style>