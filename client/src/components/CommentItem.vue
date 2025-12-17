<script setup>
import { ref, computed } from 'vue'
import { useUserStore } from '@/stores/user.js'

// 1. 定义组件名称，用于递归调用
defineOptions({
    name: 'CommentItem'
})

const props = defineProps({
    comment: {
        type: Object,
        required: true
    },
    // 记录视觉层级，用于控制缩进
    depth: {
        type: Number,
        default: 0
    }
})

const emit = defineEmits(['reply', 'like', 'dislike', 'delete'])
const userStore = useUserStore()
const currentUser = computed(() => userStore.user || {})
const isAdmin = computed(() => userStore.user?.role === 'admin')

// 状态：是否展开子评论
const isExpanded = ref(true)

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

// 代理事件：将底层触发的事件层层向上传递
const handleAction = (type, payload) => emit(type, payload)
// 代理事件向上抛出
const onReply = (targetComment) => emit('reply', targetComment)
const onLike = (targetComment) => emit('like', targetComment)
const onDislike = (targetComment) => emit('dislike', targetComment)
const onDelete = (targetId) => emit('delete', targetId)

// 递归事件处理
const handleChildReply = (target) => emit('reply', target)
const handleChildLike = (target) => emit('like', target)
const handleChildDislike = (target) => emit('dislike', target)
const handleChildDelete = (id) => emit('delete', id)
</script>

<template>
    <div class="comment-item-wrapper">
        <div class="yt-comment-container" :class="{ 'reply-style': depth > 0 }">
            <img :src="comment.avatar || 'https://i.pravatar.cc/150?img=1'" class="avatar"
                :class="{ small: depth > 0 }" />

            <div class="comment-body">
                <div class="comment-header-line">
                    <span class="username">@{{ comment.nickname }}</span>
                    <span class="time">{{ formatRelativeTime(comment.created_at) }}</span>
                </div>

                <div class="comment-text">
                    <span v-if="depth > 0 && comment.parent_id" class="reply-tag">
                    </span>
                    {{ comment.content }}

                    <div v-if="comment.images?.length" class="comment-images-grid">
                        <img v-for="(img, i) in comment.images" :key="i" :src="img" />
                    </div>
                </div>

                <div class="comment-actions">
                    <button class="action-btn" :class="{ active: comment.is_liked }" @click="emit('like', comment)">
                        <span class="icon">👍</span>
                        <span v-if="comment.like_count">{{ comment.like_count }}</span>
                    </button>

                    <button class="action-btn" :class="{ active: comment.is_disliked }"
                        @click="emit('dislike', comment)">
                        <span class="icon">👎</span>
                    </button>

                    <button class="action-btn reply-btn" @click="emit('reply', comment)">回复</button>

                    <button v-if="isAdmin || currentUser.username === comment.nickname" class="action-btn delete-btn"
                        @click="emit('delete', comment.id)">删除</button>
                </div>
            </div>
        </div>

        <div v-if="comment.replies && comment.replies.length > 0" class="sub-comments-container">
            <div class="sub-comments-list" :class="{ 'no-indent': depth >= 3 }">
                <CommentItem v-for="reply in comment.replies" :key="reply.id" :comment="reply" :depth="depth + 1"
                    @reply="(c) => emit('reply', c)" @like="(c) => emit('like', c)" @dislike="(c) => emit('dislike', c)"
                    @delete="(id) => emit('delete', id)" />
            </div>
        </div>
    </div>
</template>

<style scoped>
/* 评论容器布局 */
.yt-comment-container {
    display: flex;
    gap: 16px;
    padding: 8px 0;
}

.avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    flex-shrink: 0;
    object-fit: cover;
    /* 🔥🔥🔥 必须加这一行！🔥🔥🔥 */
    background-color: #eee;
    /* 可选：加个底色 */
    border: 1px solid rgba(0, 0, 0, 0.05);
    /* 可选：加个微弱边框让浅色头像更明显 */
}

.avatar.small {
    width: 32px;
    height: 32px;
    object-fit: cover;
    /* 🔥🔥🔥 这里也要加，保险起见 🔥🔥🔥 */
}

.comment-body {
    flex: 1;
    min-width: 0;
}

.comment-header-line {
    margin-bottom: 4px;
    font-size: 0.85rem;
    color: #606060;
}

.username {
    font-weight: 600;
    color: #0f0f0f;
    margin-right: 8px;
}

.comment-text {
    font-size: 0.95rem;
    color: #0f0f0f;
    line-height: 1.5;
    margin-bottom: 6px;
}

.comment-actions {
    display: flex;
    gap: 16px;
    align-items: center;
}

.action-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.8rem;
    color: #606060;
    display: flex;
    align-items: center;
    gap: 4px;
}

.action-btn:hover {
    color: #0f0f0f;
}

.action-btn.active {
    color: #065fd4;
}

.delete-btn {
    color: #d32f2f;
}

/* 🔥 递归缩进样式 🔥 */
.sub-comments-container {
    /* 每一级向右缩进 */
    margin-left: 48px;
}

/* 移动端或深层级不再缩进，改为平铺 */
.sub-comments-list.no-indent {
    padding-left: 0;
    margin-left: 0;
    /* 可选：加个左边框区分层级 */
    border-left: 2px solid #eee;
    padding-left: 10px;
}

.comment-images-grid img {
    max-width: 150px;
    border-radius: 8px;
    margin-top: 5px;
}
</style>