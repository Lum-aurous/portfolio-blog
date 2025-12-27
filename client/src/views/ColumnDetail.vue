<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '@/utils/api'
import { message } from '@/utils/message'
import ArticleItem from '@/components/ArticleItem.vue'
import { useUserStore } from '@/stores/user.js'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const columnData = ref(null)
const coverUploading = ref(false)
const coverInput = ref(null)
const showEditModal = ref(false);
const editForm = ref({ name: '', description: '' });
const isSaving = ref(false);

// ==================== 🛠️ 通用数据清洗函数 (增强版) ====================
const sanitizeItem = (item) => {
  // 1. 基础类型判断
  let type = item.work_type;

  // 如果后端没返回 type，尝试推断
  if (!type) {
    if (item.video_url) type = 'video';
    else if (item.audio_url) type = 'audio';
    else type = 'article'; // 默认为文章
  }

  // 2. 统一封面字段 (兼容各种后端命名)
  let cover = item.cover_image || item.cover || item.cover_url || item.poster;

  // 🔥🔥🔥 核心修复：图文作品封面自动提取 🔥🔥🔥
  // 专栏里的作品也可能是图文，必须把这个逻辑加上
  if ((type === 'short' || !cover) && item.content) {
    // 匹配 Markdown 图片语法 ![...](url)
    const imgMatch = item.content.match(/!\[.*?\]\((.*?)\)/);
    if (imgMatch && imgMatch[1]) {
      cover = imgMatch[1]; // 提取第一张图

      // 如果原本被误判为 article，这里修正为 short
      if (type === 'article') type = 'short';
    }
  }

  // 3. 视频路径修正 (防止缺少前斜杠)
  if (type === 'video' && item.video_url) {
    if (!item.video_url.startsWith('http') && !item.video_url.startsWith('/')) {
      item.video_url = '/' + item.video_url;
    }
  }

  // 4. 返回清洗后的标准化对象
  return {
    ...item,
    // 专栏列表接口返回的 id 是作品本身的 id，entry_id 是关联表的 id
    // ArticleItem 需要的是作品 id
    id: item.id,
    entry_id: item.entry_id, // 保留关联ID用于移除操作
    title: item.title,
    summary: item.summary || item.description || '',
    work_type: type, // 修正后的类型
    cover_image: cover, // 修正后的封面
    // 确保数值存在，不为 null
    views: Number(item.views || 0),
    comments: Number(item.comments || 0),
    likes: Number(item.likes || 0),
    favorites: Number(item.favorites || 0),
    created_at: item.created_at
  };
}

// 🔥 核心修复：统一路径处理函数 (解决 NotSameOrigin 问题)
const getProxyUrl = (url) => {
  if (!url || url === 'null' || url === 'undefined') {
    return 'https://images.unsplash.com/photo-1484417894907-623942c8ee29?w=500';
  }

  // 1. 网络图片直接返回
  if (url.startsWith('http')) return url;

  // 2. 本地上传的图片，必须走 /api 代理
  // 逻辑：如果路径以 /uploads 开头，且没有 /api 前缀，则补上 /api
  const isDev = import.meta.env.VITE_APP_ENV === 'development'
  const apiBase = isDev ? import.meta.env.VITE_API_TARGET : window.location.origin

  if (url.startsWith('/uploads') || url.startsWith('/')) {
    let cleanPath = url.startsWith('/') ? url : '/' + url
    // 如果已经是 /api 开头就不加了，否则加上
    if (!cleanPath.startsWith('/api')) {
      cleanPath = '/api' + cleanPath
    }
    // 注意：这里不需要再拼 http://localhost:3000，直接返回相对路径让浏览器走代理
    // 或者如果为了兼容 SSR，可以拼上 apiBase，但关键是路径里要有 /api
    // 在你的场景下，直接返回相对路径给 img src 最稳妥
    return cleanPath
  }

  return `${apiBase}/api/proxy-image?url=${encodeURIComponent(url)}`
};

