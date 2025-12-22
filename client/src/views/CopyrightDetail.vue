<script setup>
import { ref, onMounted, computed } from 'vue'
import { api } from '@/utils/api'
import MarkdownIt from 'markdown-it'
import 'github-markdown-css/github-markdown-light.css'

const md = new MarkdownIt({ html: true, linkify: true, breaks: true })
const copyrightContent = ref('')
const loading = ref(true)

const fetchCopyright = async () => {
    try {
        const res = await api.get('/configs/copyright_detail')
        if (res.data.success) {
            copyrightContent.value = res.data.data
        }
    } catch (err) {
        console.error("加载版权详情失败:", err)
    } finally {
        loading.value = false
    }
}

const renderedContent = computed(() => md.render(copyrightContent.value || '加载中...'))

onMounted(() => {
    fetchCopyright()
    window.scrollTo(0, 0)
})
</script>

<template>
    <div class="copyright-page animate__animated animate__fadeIn">
        <div class="content-wrapper art-paper-container">
            <h1 class="page-title">版权与许可声明</h1>
            <div class="divider"></div>
            
            <div v-if="loading" class="loading-state">正在调取档案...</div>
            <div v-else class="markdown-body art-paper-content" v-html="renderedContent"></div>
            
            <div class="back-home">
                <router-link to="/" class="back-btn">返回首页</router-link>
            </div>
        </div>
    </div>
</template>

<style scoped>
.copyright-page {
    padding: 120px 20px 60px; /* 避开顶部导航栏 */
    min-height: 100vh;
    display: flex;
    justify-content: center;
}

.content-wrapper {
    width: 100%;
    max-width: 800px;
    background-color: #fcfaf2;
    background-image: url('https://www.transparenttextures.com/patterns/papyrus.png');
    padding: 60px 50px;
    border-radius: 4px;
    box-shadow: 0 30px 70px rgba(0,0,0,0.15);
    border: 1px solid #e8dcc4;
}

.page-title {
    text-align: center;
    color: #8b5a2b;
    font-family: "Kaiti", "STKaiti", serif;
    margin-bottom: 20px;
}

.divider {
    width: 60px;
    height: 3px;
    background: #d2a679;
    margin: 0 auto 40px;
}

.art-paper-content {
    font-family: "Kaiti", "STKaiti", serif;
    color: #4a3c28;
    line-height: 2.2;
    font-size: 1.1rem;
}

.loading-state {
    text-align: center;
    color: #999;
    padding: 40px;
}

.back-home {
    margin-top: 50px;
    text-align: center;
}

.back-btn {
    padding: 10px 30px;
    border: 1px solid #d2a679;
    color: #8b5a2b;
    border-radius: 25px;
    transition: all 0.3s;
}

.back-btn:hover {
    background: #8b5a2b;
    color: white;
}

/* 适配移动端 */
@media (max-width: 768px) {
    .content-wrapper { padding: 30px 20px; }
}
</style>