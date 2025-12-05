<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { useRoute } from 'vue-router'

const route = useRoute()
const article = ref(null)

// 评论数据
const comments = ref([])
const commentForm = ref({ content: '' })

// 用户状态
const isLoggedIn = ref(false)
const username = ref('')
const isAdmin = ref(false) // 👈 新增：判断是不是管理员

// 获取文章
const fetchArticle = async () => {
    try {
        const res = await axios.get(`/api/articles/${route.params.id}`)
        article.value = res.data
    } catch (error) { console.error(error) }
}

// 获取评论
const fetchComments = async () => {
    try {
        const res = await axios.get(`/api/comments?article_id=${route.params.id}`)
        comments.value = res.data
    } catch (error) { console.error(error) }
}

// 提交评论
const submitComment = async () => {
    if (!commentForm.value.content) return alert('内容不能为空')

    try {
        const currentUser = localStorage.getItem('username') || '神秘管理员'
        await axios.post('/api/comments', {
            article_id: route.params.id,
            nickname: currentUser,
            content: commentForm.value.content
        })

        alert('🎉 发送成功！')
        commentForm.value.content = '' // 清空输入框
        fetchComments() // 刷新列表
    } catch (error) { alert('失败，请重试') }
}

// 👇 新增：回复功能 (点击回复，自动在输入框加 @名字)
const replyTo = (nickname) => {
    commentForm.value.content = `回复 @${nickname} : `
    // 自动聚焦到输入框（体验优化）
    document.querySelector('textarea').focus()
}

// 👇 新增：删除功能 (只有管理员能用)
const deleteComment = async (id) => {
    if (!confirm('确定要删除这条评论吗？')) return

    try {
        await axios.delete(`/api/comments/${id}`)
        fetchComments() // 删完刷新列表
    } catch (error) { alert('删除失败') }
}

onMounted(() => {
    isLoggedIn.value = !!localStorage.getItem('isLoggedIn')
    username.value = localStorage.getItem('username') || ''
    // 检查是否是管理员
    isAdmin.value = localStorage.getItem('role') === 'admin'

    fetchArticle()
    fetchComments()
})
</script>

<template>
    <div class="detail-container" v-if="article">
        <router-link to="/" class="back-btn">⬅ 返回首页</router-link>

        <div v-if="article.cover_image" class="detail-cover">
            <img :src="'/' + article.cover_image" alt="封面">
        </div>

        <h1>{{ article.title }}</h1>
        <div class="meta">
            <span>📅 {{ new Date(article.created_at).toLocaleDateString() }}</span>
        </div>

        <div class="content">{{ article.content }}</div>

        <div class="comment-section">
            <h3>💬 互动交流</h3>

            <div v-if="isLoggedIn" class="comment-form">
                <p class="user-info">
                    当前身份：<strong>{{ username }}</strong>
                    <span v-if="isAdmin" class="badge-admin">博主</span>
                </p>
                <textarea v-model="commentForm.content" placeholder="写下你的想法..."></textarea>
                <button @click="submitComment">发送评论</button>
            </div>

            <div v-else class="login-tip">
                👉 <router-link to="/login">登录</router-link> 后参与讨论
            </div>

            <div class="comment-list">
                <div v-if="comments.length === 0" class="no-comment">暂无评论，来坐沙发！🛋️</div>

                <div v-for="c in comments" :key="c.id" class="comment-item">
                    <div class="comment-header">
                        <div class="user-meta">
                            <span class="avatar">👤</span>
                            <strong>{{ c.nickname }}</strong>
                            <span v-if="c.nickname === username && isAdmin" class="badge-admin-small">作者</span>
                        </div>
                        <span class="time">{{ new Date(c.created_at).toLocaleString() }}</span>
                    </div>

                    <p class="comment-text">{{ c.content }}</p>

                    <div class="action-bar" v-if="isLoggedIn">
                        <span @click="replyTo(c.nickname)" class="btn-text">↩️ 回复</span>

                        <span v-if="isAdmin" @click="deleteComment(c.id)" class="btn-text delete">🗑️ 删除</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div v-else>正在加载...</div>
</template>

<style scoped>
.detail-container {
    max-width: 800px;
    margin: 50px auto;
    padding: 20px;
    font-family: sans-serif;
}

.detail-cover img {
    width: 100%;
    max-height: 400px;
    /* 详情页可以高一点 */
    object-fit: cover;
    border-radius: 12px;
    margin-bottom: 20px;
}

h1 {
    font-size: 2.5rem;
    color: #35495e;
    margin-bottom: 10px;
}

.meta {
    color: #999;
    margin-bottom: 30px;
    border-bottom: 1px solid #eee;
    padding-bottom: 20px;
}

.content {
    line-height: 1.8;
    font-size: 1.1rem;
    color: #333;
    white-space: pre-wrap;
    margin-bottom: 50px;
}

.back-btn {
    display: inline-block;
    margin-bottom: 20px;
    text-decoration: none;
    color: #42b883;
    font-weight: bold;
}

.comment-section {
    margin-top: 50px;
    border-top: 2px solid #eee;
    padding-top: 30px;
}

.comment-form {
    background: var(--card-bg);
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 30px;
    border: 1px solid var(--border-color);
}

.comment-form textarea {
    width: 100%;
    padding: 10px;
    margin-bottom: 10px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-color);
    color: var(--text-color);
}

.comment-form button {
    background: #42b883;
    color: white;
    border: none;
    padding: 8px 20px;
    border-radius: 4px;
    cursor: pointer;
}

.comment-item {
    border-bottom: 1px solid var(--border-color);
    padding: 20px 0;
}

.comment-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
}

.user-meta {
    display: flex;
    align-items: center;
    gap: 8px;
}

.avatar {
    background: #eee;
    padding: 5px;
    border-radius: 50%;
}

.time {
    color: #999;
    font-size: 0.8rem;
}

.comment-text {
    margin: 5px 0 10px 35px;
    color: var(--text-color);
    line-height: 1.5;
}

/* 身份标签样式 */
.badge-admin {
    background: #42b883;
    color: white;
    font-size: 0.8rem;
    padding: 2px 6px;
    border-radius: 4px;
    margin-left: 5px;
}

.badge-admin-small {
    background: #35495e;
    color: white;
    font-size: 0.7rem;
    padding: 2px 5px;
    border-radius: 4px;
}

/* 按钮栏样式 */
.action-bar {
    margin-left: 35px;
    font-size: 0.9rem;
    display: flex;
    gap: 15px;
}

.btn-text {
    cursor: pointer;
    color: #666;
    transition: 0.2s;
}

.btn-text:hover {
    color: #42b883;
}

.delete {
    color: #ff6b6b;
}

.delete:hover {
    color: red;
}

.login-tip {
    text-align: center;
    padding: 30px;
    background: var(--bg-color);
    border-radius: 8px;
    color: var(--text-secondary);
}

.login-tip a {
    color: #42b883;
    font-weight: bold;
    text-decoration: none;
}
</style>