// 获取专栏内容
const fetchColumnContent = async () => {
  try {
    const res = await api.get(`/columns/${route.params.id}`)
    // 适配 api.js 响应结构
    const serverData = (res.data && res.data.success !== undefined) ? res.data : res;

    if (serverData.success) {
      // 🔥 核心：对返回的文章列表进行数据清洗，确保音频能显示
      const rawData = serverData.data;
      columnData.value = {
        ...rawData,
        articles: (rawData.articles || []).map(sanitizeItem)
      }
      console.log("📂 专栏数据加载成功:", columnData.value);
    }
  } catch (err) {
    console.error(err)
    message.error('无法加载专栏内容')
  }
}

const isMyColumn = computed(() => {
  return columnData.value?.info.user_id === userStore.user?.id
})

// 触发文件选择
const triggerCoverUpload = () => {
  if (coverUploading.value) return;
  coverInput.value.click();
};

// 处理封面更换
const handleCoverChange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('cover', file);

  coverUploading.value = true;
  try {
    const res = await api.put(`/columns/${route.params.id}/cover`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    // 适配响应
    const serverData = (res.data && res.data.success !== undefined) ? res.data : res;

    if (serverData.success) {
      message.success('专栏背景同步成功！');
      // 实时更新详情页预览
      columnData.value.info.cover = serverData.data;
    }
  } catch (err) {
    message.error('封面同步失败，请重试');
  } finally {
    coverUploading.value = false;
    e.target.value = '';
  }
};

// 打开编辑弹窗
const openEditModal = () => {
  if (!columnData.value?.info) return;
  editForm.value = {
    name: columnData.value.info.name,
    description: columnData.value.info.description || ''
  };
  showEditModal.value = true;
};

// 提交修改
const handleSaveInfo = async () => {
  if (!editForm.value.name.trim()) return message.warning('专栏名称不能为空');

  isSaving.value = true;
  try {
    const res = await api.put(`/columns/${route.params.id}/info`, editForm.value);
    const serverData = (res.data && res.data.success !== undefined) ? res.data : res;

    if (serverData.success) {
      message.success('专栏信息更新成功！');
      columnData.value.info.name = editForm.value.name;
      columnData.value.info.description = editForm.value.description;
      showEditModal.value = false;
    }
  } catch (err) {
    message.error('修改失败，请检查网络');
  } finally {
    isSaving.value = false;
  }
};

// 移除作品
const handleRemoveArticle = async (entry) => {
  if (!confirm('确定要将此内容从专栏中移除吗？')) return
  try {
    const linkId = entry.entry_id || entry.id
    const res = await api.delete(`/columns/${route.params.id}/articles/${linkId}`)
    const serverData = (res.data && res.data.success !== undefined) ? res.data : res;

    if (serverData.success) {
      message.success('已从专栏移除')
      fetchColumnContent()
    }
  } catch (err) {
    message.error('移除失败')
  }
}

onMounted(fetchColumnContent)
</script>

