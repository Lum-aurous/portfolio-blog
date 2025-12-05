<script setup>
import { ref } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'

const router = useRouter()

const form = ref({
    title: '',
    summary: '',
    content: '',
    cover_image: '' // 👈 新增：用来存图片的路径
})

// 1. 处理图片上传
const handleFileUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    // 准备表单数据 (因为发文件必须用 FormData)
    const formData = new FormData()
    formData.append('image', file)

    try {
        // 发送给后端上传接口
        const res = await axios.post('/api/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        })

        // 上传成功！后端返回了图片的路径 (比如 'uploads/123.jpg')
        // 我们把它存到表单里，准备一会儿和文章一起发
        form.value.cover_image = res.data.filePath
        alert('✅ 图片上传成功！')
    } catch (error) {
        console.error(error)
        alert('❌ 图片上传失败')
    }
}

// 2. 发布文章
const submitArticle = async () => {
    if (!form.value.title || !form.value.content) {
        alert('标题和内容不能为空！')
        return
    }

    try {
        // 发送文章数据 (包含刚才拿到的 cover_image)
        await axios.post('/api/articles', form.value)

        alert('🎉 发布成功！')
        router.push('/')
    } catch (error) {
        console.error(error)
        alert('发布失败，请检查后台')
    }
}
</script>

<template>
    <div class="admin-container">
        <h1>✍️ 写作后台</h1>

        <div class="form-group">
            <label>文章标题</label>
            <input v-model="form.title" type="text" placeholder="给文章起个好名字">
        </div>

        <div class="form-group">
            <label>封面图片 (可选)</label>
            <input type="file" @change="handleFileUpload" accept="image/*">

            <div v-if="form.cover_image" class="image-preview">
                <p>📸 封面预览：</p>
                <img :src="'/' + form.cover_image" alt="封面预览">
            </div>
        </div>
        <div class="form-group">
            <label>简介 (Summary)</label>
            <input v-model="form.summary" type="text" placeholder="一句话介绍这篇文章">
        </div>

        <div class="form-group">
            <label>正文内容</label>
            <textarea v-model="form.content" rows="10" placeholder="开始你的创作..."></textarea>
        </div>

        <button @click="submitArticle" class="btn-publish">🚀 立即发布</button>
    </div>
</template>

<style scoped>
.admin-container {
    max-width: 600px;
    margin: 50px auto;
    padding: 30px;
    background: var(--card-bg);
    border-radius: 12px;
    box-shadow: 0 5px 20px rgba(0, 0, 0, 0.1);
    font-family: sans-serif;
    border: 1px solid var(--border-color);
    color: var(--text-color);
}

h1 {
    text-align: center;
    color: var(--text-color);
    margin-bottom: 30px;
}

.form-group {
    margin-bottom: 20px;
}

label {
    display: block;
    margin-bottom: 8px;
    font-weight: bold;
    color: var(--text-secondary);
}

input[type="text"],
textarea {
    width: 100%;
    padding: 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    font-size: 1rem;
    box-sizing: border-box;
    transition: 0.3s;
    background: var(--bg-color);
    color: var(--text-color);
}

input:focus,
textarea:focus {
    border-color: #42b883;
    outline: none;
}

/* 简单的文件上传样式 */
input[type="file"] {
    margin-top: 5px;
}

.image-preview {
    margin-top: 15px;
    padding: 10px;
    background: var(--bg-color);
    border-radius: 6px;
    text-align: center;
}

.image-preview img {
    max-width: 100%;
    max-height: 200px;
    border-radius: 4px;
    border: 1px solid #ddd;
}

.image-preview p {
    margin: 0 0 10px 0;
    color: #666;
    font-size: 0.9rem;
}

.btn-publish {
    width: 100%;
    padding: 15px;
    background: #42b883;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1.1rem;
    font-weight: bold;
    cursor: pointer;
    transition: 0.3s;
}

.btn-publish:hover {
    background: #3aa876;
}
</style>