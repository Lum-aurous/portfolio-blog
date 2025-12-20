<script setup>
import { ref, onMounted } from 'vue'
import { api } from '@/utils/api'
import { message } from '@/utils/message'
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({ html: true, breaks: true })
const copyrightContent = ref('')
const loading = ref(false)
const saving = ref(false)

// 获取当前版权内容
const fetchCopyright = async () => {
    loading.value = true
    try {
        const res = await api.get('/configs/copyright_detail')
        if (res.data.success) {
            copyrightContent.value = res.data.data
        }
    } catch (err) {
        message.error('加载失败')
    } finally {
        loading.value = false
    }
}

// 保存到后端
const handleSave = async () => {
    if (!copyrightContent.value.trim()) return message.warning('内容不能为空')
    saving.value = true
    try {
        const res = await api.post('/admin/configs/copyright_detail', {
            value: copyrightContent.value
        })
        if (res.data.success) {
            message.success('版权信息已更新！')
        }
    } catch (err) {
        // 这里拦截到了 404 错误
        message.error('保存失败：接口路径错误')
    } finally {
        saving.value = false
    }
}

onMounted(fetchCopyright)
</script>

<template>
    <div class="copyright-manage">
        <div class="manage-header">
            <div class="title-section">
                <h2>⚖️ 版权信息管理</h2>
                <p>在此编辑文章详情页弹出的“官方版权说明书”内容</p>
            </div>
            <button class="save-btn" :disabled="saving" @click="handleSave">
                {{ saving ? '正在同步...' : '🚀 立即保存' }}
            </button>
        </div>

        <div class="manage-body">
            <div class="editor-pane">
                <div class="pane-label">Markdown 内容编辑器</div>
                <textarea v-model="copyrightContent" placeholder="请输入版权声明内容..." spellcheck="false"></textarea>
                <div class="editor-tips">
                    <span>💡 提示：使用 <b>~~文字~~</b> 渲染为波浪线下划线</span>
                    <span>支持 Emoji 表情 ✨🕊️🎨</span>
                </div>
            </div>

            <div class="preview-pane">
                <div class="pane-label">前台艺术纸效果预览</div>
                <div class="art-paper-mock">
                    <div class="paper-content markdown-body" v-html="md.render(copyrightContent || '# 请输入内容')"></div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.copyright-manage {
    animation: fadeIn 0.5s ease;
}

.manage-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30px;
}

.title-section h2 {
    color: #fff;
    margin-bottom: 5px;
}

.title-section p {
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.9rem;
}

.save-btn {
    padding: 12px 30px;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    border: none;
    border-radius: 12px;
    color: white;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
    transition: all 0.3s;
}

.save-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
}

.manage-body {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 30px;
    height: calc(100vh - 250px);
}

.pane-label {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.4);
    margin-bottom: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
}

.editor-pane,
.preview-pane {
    display: flex;
    flex-direction: column;
}

textarea {
    flex: 1;
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 20px;
    color: #fff;
    font-family: 'Fira Code', monospace;
    font-size: 1rem;
    line-height: 1.6;
    resize: none;
    outline: none;
}

textarea:focus {
    border-color: #3b82f6;
    background: rgba(0, 0, 0, 0.3);
}

.editor-tips {
    display: flex;
    justify-content: space-between;
    margin-top: 10px;
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.4);
}

/* 模拟前台艺术纸预览样式 */
.art-paper-mock {
    flex: 1;
    background-color: #fcfaf2;
    background-image: url('https://www.transparenttextures.com/patterns/papyrus.png');
    border-radius: 16px;
    padding: 40px;
    overflow-y: auto;
    box-shadow: inset 0 0 50px rgba(220, 180, 120, 0.1);
    color: #4a3c28;
}

.paper-content {
    font-family: "Kaiti", "STKaiti", serif;
    line-height: 1.8;
}

/* 必须在此处重复定义前台的波浪线逻辑，才能实现预览 */
.paper-content :deep(del) {
    text-decoration: none;
    border-bottom: 2px wavy #ff7e5f;
    color: #e67e22;
    font-weight: bold;
    padding: 0 4px;
}

.paper-content :deep(h1) {
    text-align: center;
    color: #8b5a2b;
    border: none;
    margin-bottom: 20px;
}

.paper-content :deep(h3) {
    color: #d2a679;
    border-bottom: 1px dashed rgba(210, 166, 121, 0.3);
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(10px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}
</style>