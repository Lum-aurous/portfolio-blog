<script setup>
import { ref, computed, inject } from 'vue'
import { useUserStore } from '@/stores/user.js'

// 🔥 接收来自 ArticleDetail 的广播函数
const triggerLightbox = inject('triggerLightbox')

// 定义组件名称，用于递归调用
defineOptions({
    name: 'CommentItem'
})

const props = defineProps({
    comment: {
        type: Object,
        required: true
    },
    depth: {
        type: Number,
        default: 0
    },
    articleAuthorId: [Number, String] // 🔥 接收博主 ID
})

// 1. 判断该评论者是不是文章作者
const isArticleAuthor = computed(() => {
    // 🔥 修正：对比“当前评论者ID”和“父组件传下来的文章作者ID”
    const commenterId = props.comment.commenter_id || props.comment.user_id;
    
    // 使用 Number 强制转换，防止 String 和 Number 匹配失败
    return Number(commenterId) === Number(props.articleAuthorId);
})

// 2. 作者是否赞过（直接用后端传来的布尔值）
const isAuthorLiked = computed(() => props.comment.author_liked)

const emit = defineEmits(['reply', 'like', 'dislike', 'delete'])
const userStore = useUserStore()

// 🔥 核心权限判断：是否可以显示删除按钮
const canDelete = computed(() => {
    const user = userStore.user;
    if (!user) return false;

    // 管理员直接放行
    if (user.role === 'admin') return true;

    // 🔥 修改这里：用当前登录的唯一 username，比对评论对象的唯一 author_username
    return user.username === props.comment.author_username;
})

// 状态：是否展开子评论
const isExpanded = ref(false)