<template>
  <div class="column-detail-page" v-if="columnData">
    <header class="profile-header-flat">
      <div class="banner-box">
        <img :src="getProxyUrl(columnData.info.cover)" class="banner-img" :class="{ 'loading-blur': coverUploading }"
          alt="banner">

        <template v-if="isMyColumn">
          <div class="banner-tag" @click="triggerCoverUpload">
            {{ coverUploading ? '同步中...' : '📷 更换专栏背景' }}
          </div>
          <input type="file" ref="coverInput" style="display: none" accept="image/*" @change="handleCoverChange">
        </template>
      </div>

      <div class="header-info-container">
        <div class="info-content-main">
          <div class="avatar-box">
            <img :src="columnData.info.avatar || 'https://w.wallhaven.cc/full/9o/wallhaven-9oog5d.jpg'"
              class="avatar-img" alt="creator">
          </div>

          <div class="user-detail">
            <div class="name-row">
              <h1 class="nickname">{{ columnData.info.name }}</h1>
              <span class="user-badge">专题专栏</span>
            </div>

            <div class="stats-row-top">
              <span class="top-stat">创建者：<b>{{ columnData.info.nickname || columnData.info.username }}</b></span>
              <span class="top-stat">📦 <b>{{ columnData.articles.length }}</b> 个作品</span>
            </div>

            <div class="bio-box">
              <p class="user-bio">专栏描述：{{ columnData.info.description || '这个专栏文件夹暂时没有描述。' }}</p>
            </div>
          </div>

          <div class="header-actions">
            <button v-if="isMyColumn" class="action-btn outline edit-btn" @click="openEditModal">
              🖊️ 编辑信息
            </button>
            <button class="action-btn outline" @click="router.back()">返回上一页</button>
          </div>

          <Teleport to="body">
            <div v-if="showEditModal" class="column-modal-overlay" @click="showEditModal = false">
              <div class="column-modal" @click.stop>
                <div class="modal-header">
                  <h3>📝 修改专栏资料</h3>
                  <button class="close-btn" @click="showEditModal = false">×</button>
                </div>
                <div class="modal-body">
                  <div class="quick-create-form">
                    <label class="input-label">专栏名称</label>
                    <input v-model="editForm.name" type="text" class="modal-input" placeholder="输入文件夹名称">

                    <label class="input-label">专栏描述</label>
                    <textarea v-model="editForm.description" class="modal-input" placeholder="写下这个专栏背后的故事..."
                      rows="4"></textarea>

                    <div class="form-ops">
                      <button class="btn-secondary" @click="showEditModal = false">取消</button>
                      <button class="btn-primary" @click="handleSaveInfo" :disabled="isSaving">
                        {{ isSaving ? '同步中...' : '保存修改' }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Teleport>
        </div>
      </div>
    </header>

    <main class="column-articles-container">
      <div v-if="columnData.articles.length > 0" class="articles-list">
        <div v-for="article in columnData.articles" :key="article.id" class="article-item-wrapper">
          <button v-if="isMyColumn" class="remove-article-btn" @click.stop="handleRemoveArticle(article)" title="从专栏移除">
            <span class="cross-icon">×</span>
          </button>
          <ArticleItem v-if="article && article.id" :data="article" @click="router.push({
            path: `/article/${article.id}`,
            query: { type: article.work_type }
          })" />
        </div>
      </div>

      <div v-else class="empty-state">
        <p>📭 这个“文件夹”还是空的哦</p>
        <button class="go-back-btn" @click="router.back()">返回上一页</button>
      </div>
    </main>
  </div>

  <div v-else class="loading-box">
    <div class="spinner"></div>
  </div>
</template>

<style scoped>
.column-detail-page {
  background: #f4f6f8;
  min-height: 100vh;
  padding-bottom: 50px;
}

/* --- 🔥 核心：同步 Profile.vue 的 Header 视觉模型 --- */
.profile-header-flat {
  background: #fff;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  margin-bottom: 20px;
}

.banner-box {
  height: 180px;
  /* 与主页高度一致 */
  overflow: hidden;
  position: relative;
}

.banner-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: filter 0.5s ease;
}

.loading-blur {
  filter: blur(10px);
  opacity: 0.7;
}

