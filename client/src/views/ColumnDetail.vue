<script setup>
// 1. 必须在这里增加 computed 的引入
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '@/utils/api'
import { message } from '@/utils/message'
import ArticleItem from '@/components/ArticleItem.vue'
import { useUserStore } from '@/stores/user.js'

const route = useRoute()
const router = useRouter()

// 2. 必须初始化 userStore 才能使用
const userStore = useUserStore()

const columnData = ref(null)

const fetchColumnContent = async () => {
  try {
    const res = await api.get(`/columns/${route.params.id}`)
    if (res.data.success) {
      columnData.value = res.data.data
    }
  } catch (err) {
    message.error('无法加载专栏内容')
  }
}

// 现在引入了 computed 并且初始化了 userStore，这里就不会报错了
const isMyColumn = computed(() => {
  return columnData.value?.info.user_id === userStore.user?.id
})

// 移除文章函数
const handleRemoveArticle = async (articleId) => {
  if (!confirm('确定要将此文章从专栏中移除吗？')) return

  try {
    const res = await api.delete(`/columns/${route.params.id}/articles/${articleId}`)
    if (res.data.success) {
      message.success('已移除')
      fetchColumnContent() // 重新刷新列表数据
    }
  } catch (err) {
    message.error('移除失败')
  }
}

onMounted(fetchColumnContent)
</script>

<template>
  <div class="column-detail-page" v-if="columnData">
    <header class="column-header">
      <div class="header-content">
        <div class="column-info-main">
          <div class="folder-tag">专题专栏</div>
          <h1 class="column-name">📁 {{ columnData.info.name }}</h1>
          <p class="column-desc">{{ columnData.info.description || '暂无专栏描述' }}</p>
          <div class="column-meta">
            <div class="creator-info" @click="router.push(`/profile/${columnData.info.username}`)">
              <img :src="columnData.info.avatar || 'https://w.wallhaven.cc/full/9o/wallhaven-9oog5d.jpg'"
                class="creator-mini-avatar" alt="creator">
              <span class="creator-name">创建者：{{ columnData.info.nickname || columnData.info.username }}</span>
            </div>

            <span class="divider">|</span>
            <div class="meta-stats">
              <span>📚 共 {{ columnData.articles.length }} 篇文章</span>
            </div>
          </div>
        </div>
      </div>
    </header>

    <main class="column-articles-container">
      <div v-if="columnData.articles.length > 0" class="articles-list">
        <div v-for="article in columnData.articles" :key="article.id" class="article-item-wrapper">
          <button v-if="isMyColumn" class="remove-article-btn" @click.stop="handleRemoveArticle(article.id)"
            title="从专栏移除">
            <span class="cross-icon">×</span>
          </button>

          <ArticleItem :data="article" @click="router.push(`/article/${article.id}`)" />
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
  padding-bottom: 60px;
}

.column-header {
  background: white;
  padding: 60px 0 40px;
  border-bottom: 1px solid #eee;
  margin-bottom: 30px;
}

.header-content {
  max-width: 900px;
  margin: 0 auto;
  padding: 0 20px;
}

.folder-tag {
  display: inline-block;
  background: #42b883;
  color: white;
  padding: 2px 10px;
  border-radius: 4px;
  font-size: 12px;
  margin-bottom: 15px;
}

.column-name {
  font-size: 32px;
  font-weight: 800;
  color: #1a1a1a;
  margin: 0 0 15px 0;
}

.column-desc {
  font-size: 16px;
  color: #666;
  line-height: 1.6;
  margin-bottom: 20px;
}

.column-meta {
  display: flex;
  align-items: center;
  gap: 15px;
  color: #666;
  font-size: 14px;
}

.creator-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: color 0.2s;
}

.creator-info:hover {
  color: #42b883;
  /* 悬停时变色 */
}

.creator-mini-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid #eee;
}

.meta-stats {
  color: #999;
}

.divider {
  color: #eee;
}

.column-articles-container {
  max-width: 900px;
  margin: 0 auto;
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.03);
}

.empty-state {
  padding: 100px 0;
  text-align: center;
  color: #999;
}

.go-back-btn {
  margin-top: 20px;
  padding: 8px 20px;
  border-radius: 20px;
  border: 1px solid #ddd;
  background: white;
  cursor: pointer;
}

.loading-box {
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
}

.article-item-wrapper {
  position: relative;
  /* 为移除按钮提供定位基准 */
}

.remove-article-btn {
  position: absolute;
  top: 15px;
  right: 15px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #eee;
  color: #ff5f7e;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
  opacity: 0;
  /* 默认隐藏 */
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* 鼠标悬浮在卡片上时显示移除按钮 */
.article-item-wrapper:hover .remove-article-btn {
  opacity: 1;
  transform: scale(1.1);
}

.remove-article-btn:hover {
  background: #ff5f7e;
  color: white;
  border-color: #ff5f7e;
}

.cross-icon {
  line-height: 1;
  margin-top: -2px;
  /* 微调交叉位置 */
}
</style>