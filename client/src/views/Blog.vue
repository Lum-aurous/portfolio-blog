<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

// 简历与博客数据
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
    <div class="blog-container">

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

        <div v-if="articles.length > 0" class="blog-list animate__animated animate__fadeInUp animate__delay-0.5s">
            <h2 class="section-title">📝 最新动态</h2>
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

        <div v-else class="loading">正在加载内容...</div>

    </div>
</template>

<style scoped>
/* 容器 */
.blog-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 40px 20px;
    padding-top: 100px;
    /* 给导航栏留出空间 */
    min-height: 100vh;
}

/* 简历卡片样式 */
.resume-card {
    background: rgba(var(--card-bg-rgb, 255, 255, 255), 0.5);
    /* 半透明 */
    backdrop-filter: blur(10px);
    border-radius: 12px;
    box-shadow: 0 5px 30px rgba(0, 0, 0, 0.2);
    overflow: hidden;
    margin-bottom: 50px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: var(--text-color);
}

.header {
    background: linear-gradient(135deg, #42b883 0%, #35495e 100%);
    color: white;
    padding: 40px;
    text-align: center;
}

.header h1 {
    margin: 0;
    font-size: 2.5rem;
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
    padding: 8px;
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

/* 打字机动画 */
.typing-effect {
    display: inline-block;
    overflow: hidden;
    white-space: nowrap;
    border-right: 3px solid #fff;
    width: 0;
    animation: typing 2s steps(10) forwards, blink .75s step-end infinite;
    margin: 0 auto;
}

@keyframes typing {
    from {
        width: 0
    }

    to {
        width: 100%
    }
}

@keyframes blink {
    50% {
        border-color: transparent;
    }
}

/* 文章列表样式 */
.section-title {
    text-align: center;
    color: var(--text-color);
    margin-bottom: 30px;
    border-left: 5px solid #42b883;
    padding-left: 15px;
    display: inline-block;
}

.article-card {
    background: rgba(var(--card-bg-rgb, 255, 255, 255), 0.5);
    backdrop-filter: blur(10px);
    margin-bottom: 30px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    overflow: hidden;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
}

.article-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 15px 30px rgba(0, 0, 0, 0.15);
}

.card-image img {
    width: 100%;
    height: 250px;
    object-fit: cover;
    display: block;
    transition: transform 0.5s ease;
}

.article-card:hover .card-image img {
    transform: scale(1.05);
}

.card-image {
    overflow: hidden;
}

.card-text {
    padding: 25px;
}

.article-link {
    text-decoration: none;
    color: var(--text-color);
    font-size: 1.5rem;
    font-weight: bold;
    transition: 0.3s;
}

.article-link:hover {
    color: #42b883;
}

.date {
    font-size: 0.9rem;
    color: #999;
    margin: 10px 0;
}

.summary {
    color: var(--text-secondary);
    line-height: 1.6;
}

.loading {
    text-align: center;
    color: white;
    margin-top: 50px;
}
</style>