.banner-tag {
  position: absolute;
  bottom: 15px;
  right: 20px;
  color: white;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.header-info-container {
  max-width: 900px;
  /* 匹配作品列表宽度 */
  margin: 0 auto;
  padding: 0 20px;
  position: relative;
  top: -50px;
}

.info-content-main {
  display: flex;
  align-items: flex-start;
  gap: 24px;
}

.avatar-box {
  width: 120px;
  height: 120px;
  border-radius: 20px;
  border: 5px solid #fff;
  background: #fff;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-detail {
  flex: 1;
  padding-top: 60px;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 12px;
}

.nickname {
  font-size: 26px;
  font-weight: 800;
  color: #1a1a1a;
  margin: 0;
}

.user-badge {
  font-size: 11px;
  color: #42b883;
  background: rgba(66, 184, 131, 0.1);
  padding: 3px 12px;
  border-radius: 50px;
  font-weight: 600;
  border: 1px solid rgba(66, 184, 131, 0.2);
}

.stats-row-top {
  display: flex;
  gap: 25px;
  margin-bottom: 15px;
  color: #555;
  font-size: 14px;
}

.bio-box {
  background: #f9f9f9;
  padding: 10px 15px;
  border-radius: 8px;
  border-left: 3px solid #42b883;
}

.edit-btn:hover {
  border-color: #42b883 !important;
  color: #42b883 !important;
  background: rgba(66, 184, 131, 0.05) !important;
}

.input-label {
  font-size: 13px;
  font-weight: 700;
  color: #888;
  margin-bottom: 5px;
  display: block;
  text-align: left;
}

.user-bio {
  font-size: 14px;
  color: #5d4a3b;
  line-height: 1.8;
  /* 🔥 重点：确保换行符能正常渲染 */
  white-space: pre-wrap;
  word-break: break-all;
}

.header-actions {
  padding-top: 65px;
}

/* --- 作品列表样式 --- */
.column-articles-container {
  max-width: 900px;
  margin: 0 auto;
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.03);
}

.article-item-wrapper {
  position: relative;
  margin-bottom: 15px;
}

.remove-article-btn {
  position: absolute;
  top: 15px;
  right: 15px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  color: #ff5f7e;
  border: 1px solid #eee;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
  opacity: 0;
  transition: 0.3s;
}

.article-item-wrapper:hover .remove-article-btn {
  opacity: 1;
}

.action-btn.outline {
  padding: 8px 18px;
  border-radius: 50px;
  background: #fff;
  border: 1px solid #e0e0e0;
  color: #555;
  cursor: pointer;
}

/* ==================== 📝 编辑弹窗专属样式 (补全) ==================== */

/* 1. 遮罩层：全屏铺满 + 模糊背景 */
.column-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
  /* 确保在最顶层 */
  animation: fadeIn 0.3s ease;
}

/* 2. 弹窗主体 */
.column-modal {
  background: white;
  width: 90%;
  max-width: 450px;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  animation: slideUp 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
}

.modal-header {
  padding: 20px 25px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #f0f0f0;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: #333;
}

.modal-body {
  padding: 25px;
}

/* 3. 输入框细节 */
.quick-create-form {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.input-label {
  font-size: 13px;
  font-weight: 700;
  color: #888;
  display: block;
  text-align: left;
  margin-bottom: 5px;
}

.modal-input {
  width: 100%;
  padding: 12px 15px;
  border: 1.5px solid #eee;
  border-radius: 10px;
  font-size: 14px;
  transition: all 0.3s;
  background: #fcfcfc;
}

.modal-input:focus {
  border-color: #42b883;
  background: #fff;
  box-shadow: 0 0 0 4px rgba(66, 184, 131, 0.1);
  outline: none;
}

/* 4. 底部操作按钮 */
.form-ops {
  display: flex;
  gap: 12px;
  margin-top: 10px;
}

.btn-secondary {
  flex: 1;
  padding: 12px;
  border-radius: 10px;
  border: none;
  background: #f5f5f5;
  color: #666;
  font-weight: 600;
  cursor: pointer;
  transition: 0.3s;
}

.btn-primary {
  flex: 2;
  padding: 12px;
  border-radius: 10px;
  border: none;
  background: #42b883;
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: 0.3s;
}

.btn-primary:hover {
  background: #3aa876;
  transform: translateY(-2px);
}

.btn-primary:disabled {
  background: #a5d6a7;
  cursor: not-allowed;
}

/* 动画关键帧 */
@keyframes fadeIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    transform: translateY(30px);
    opacity: 0;
  }

  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>