// 格式化时间
const formatRelativeTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return '刚刚';
    if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)} 天前`;
    if (diff < 31536000) return `${Math.floor(diff / 2592000)} 个月前`;
    return `${Math.floor(diff / 31536000)} 年前`;
}

const formatCount = (count) => {
    if (!count) return '';
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count;
}

// 递归计算总回复数（包括所有嵌套的子回复）
const getTotalRepliesCount = (comment) => {
    if (!comment.replies || comment.replies.length === 0) {
        return 0;
    }

    let total = comment.replies.length;

    // 递归计算每个子回复的回复数
    comment.replies.forEach(reply => {
        total += getTotalRepliesCount(reply);
    });

    return total;
}

// 计算当前评论的总回复数
const totalRepliesCount = computed(() => getTotalRepliesCount(props.comment));

// 切换回复显示/隐藏
const toggleReplies = () => {
    isExpanded.value = !isExpanded.value
}
</script>

<template>
    <div class="comment-item-wrapper" :class="{ 'is-reply': depth > 0 }">
        <div class="comment-item">
            <!-- 头像 -->
            <img :src="comment.avatar || 'https://i.pravatar.cc/150?img=1'" class="avatar"
                :class="{ 'reply-avatar': depth > 0 }" />

            <!-- 评论内容 -->
            <div class="comment-content">
                <!-- 用户信息和时间 -->
                <div class="comment-header">
                    <span class="comment-author">@{{ comment.nickname }}</span>

                    <span v-if="isArticleAuthor" class="author-text-green">作者</span>

                    <span class="comment-time">{{ formatRelativeTime(comment.created_at) }}</span>
                </div>

                <div class="comment-text">
                    {{ comment.content }}
                    <div v-if="isAuthorLiked" class="author-liked-italic">
                        <span class="heart-icon">❤️</span> 作者赞过
                    </div>
                </div>

                <!-- 图片展示 -->
                <div v-if="comment.images?.length" class="comment-images">
                    <img v-for="(img, i) in comment.images" :key="i" :src="img" class="comment-image"
                        @click="triggerLightbox(img)" title="点击查看大图" />
                </div>

                <!-- 操作按钮 -->
                <div class="comment-actions">
                    <!-- 点赞 -->
                    <button class="action-btn" :class="{ active: comment.is_liked }" @click="emit('like', comment)"
                        title="点赞">
                        <svg viewBox="0 0 24 24" width="16" height="16">
                            <path fill="currentColor"
                                d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" />
                        </svg>
                    </button>

                    <span v-if="comment.like_count > 0" class="count-text">
                        {{ formatCount(comment.like_count) }}
                    </span>

                    <!-- 点踩 -->
                    <button class="action-btn" :class="{ active: comment.is_disliked }"
                        @click="emit('dislike', comment)" title="点踩">
                        <svg viewBox="0 0 24 24" width="16" height="16" style="transform: rotate(180deg)">
                            <path fill="currentColor"
                                d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" />
                        </svg>
                    </button>

                    <!-- 回复按钮 -->
                    <button class="reply-btn" @click="emit('reply', comment)">
                        Reply
                    </button>

                    <!-- 删除按钮 -->
                    <button v-if="canDelete" class="delete-btn" @click="emit('delete', comment.id)">
                        <svg viewBox="0 0 24 24" width="16" height="16">
                            <path fill="currentColor"
                                d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                        </svg>
                    </button>
                </div>

                <!-- 回复区域 -->
                <div v-if="comment.replies && comment.replies.length > 0" class="replies-section">
                    <!-- 展开/收起按钮 -->
                    <button class="toggle-replies-btn" @click="toggleReplies">
                        <svg class="chevron-icon" :class="{ expanded: isExpanded }" viewBox="0 0 24 24" width="24"
                            height="24">
                            <path fill="#065fd4" d="M9.4 18L8 16.6l4.6-4.6L8 7.4 9.4 6l6 6z" />
                        </svg>
                        <span class="replies-count">
                            {{ isExpanded ? 'Hide' : totalRepliesCount }}
                            {{ isExpanded ? 'replies' : (totalRepliesCount === 1 ? 'reply' : 'replies') }}
                        </span>
                    </button>

                    <!-- 回复列表 -->
                    <div v-show="isExpanded" class="replies-list">
                        <CommentItem v-for="reply in comment.replies" :key="reply.id" :comment="reply"
                            :article-author-id="props.articleAuthorId" :depth="depth + 1"
                            @reply="(c) => emit('reply', c)" @like="(c) => emit('like', c)"
                            @dislike="(c) => emit('dislike', c)" @delete="(id) => emit('delete', id)" />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* 评论容器 */
.comment-item-wrapper {
    margin-bottom: 8px;
}

.comment-item {
    display: flex;
    gap: 12px;
}

/* 回复样式 - 添加左侧竖线 */
.is-reply {
    margin-left: 40px;
    padding-left: 12px;
    position: relative;
}

.is-reply::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 8px;
    width: 2px;
    background-color: #e5e5e5;
}

/* 头像 */
.avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
    background-color: #f1f1f1;
}

.reply-avatar {
    width: 24px;
    height: 24px;
}

/* 评论内容区 */
.comment-content {
    flex: 1;
    min-width: 0;
}

/* 评论头部 */
.comment-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 2px;
}

.comment-author {
    font-size: 13px;
    font-weight: 500;
    color: #0f0f0f;
    line-height: 18px;
}

.comment-time {
    font-size: 12px;
    color: #606060;
    line-height: 18px;
}

/* 评论正文 */
.comment-text {
    font-size: 14px;
    line-height: 20px;
    color: #0f0f0f;
    margin-bottom: 4px;
    word-wrap: break-word;
    white-space: pre-wrap;
}

/* 评论图片 */
.comment-images {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 4px;
    margin-bottom: 4px;
}

.comment-image {
    max-width: 200px;
    max-height: 200px;
    border-radius: 12px;
    object-fit: cover;
}

/* 操作按钮区域 */
.comment-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 2px;
    margin-bottom: 4px;
    height: 36px;
}

.action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: transparent;
    border: none;
    color: #0f0f0f;
    cursor: pointer;
    transition: all 0.2s;
    padding: 0;
    flex-shrink: 0;
}

.action-btn:hover {
    background-color: rgba(0, 0, 0, 0.05);
}

.action-btn.active {
    color: #065fd4;
}

.count-text {
    font-size: 12px;
    color: #606060;
    font-weight: 500;
    margin-right: 4px;
    line-height: 36px;
    height: 36px;
    display: flex;
    align-items: center;
}

.reply-btn {
    font-size: 12px;
    font-weight: 500;
    color: #0f0f0f;
    background: transparent;
    border: none;
    padding: 0 12px;
    height: 36px;
    border-radius: 18px;
    cursor: pointer;
    transition: background-color 0.2s;
    line-height: 36px;
    display: flex;
    align-items: center;
    flex-shrink: 0;
}

.reply-btn:hover {
    background-color: rgba(0, 0, 0, 0.05);
}

.delete-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: transparent;
    border: none;
    color: #606060;
    cursor: pointer;
    transition: all 0.2s;
    padding: 0;
    margin-left: auto;
    flex-shrink: 0;
}

.delete-btn:hover {
    background-color: rgba(255, 0, 0, 0.1);
    color: #ff0000;
}

/* 回复区域 */
.replies-section {
    margin-top: 8px;
}

.toggle-replies-btn {
    display: flex;
    align-items: center;
    gap: 12px;
    background: transparent;
    border: none;
    color: #065fd4;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    padding: 4px 0;
    transition: all 0.2s;
    height: 36px;
}

.toggle-replies-btn:hover {
    color: #0d45a5;
}

.chevron-icon {
    transition: transform 0.2s;
    flex-shrink: 0;
}

.chevron-icon.expanded {
    transform: rotate(90deg);
}

.replies-count {
    line-height: 20px;
}

.replies-list {
    margin-top: 8px;
}

/* 移动端适配 */
@media (max-width: 768px) {
    .comment-item {
        gap: 10px;
    }

    .avatar {
        width: 32px;
        height: 32px;
    }

    .reply-avatar {
        width: 24px;
        height: 24px;
    }

    .is-reply {
        margin-left: 32px;
        padding-left: 10px;
    }

    .comment-author {
        font-size: 12px;
    }

    .comment-text {
        font-size: 13px;
    }

    .comment-images {
        gap: 6px;
    }

    .comment-image {
        max-width: 150px;
        max-height: 150px;
    }

    .action-btn,
    .delete-btn {
        width: 32px;
        height: 32px;
    }

    .reply-btn {
        height: 32px;
        padding: 0 10px;
        font-size: 11px;
    }

    .count-text {
        height: 32px;
    }

    .comment-actions {
        height: 32px;
    }

    .toggle-replies-btn {
        height: 32px;
        gap: 8px;
    }
}

@media (max-width: 480px) {
    .comment-item {
        gap: 8px;
    }

    .avatar {
        width: 24px;
        height: 24px;
    }

    .is-reply {
        margin-left: 24px;
        padding-left: 8px;
    }

    .comment-item-wrapper {
        margin-bottom: 6px;
    }
}

/* 作者标签：名字旁边的 */
.author-text-green {
    color: #48cbb6;
    /* 还原图二的青绿色 */
    font-size: 12px;
    font-weight: 600;
    margin-left: 8px;
    font-family: "Kaiti", "STKaiti", serif;
    /* 增加一点人文气息 */
}

/* “作者赞过”：内容下方的 */
.author-liked-italic {
    color: #82cc9d;
    /* 还原图一的淡绿色 */
    font-size: 13px;
    font-style: italic;
    /* 必须是斜体 */
    margin-top: 6px;
    font-family: "Kaiti", "STKaiti", serif;
}

.heart-icon {
    display: inline-block;
    color: #ff5f7e;
    /* 既然是作者的爱心，可以用粉红色 */
    font-size: 10px;
    margin-right: 2px;
}

/* 灯箱遮罩层 */
.lightbox-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.9);
    /* 深色背景 */
    z-index: 30000;
    /* 确保在所有弹窗之上 */
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: zoom-out;
    backdrop-filter: blur(10px);
}

/* 内容容器 */
.lightbox-content {
    position: relative;
    max-width: 90vw;
    max-height: 90vh;
    display: flex;
    justify-content: center;
    align-items: center;
}

/* 图片本体 */
.lightbox-image {
    max-width: 100%;
    max-height: 90vh;
    object-fit: contain;
    border-radius: 8px;
    box-shadow: 0 0 30px rgba(0, 0, 0, 0.5);
    animation: zoom-in 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

/* 关闭按钮 */
.lightbox-close-btn {
    position: fixed;
    top: 20px;
    right: 30px;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: white;
    font-size: 30px;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    cursor: pointer;
    transition: 0.3s;
    display: flex;
    justify-content: center;
    align-items: center;
}

.lightbox-close-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: rotate(90deg);
}

/* 进场动画 */
@keyframes zoom-in {
    from {
        transform: scale(0.8);
        opacity: 0;
    }

    to {
        transform: scale(1);
        opacity: 1;
    }
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>