<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/utils/api'
import { message } from '@/utils/message.js'
import MarkdownIt from 'markdown-it'
import 'github-markdown-css/github-markdown-light.css'

const router = useRouter()
const md = new MarkdownIt({ html: true, linkify: true, breaks: true })

// ==================== 状态管理 ====================
const activeTab = ref('article')
const isSubmitting = ref(false)
const sysCategories = ref([]) // 公共频道数据
const userColumns = ref([])    // 个人专栏数据
const showNewColumnModal = ref(false);
const newColumnName = ref('');
const newColumnDesc = ref(''); // 🔥 新增：专栏描述状态
// ✅ 1. 优化后的表单结构（增加摘要）
const articleForm = ref({
    title: '',
    summary: '',     // 🔥 必须添加，否则后端验证不通过
    content: '',
    category: '',
    column_id: null,
    cover_image: ''
})

// 2. 获取公共频道 (sys_categories 表)
const fetchCategories = async () => {
    try {
        const res = await api.get('/categories')
        if (res.data.success) {
            sysCategories.value = res.data.data // 存入对象数组 [{name, icon...}]
            // 默认选中第一个
            if (sysCategories.value.length > 0) {
                articleForm.value.category = sysCategories.value[0].name
            }
        }
    } catch (err) {
        console.error("加载频道失败:", err)
    }
}

// 3. 获取我的专栏列表 (从后端简单接口获取)
const fetchUserColumns = async () => {
    try {
        const res = await api.get('/user/columns/simple')
        if (res.data.success) {
            userColumns.value = res.data.data // [{id, name}]
        }
    } catch (err) {
        console.error("加载专栏失败:", err)
    }
}

// 4. 处理专栏切换
// ✅ 检查：确保 handleColumnChange 包含了 audio 分支
const handleColumnChange = () => {
    let currentColumnId;

    // 💡 自动识别当前处于哪个创作模式并读取对应表单的 ID
    if (activeTab.value === 'article') {
        currentColumnId = articleForm.value.column_id;
    } else if (activeTab.value === 'video') {
        currentColumnId = videoForm.value.column_id;
    } else if (activeTab.value === 'audio') {
        currentColumnId = audioForm.value.column_id; // 🔥 确保这一行存在
    }

    if (currentColumnId === '__new_column__') {
        showNewColumnModal.value = true;

        // 🔑 立即重置该表单的 ID，防止关闭弹窗后下拉框依然卡在“开启新专栏”这一项上
        if (activeTab.value === 'article') articleForm.value.column_id = null;
        else if (activeTab.value === 'video') videoForm.value.column_id = null;
        else if (activeTab.value === 'audio') audioForm.value.column_id = null; // 🔥 确保这一行存在
    }
}

// 6. 确认建立新专栏
// ✅ 检查：确保 confirmAddColumn 包含了 audio 的自动回填
const confirmAddColumn = async () => {
    if (!newColumnName.value.trim()) return message.warning('请输入专栏名称');

    try {
        const res = await api.post('/columns', {
            name: newColumnName.value,
            description: newColumnDesc.value // 我们之前优化的描述字段
        });

        if (res.data.success) {
            const newId = res.data.data.id;
            message.success('新专栏已开启，描述已同步');

            await fetchUserColumns(); // 重新拉取最新的专栏列表

            // 🔥 核心回填逻辑：根据当前 activeTab 自动选中新创建的专栏
            if (activeTab.value === 'article') {
                articleForm.value.column_id = newId;
            } else if (activeTab.value === 'video') {
                videoForm.value.column_id = newId;
            } else if (activeTab.value === 'audio') {
                audioForm.value.column_id = newId; // 👈 确保音频也能自动“钩中”新专栏
            }

            // 关闭并清空弹窗
            showNewColumnModal.value = false;
            newColumnName.value = '';
            newColumnDesc.value = '';
        }
    } catch (err) {
        message.error('创建失败: ' + err.message);
    }
}

const renderedPreview = computed(() => md.render(articleForm.value.content || '*灵感实时预览...*'))
const isSuccess = ref(false) // 是否发布成功，用于触发火漆印章动画

const submitArticle = async () => {
    if (!articleForm.value.title.trim()) return message.warning('标题不可留白');
    if (!articleForm.value.content.trim()) return message.warning('请挥洒你的思绪');

    // 自动兜底摘要
    if (!articleForm.value.summary.trim()) {
        articleForm.value.summary = articleForm.value.content.substring(0, 80).replace(/[#*`>]/g, '') + '...';
    }

    isSubmitting.value = true;
    try {
        const res = await api.post('/articles', articleForm.value);
        if (res.data.success) {
            // 🔥 第一步：标记成功，开始动画流程
            isSuccess.value = true;

            // 🔥 第二步：等待 1.5 秒（留给印章落下和信封飞出的时间），再跳转
            setTimeout(() => {
                message.success('✨ 灵感已封缄寄出！');
                router.push('/blog');
            }, 1800);
        }
    } catch (err) {
        message.error('封缄失败，请检查笔墨与网络');
        isSubmitting.value = false;
    }
}

/**
    视频发布
 */

// 🎬 视频表单状态
const videoForm = ref({
    title: '',
    description: '',
    video_url: '',
    cover_url: '',
    category: '',
    column_id: null
})

// 上传进度控制
const uploadProgress = ref(0);
const isUploading = ref(false);

// 视频预览
const videoPreview = ref(null);
const videoCoverPreview = ref(null);

// 引用文件输入框
const videoInput = ref(null)
const coverInput = ref(null)

// 1. 🎬 视频素材上传逻辑
const onVideoFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 💡 1. 检查文件类型 (保持原有逻辑)
    if (!['video/mp4', 'video/quicktime'].includes(file.type)) {
        return message.error('仅支持 MP4 或 MOV 格式的影片');
    }

    // 🔥 2. 新增：检查文件体积 (与后端 500MB 保持一致)
    const maxSize = 500 * 1024 * 1024; // 500MB
    if (file.size > maxSize) {
        return message.error(`该影片太沉重了（超过500MB），请压缩后再试`);
    }

    // 💡 3. 执行上传逻辑 (保持原有逻辑)
    const formData = new FormData();
    formData.append('video', file);

    isUploading.value = true;
    uploadProgress.value = 0;

    try {
        videoForm.value.video_url = URL.createObjectURL(file);

        // 💡 关键修改：显式指定 headers 为空，让浏览器自动计算 multipart/form-data 和 boundary
        const res = await api.post('/upload/video', formData, {
            headers: {
                'Content-Type': undefined // 👈 这一行非常关键，它能强迫 Axios 重新计算 Content-Type
            },
            onUploadProgress: (p) => {
                uploadProgress.value = Math.round((p.loaded * 100) / p.total);
            }
        });

        if (res.data.success) {
            videoForm.value.video_url = res.data.data.url;
            message.success('🎬 映画素材已成功存入制片厂库');
        }
    } catch (err) {
        // 💡 调试日志：捕获具体报错
        console.error("❌ 上传响应状态:", err.response?.status);
        console.error("❌ 上传错误数据:", err.response?.data);

        message.error(err.response?.data?.message || '素材载入失败，请检查网络或文件大小');
        videoForm.value.video_url = '';
    } finally {
        isUploading.value = false;
    }
};

// 2. 🎨 视频封面（海报）上传逻辑
const onCoverFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file); // 💡 使用通用上传接口的 "image" 字段

    try {
        const res = await api.post('/upload', formData);
        if (res.data.success) {
            videoForm.value.cover_url = res.data.data.url;
            message.success('✨ 艺术海报已就绪');
        }
    } catch (err) {
        message.error('海报上传失败');
    }
};

// 发布视频提交
const submitVideo = async () => {
    if (!videoForm.value.title.trim()) return message.warning('请命名您的作品');
    if (!videoForm.value.video_url) return message.warning('请上传灵感视频');

    isSubmitting.value = true;
    try {
        const res = await api.post('/videos', videoForm.value);
        if (res.data.success) {
            isSuccess.value = true; // 触发火漆印章动画
            setTimeout(() => {
                message.success('🎬 灵感映画已封缄展出！');
                router.push('/blog');
            }, 1800);
        }
    } catch (err) {
        message.error('展出失败，请重试');
        isSubmitting.value = false;
    }
};

// ==================== 🛠️ 补全缺失的工具函数 (解决 getProxyUrl 报错) ====================

const getProxyUrl = (url) => {
    // 💡 处理空值情况
    if (!url || url === 'null' || url === 'undefined') {
        return 'https://images.unsplash.com/photo-1514525253361-bee8718a300c?w=500' // 默认唱片占位图
    }
    // 💡 如果是本地上传路径，直接返回
    if (url.startsWith('/uploads') || url.startsWith('data:') || url.startsWith('/api')) {
        return url
    }
    // 💡 如果是外部图片，走代理逻辑（防止跨域）
    const isDev = import.meta.env.VITE_APP_ENV === 'development'
    const apiBase = isDev ? import.meta.env.VITE_API_TARGET : window.location.origin
    return `${apiBase}/api/proxy-image?url=${encodeURIComponent(url)}`
}

// ==================== 📻 音频相关 Ref 引用 (修复点击报错) ====================

// 1. 定义音频实时播放状态
const isAudioPlaying = ref(false);

// 2. 定义播放状态处理函数
const handleAudioPlay = () => {
    isAudioPlaying.value = true;
};

const handleAudioPause = () => {
    isAudioPlaying.value = false;
};

// --- 📻 音频表单状态声明 (如果之前漏掉了请补上) ---
const audioForm = ref({
    title: '',
    description: '',
    audio_url: '',
    cover_url: '',
    category: '音乐',
    column_id: null
})

// 2. 定义上传按钮的 DOM 引用（解决之前 $refs 访问报错）
const audioFileRef = ref(null)
const audioCoverRef = ref(null)

const isAudioUploading = ref(false)
const audioUploadProgress = ref(0)

// --- 📻 音频素材上传逻辑 ---
const onAudioFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.includes('audio')) return message.error('请选择有效的音频格式')

    const formData = new FormData()
    formData.append('audio', file)

    isAudioUploading.value = true
    try {
        const res = await api.post('/upload/audio', formData, {
            headers: { 'Content-Type': undefined },
            onUploadProgress: (p) => {
                audioUploadProgress.value = Math.round((p.loaded * 100) / p.total)
            }
        })
        if (res.data.success) {
            audioForm.value.audio_url = res.data.data.url
            message.success('📻 旋律素材已载入唱片库')
        }
    } catch (err) {
        message.error('音频载入失败')
    } finally {
        isAudioUploading.value = false
    }
}

// --- 📻 唱片封面上传逻辑 ---
const onAudioCoverChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const formData = new FormData()
    formData.append('image', file)
    try {
        const res = await api.post('/upload', formData)
        if (res.data.success) {
            audioForm.value.cover_url = res.data.data.url
            message.success('✨ 艺术海报已就绪')
        }
    } catch (err) { message.error('海报上传失败') }
}

// --- 📻 音频发布提交 ---
const submitAudio = async () => {
    if (!audioForm.value.title.trim()) return message.warning('请为旋律命名')
    if (!audioForm.value.audio_url) return message.warning('请上传音频素材')

    isSubmitting.value = true
    try {
        const res = await api.post('/audios', audioForm.value)
        if (res.data.success) {
            isSuccess.value = true
            setTimeout(() => {
                message.success('📻 旋律已在星空下公开发行')
                router.push('/blog')
            }, 1800)
        }
    } catch (err) {
        message.error('封缄失败')
        isSubmitting.value = false
    }
}

// 监听分类列表变化，默认给视频一个分类
watch(sysCategories, (newVal) => {
    if (newVal.length > 0 && !videoForm.value.category) {
        videoForm.value.category = newVal[0].name
    }
})

onMounted(() => {
    fetchCategories()
    fetchUserColumns()
})
</script>

<template>
    <div class="creation-page">
        <header class="creation-header crystal-card animate__animated animate__fadeInDown">
            <div class="header-left" @click="router.back()">
                <div class="back-btn">←</div>
                <h2 class="hub-title">创作中心 <small>CREATOR HUB</small></h2>
            </div>
            <div class="header-right">
                <span class="user-slogan">今天，你想记录什么？</span>
            </div>
        </header>

        <div class="creation-main-layout">

            <aside class="creation-sidebar crystal-card animate__animated animate__fadeInLeft">
                <div class="nav-group">
                    <p class="group-label">✨ 发布灵感</p>
                    <div class="nav-item" :class="{ active: activeTab === 'article' }" @click="activeTab = 'article'">
                        <span class="icon">📝</span> 文章
                    </div>
                    <div class="nav-item" :class="{ active: activeTab === 'video' }" @click="activeTab = 'video'">
                        <span class="icon">🎬</span> 视频
                    </div>
                    <div class="nav-item" :class="{ active: activeTab === 'audio' }" @click="activeTab = 'audio'">
                        <span class="icon">📻</span> 音频
                    </div>
                    <div class="nav-item" :class="{ active: activeTab === 'short' }" @click="activeTab = 'short'">
                        <span class="icon">📸</span> 图文
                    </div>
                </div>

                <div class="nav-group">
                    <p class="group-label">📦 我的作品</p>
                    <div class="nav-item" :class="{ active: activeTab === 'works' }" @click="activeTab = 'works'">
                        <span class="icon">📁</span> 作品管理
                    </div>
                </div>

                <div class="nav-group">
                    <p class="group-label">🤝 互动社区</p>
                    <div class="nav-item" :class="{ active: activeTab === 'fans' }" @click="activeTab = 'fans'">
                        <span class="icon">💖</span> 粉丝
                    </div>
                    <div class="nav-item" :class="{ active: activeTab === 'follows' }" @click="activeTab = 'follows'">
                        <span class="icon">🎈</span> 关注
                    </div>
                    <div class="nav-item" :class="{ active: activeTab === 'comments' }" @click="activeTab = 'comments'">
                        <span class="icon">💬</span> 评论
                    </div>
                </div>
            </aside>

            <main class="creation-workspace animate__animated animate__fadeIn">
                <section v-if="activeTab === 'article'" class="workspace-card mediterranean-theme animate__animated"
                    :class="{ 'is-sealed': isSuccess }">
                    <div v-if="isSuccess" class="wax-seal-stamp animate__animated animate__bounceInDown">
                        <div class="seal-inner">V</div>
                    </div>

                    <div class="studio-header">
                        <input v-model="articleForm.title" class="elegant-title-input"
                            placeholder="Per favore, 输入灵感标题...">

                        <div class="summary-input-container">
                            <input v-model="articleForm.summary" class="elegant-summary-input"
                                placeholder="Breve riassunto / 输入这段灵感的引言 (可选)...">
                        </div>

                        <div class="header-divider"></div>
                    </div>

                    <div class="studio-body">
                        <div class="paper-editor-container">
                            <div class="label-tag">Draft / 草稿箱</div>
                            <textarea v-model="articleForm.content" placeholder="在此流淌你的思绪 (支持 Markdown)..."
                                class="italian-textarea"></textarea>
                        </div>

                        <div class="paper-preview-container">
                            <div class="label-tag">Preview / 艺术预览</div>
                            <div class="markdown-body parchment-view" v-html="renderedPreview"></div>
                        </div>
                    </div>

                    <div class="studio-footer">
                        <div class="footer-inner-layout">
                            <div class="config-group">
                                <div class="med-select-wrapper">
                                    <span class="med-label">Canale / 公共频道</span>
                                    <div class="select-box-styled">
                                        <select v-model="articleForm.category" class="med-select">
                                            <option v-for="cat in sysCategories" :key="cat.id" :value="cat.name">
                                                {{ cat.icon }} {{ cat.name }}
                                            </option>
                                        </select>
                                    </div>
                                </div>

                                <div class="med-select-wrapper">
                                    <span class="med-label">Collezione / 个人专栏</span>
                                    <div class="select-box-styled">
                                        <select v-model="articleForm.column_id" class="med-select"
                                            @change="handleColumnChange">
                                            <option :value="null">-- 不归入专栏 --</option>
                                            <option v-for="col in userColumns" :key="col.id" :value="col.id">
                                                📘 {{ col.name }}
                                            </option>
                                            <option value="__new_column__" class="new-col-opt">+ 开启新专栏...</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <button class="med-publish-btn" @click="submitArticle" :disabled="isSubmitting">
                                <span>{{ isSubmitting ? '正在密封灵感...' : 'PUBLISH / 立即发布' }}</span>
                            </button>
                        </div>
                    </div>
                </section>

                <section v-else-if="activeTab === 'video'"
                    class="workspace-card mediterranean-theme animate__animated animate__fadeIn"
                    :class="{ 'is-sealed': isSuccess }">

                    <div v-if="isSuccess" class="wax-seal-stamp animate__animated animate__bounceInDown">
                        <div class="seal-inner">V</div>
                    </div>

                    <div class="studio-header">
                        <input v-model="videoForm.title" class="elegant-title-input"
                            placeholder="Cinematografia / 灵感映画标题...">
                        <div class="summary-input-container">
                            <input v-model="videoForm.description" class="elegant-summary-input"
                                placeholder="Breve trama / 为这段光影写一段引言...">
                        </div>
                        <div class="header-divider"></div>
                    </div>

                    <div class="studio-body video-studio-layout">

                        <div class="upload-top-row">
                            <div class="studio-upload-box" @click="videoInput.click()">
                                <div class="box-content">
                                    <span class="box-icon">📽️</span>
                                    <p>{{ videoForm.video_url ? '🎬 素材已载入' : '选择视频文件' }}</p>
                                    <small>MP4 / MOV (100MB以内)</small>
                                </div>
                                <input type="file" ref="videoInput" hidden accept="video/*" @change="onVideoFileChange">
                            </div>

                            <div class="studio-upload-box" @click="coverInput.click()">
                                <div class="box-content">
                                    <span class="box-icon">🎨</span>
                                    <p>{{ videoForm.cover_url ? '✨ 海报已就绪' : '设置视频海报' }}</p>
                                    <small>建议比例 16:9</small>
                                </div>
                                <input type="file" ref="coverInput" hidden accept="image/*" @change="onCoverFileChange">
                            </div>
                        </div>

                        <div class="cinema-monitor-section">
                            <div class="label-tag">Cinema Preview / 监视器预览</div>

                            <div class="theater-display-frame">
                                <div class="film-strip-edge left"><span></span><span></span><span></span></div>

                                <div class="monitor-screen-glass">
                                    <template v-if="videoForm.video_url">
                                        <div class="rec-status-indicator animate__animated animate__fadeIn">
                                            <span class="rec-dot"></span> REC
                                            <span class="rec-time">00:00:00:00</span>
                                        </div>

                                        <video :src="videoForm.video_url" controls class="studio-video-player"
                                            :poster="videoForm.cover_url"></video>
                                    </template>
                                    <div v-else class="standby-screen">
                                        <div class="noise-effect"></div>
                                        <p>等待映画素材导入... / STANDBY</p>
                                    </div>
                                </div>

                                <div class="film-strip-edge right"><span></span><span></span><span></span></div>
                            </div>

                            <Transition name="fade">
                                <div v-if="isUploading" class="upload-hud">
                                    <div class="hud-inner">
                                        <span>正在录制灵感... {{ uploadProgress }}%</span>
                                        <div class="hud-progress-track">
                                            <div class="hud-bar" :style="{ width: uploadProgress + '%' }"></div>
                                        </div>
                                    </div>
                                </div>
                            </Transition>
                        </div>
                    </div>

                    <div class="studio-footer">
                        <div class="footer-inner-layout">
                            <div class="config-group">
                                <div class="med-select-wrapper">
                                    <span class="med-label">Canale / 公共频道</span>
                                    <select v-model="videoForm.category" class="med-select">
                                        <option v-for="cat in sysCategories" :key="cat.id" :value="cat.name">{{ cat.icon
                                        }} {{ cat.name }}
                                        </option>
                                    </select>
                                </div>
                                <div class="med-select-wrapper">
                                    <span class="med-label">Collezione / 个人专栏</span>
                                    <select v-model="videoForm.column_id" class="med-select"
                                        @change="handleColumnChange">
                                        <option :value="null">-- 不归入专栏 --</option>
                                        <option v-for="col in userColumns" :key="col.id" :value="col.id">📘 {{ col.name
                                        }}</option>
                                        <option value="__new_column__" class="new-col-opt">+ 开启新专栏...</option>
                                    </select>
                                </div>
                            </div>
                            <button class="med-publish-btn" @click="submitVideo"
                                :disabled="isSubmitting || isUploading">
                                <span>{{ isSubmitting ? '正在封缄光影...' : 'EXHIBIT / 立即发布' }}</span>
                            </button>
                        </div>
                    </div>
                </section>

                <section v-else-if="activeTab === 'audio'"
                    class="workspace-card mediterranean-theme animate__animated animate__fadeIn">
                    <div class="studio-header">
                        <input v-model="audioForm.title" class="elegant-title-input"
                            placeholder="Composizione / 给这段旋律起个名字...">
                        <textarea v-model="audioForm.description" class="elegant-summary-input"
                            placeholder="在此写下音乐背后的故事..."></textarea>
                    </div>

                    <div class="studio-body audio-layout">
                        <div class="upload-top-row">
                            <div class="studio-upload-box audio-box" @click="audioFileRef.click()">
                                <div class="box-content">
                                    <span class="box-icon">🎶</span>
                                    <p>{{ audioForm.audio_url ? '🎵 旋律已载入' : '选择音频文件' }}</p>
                                </div>
                                <input type="file" ref="audioFileRef" hidden accept="audio/*"
                                    @change="onAudioFileChange">
                            </div>

                            <div class="studio-upload-box" @click="audioCoverRef.click()">
                                <div class="box-content">
                                    <span class="box-icon">📸</span>
                                    <p>{{ audioForm.cover_url ? '✨ 封面已就绪' : '设置唱片封面' }}</p>
                                </div>
                                <input type="file" ref="audioCoverRef" hidden accept="image/*"
                                    @change="onAudioCoverChange">
                            </div>
                        </div>

                        <div class="audio-preview-section centered-monitor">
                            <div class="label-tag">Studio Monitor / 录音室监制</div>

                            <div class="turntable-wrapper">
                                <div class="tonearm" :class="{ 'is-playing': isAudioPlaying }"></div>

                                <div class="vinyl-record" :class="{ 'is-spinning': isAudioPlaying }">
                                    <img :src="getProxyUrl(audioForm.cover_url)" class="vinyl-cover"
                                        v-if="audioForm.cover_url">
                                    <div class="vinyl-center-hole"></div>
                                    <div class="vinyl-shimmer"></div>
                                </div>
                            </div>

                            <div class="player-control-zone">
                                <audio v-if="audioForm.audio_url" :src="audioForm.audio_url" controls
                                    class="elegant-audio-node" @play="handleAudioPlay" @pause="handleAudioPause"
                                    @ended="handleAudioPause"></audio>
                                <div v-else class="waiting-hint">等待音轨导入... / STANDBY</div>
                            </div>

                            <Transition name="fade">
                                <div v-if="isAudioUploading" class="upload-hud-mini">
                                    正在刻录灵感... {{ audioUploadProgress }}%
                                </div>
                            </Transition>
                        </div>
                    </div>

                    <div class="studio-footer">
                        <div class="footer-inner-layout">
                            <div class="config-group">
                                <div class="med-select-wrapper">
                                    <span class="med-label">Canale / 公共频道</span>
                                    <div class="select-box-styled">
                                        <select v-model="audioForm.category" class="med-select">
                                            <option v-for="cat in sysCategories" :key="cat.id" :value="cat.name">
                                                {{ cat.icon }} {{ cat.name }}
                                            </option>
                                        </select>
                                    </div>
                                </div>

                                <div class="med-select-wrapper">
                                    <span class="med-label">Collezione / 个人专栏</span>
                                    <div class="select-box-styled">
                                        <select v-model="audioForm.column_id" class="med-select"
                                            @change="handleColumnChange">
                                            <option :value="null">-- 不归入专栏 --</option>
                                            <option v-for="col in userColumns" :key="col.id" :value="col.id">
                                                📘 {{ col.name }}
                                            </option>
                                            <option value="__new_column__" class="new-col-opt">+ 开启新专栏...</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <button class="med-publish-btn" @click="submitAudio"
                                :disabled="isSubmitting || isAudioUploading">
                                <span>{{ isSubmitting ? '正在刻录唱片...' : 'RELEASE / 立即发行' }}</span>
                            </button>
                        </div>
                    </div>
                </section>
            </main>

        </div>
        <!-- 创建个人新专栏 -->
        <Transition name="fade">
            <div v-if="showNewColumnModal" class="med-modal-overlay" @click="showNewColumnModal = false">
                <div class="med-modal-card animate__animated animate__zoomIn" @click.stop>
                    <div class="modal-decoration">📘</div>
                    <h3>开启新专栏</h3>
                    <p>Nuova Collezione / 建立你的知识体系</p>

                    <div class="med-modal-form">
                        <div class="form-item">
                            <label class="med-modal-label">专栏名称</label>
                            <input v-model="newColumnName" class="med-modal-input" placeholder="例如：Vue3 实战系列..."
                                @keyup.enter="confirmAddColumn">
                        </div>

                        <div class="form-item" style="margin-top: 15px;">
                            <label class="med-modal-label">专栏描述</label>
                            <textarea v-model="newColumnDesc" class="med-modal-textarea"
                                placeholder="简单描述一下这个文件夹的主题吧..." rows="3"></textarea>
                        </div>
                    </div>

                    <div class="modal-ops">
                        <button class="modal-btn-cancel" @click="showNewColumnModal = false">取消</button>
                        <button class="modal-btn-confirm" @click="confirmAddColumn">确认创建</button>
                    </div>
                </div>
            </div>
        </Transition>
    </div>
</template>

<style scoped>
/* ==================== 基础容器布局 ==================== */
.creation-page {
    padding: 100px 20px 40px;
    /* 避开全局 Navbar */
    min-height: 100vh;
    /* 配合背景透出 */
}

.creation-header {
    max-width: 1300px;
    margin: 0 auto 30px;
    padding: 15px 30px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.hub-title {
    font-size: 1.4rem;
    color: #1e293b;
    display: flex;
    flex-direction: column;
}

.hub-title small {
    font-size: 0.7rem;
    color: #94a3b8;
    letter-spacing: 2px;
    margin-top: 2px;
}

/* 🔥 核心修复：左右并排布局 */
.creation-main-layout {
    max-width: 1300px;
    margin: 0 auto;
    display: flex;
    /* 确保子项左右排列 */
    gap: 30px;
    align-items: flex-start;
}

/* ==================== 左侧侧边栏 ==================== */
.creation-sidebar {
    width: 260px;
    /* 固定宽度，防止拉伸 */
    padding: 25px 15px;
    flex-shrink: 0;
    /* 禁止被右侧挤压 */
    position: sticky;
    top: 100px;
}

.nav-group {
    margin-bottom: 30px;
}

.group-label {
    font-size: 0.75rem;
    color: #94a3b8;
    font-weight: 700;
    margin-bottom: 12px;
    padding-left: 15px;
}

.nav-item {
    padding: 12px 20px;
    margin-bottom: 6px;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    align-items: center;
    gap: 12px;
    color: #475569;
    font-weight: 500;
}

.nav-item:hover {
    background: rgba(255, 255, 255, 0.5);
    transform: translateX(5px);
}

.nav-item.active {
    background: var(--primary-color);
    color: white;
    box-shadow: 0 10px 20px -5px rgba(66, 184, 131, 0.4);
}

/* ==================== 右侧工作区 ==================== */
.creation-workspace {
    flex: 1;
    /* 占据剩余全部空间 */
    min-width: 0;
    /* 允许内部元素自适应 */
}

.workspace-card {
    min-height: 750px;
    padding: 40px;
    display: flex;
    flex-direction: column;
}

.modern-input-title {
    width: 100%;
    font-size: 2rem;
    font-weight: 800;
    border: none;
    background: transparent;
    padding-bottom: 15px;
    margin-bottom: 30px;
    border-bottom: 2px solid rgba(0, 0, 0, 0.05);
    outline: none;
    color: #1e293b;
}

/* 编辑器左右分屏布局 */
.split-editor {
    display: flex;
    flex: 1;
    gap: 30px;
}

.editor-pane {
    flex: 1;
}

.editor-pane textarea {
    width: 100%;
    height: 100%;
    border: none;
    background: rgba(0, 0, 0, 0.02);
    border-radius: 16px;
    padding: 25px;
    font-size: 1.1rem;
    resize: none;
    outline: none;
    line-height: 1.8;
}

.preview-pane {
    flex: 1;
    background: rgba(255, 255, 255, 0.5);
    border-radius: 16px;
    padding: 25px;
    overflow-y: auto;
    border: 1px solid rgba(0, 0, 0, 0.02);
}

/* ==================== 按钮与动画效果 ==================== */
.action-glow-btn {
    margin-top: 30px;
    padding: 14px 50px;
    background: linear-gradient(135deg, #42b883 0%, #34d399 100%);
    color: white;
    border-radius: 50px;
    font-weight: 700;
    font-size: 1rem;
    cursor: pointer;
    box-shadow: 0 10px 30px -10px rgba(66, 184, 131, 0.6);
    transition: all 0.3s;
}

.action-glow-btn:hover {
    transform: translateY(-3px) scale(1.05);
    box-shadow: 0 15px 40px -10px rgba(66, 184, 131, 0.8);
}

/* 居中占位样式 */
.centered {
    justify-content: center;
    align-items: center;
    text-align: center;
}

.empty-icon {
    font-size: 4rem;
    margin-bottom: 20px;
}

.empty-state p {
    color: #94a3b8;
    margin-top: 10px;
}

/* ==================== 🇮🇹 地中海艺术主题 ==================== */

.mediterranean-theme {
    /* 背景：温暖的托斯卡纳阳光色渐变 + 微弱纤维纹理 */
    background-color: #fdfcfb;
    background-image:
        radial-gradient(circle at top right, rgba(226, 209, 195, 0.2), transparent),
        url('https://www.transparenttextures.com/patterns/natural-paper.png');
    border: 1px solid #e8dcc4;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.05);
    padding: 50px !important;
}

/* ==================== 🕯️ 金色火漆印章动效 ==================== */

/* 1. 印章本体样式 */
.wax-seal-stamp {
    position: absolute;
    top: 130px;
    /* 落在分割线附近 */
    left: 50%;
    transform: translateX(-50%);
    z-index: 100;
    width: 80px;
    height: 80px;
    background: radial-gradient(circle at 30% 30%, #ffd700, #b8860b);
    /* 金色渐变 */
    border-radius: 50%;
    box-shadow:
        0 4px 10px rgba(0, 0, 0, 0.3),
        inset 0 0 15px rgba(255, 255, 255, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    border: 2px solid #daa520;
    /* 模拟手工按压的不规则边缘感 */
    clip-path: polygon(50% 0%, 80% 10%, 100% 35%, 100% 70%, 80% 90%,
            50% 100%, 20% 90%, 0% 70%, 0% 35%, 20% 10%);
}

.seal-inner {
    font-family: "Georgia", serif;
    font-size: 2.5rem;
    font-weight: 900;
    color: rgba(74, 60, 40, 0.6);
    /* 压印出的深色字母 */
    text-shadow: 1px 1px 2px rgba(255, 255, 255, 0.3);
    user-select: none;
}

/* 2. 封缄成功后的整张纸（卡片）消失动画 */
.workspace-card.is-sealed {
    pointer-events: none;
    /* 防止重复点击 */
    animation: envelope-fly-away 1.2s forwards;
    animation-delay: 0.8s;
    /* 等印章落稳后再起飞 */
}

@keyframes envelope-fly-away {
    0% {
        transform: translateY(0) scale(1) rotate(0);
        opacity: 1;
    }

    30% {
        transform: translateY(20px) scale(0.98);
        /* 稍微下沉蓄力 */
        opacity: 1;
    }

    100% {
        /* 向右上方加速飞出并缩小，模拟寄信 */
        transform: translate(500px, -300px) scale(0.2) rotate(15deg);
        opacity: 0;
        filter: blur(5px);
    }
}

/* 3. 给背景添加一点微微的震动，配合印章落下的重击感 */
.is-sealed::before {
    content: '';
    position: absolute;
    inset: 0;
    animation: stamp-vibrate 0.2s 0.2s ease-in-out;
}

@keyframes stamp-vibrate {

    0%,
    100% {
        transform: scale(1);
    }

    50% {
        transform: scale(1.01);
    }
}

/* ==================== ✍️ 艺术标题输入优化 ==================== */

.elegant-title-input {
    width: 90%;
    /* 标题可以比摘要宽一点，更有张力 */
    max-width: 800px;
    margin: 0 auto;
    font-size: 2.8rem;
    font-family: "Georgia", "STKaiti", serif;
    font-weight: 400;
    color: #4a3c28;
    background: transparent;
    border: none;
    outline: none;
    text-align: center;
    letter-spacing: 2px;

    /* ✅ 核心修改：添加与摘要风格统一的下划线 */
    border-bottom: 1px solid rgba(210, 166, 121, 0.15);
    padding-bottom: 10px;
    /* 文字与线的呼吸间距 */
    transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 激活态：让线条“亮起来” */
.elegant-title-input:focus {
    color: #2c1e0f;
    border-bottom-color: rgba(210, 166, 121, 0.6);
    /* 聚焦时轻微拉伸感，让交互更有灵性 */
    letter-spacing: 3px;
}

/* ==================== 📜 摘要输入框艺术化 ==================== */

.studio-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 20px;
}

.summary-input-container {
    margin-top: 15px;
    /* 增加标题线与摘要之间的间距 */
    width: 100%;
    display: flex;
    justify-content: center;
}

.elegant-summary-input {
    width: 70%;
    /* 摘要线稍短，形成“上长下短”的倒梯形视觉平衡 */
    /* 宽度比标题窄一点，更有层次 */
    max-width: 600px;
    font-size: 1.1rem;
    /* 使用斜体衬线字体，营造“引言”感 */
    font-family: "Georgia", "STKaiti", serif;
    font-style: italic;
    color: #8b5a2b;
    /* 意式棕色 */
    background: transparent;
    border: none;
    outline: none;
    text-align: center;
    border-bottom: 1px solid rgba(210, 166, 121, 0.15);
    /* 极细的底线 */
    padding: 8px 0;
    transition: all 0.4s ease;
}

.elegant-summary-input:focus {
    color: #4a3c28;
    border-bottom-color: rgba(210, 166, 121, 0.5);
    transform: scale(1.02);
}

/* 微调原有的分割线，腾出空间 */
.header-divider {
    width: 80px;
    /* 缩短一点 */
    height: 3px;
    background: #d2a679;
    margin: 20px auto 35px;
    /* 调整间距 */
    border-radius: 10px;
    opacity: 0.4;
}

/* 布局：纸张双栏 */
.studio-body {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 40px;
    height: 600px;
}

.label-tag {
    font-size: 0.7rem;
    color: #bca38a;
    text-transform: uppercase;
    letter-spacing: 2px;
    margin-bottom: 15px;
    font-weight: 700;
}

/* 编辑器：仿威尼斯石灰岩质感 */
.italian-textarea {
    width: 100%;
    height: 100%;
    background: rgba(255, 255, 255, 0.4);
    border: 1px solid rgba(210, 166, 121, 0.2);
    border-radius: 4px;
    padding: 30px;
    font-size: 1.1rem;
    line-height: 2;
    color: #5d4a3b;
    resize: none;
    outline: none;
    transition: all 0.4s ease;
    /* 添加一点轻微的内阴影，增加厚度感 */
    box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.02);
}

.italian-textarea:focus {
    background: #fff;
    border-color: #d2a679;
    box-shadow: 0 10px 30px rgba(210, 166, 121, 0.1);
}

/* 预览区：西班牙羊皮纸感 */
.parchment-view {
    height: 100%;
    background: #fcfaf2;
    border-radius: 4px;
    padding: 30px;
    overflow-y: auto;
    border: 1px solid #e8dcc4;
    /* 纸张边缘微微泛黄的艺术效果 */
    box-shadow: 0 0 40px rgba(232, 220, 196, 0.2) inset;
    line-height: 2.2;
    color: #4a3c28;
}

/* 深度选择器：定制 Markdown 内部样式，使其更像实体书 */
.parchment-view :deep(h1),
.parchment-view :deep(h2) {
    color: #8b5a2b;
    border-bottom: 1px dashed #d2a679;
    padding-bottom: 10px;
}

.parchment-view :deep(p) {
    margin-bottom: 1.5rem;
}

.studio-footer {
    margin-top: 40px;
    padding-top: 30px;
    border-top: 1px solid rgba(210, 166, 121, 0.2);
    /* 淡淡的分割线 */
}

.footer-inner-layout {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    /* 按钮与下拉框底部对齐 */
    gap: 40px;
    /* 保持与上方 studio-body 一致的间距 */
}

.config-group {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 1fr;
    /* 🔥 这里的 gap 必须和 .studio-body 的 gap: 40px 保持绝对一致 */
    gap: 40px;
    max-width: 100%;
    /* 允许撑满父容器 */
}

.med-select-wrapper {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.med-label {
    font-size: 0.65rem;
    color: #bca38a;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 1.5px;
}

/* 模拟下拉框的外层装饰 */
.select-box-styled {
    position: relative;
    width: 100%;
}

.new-col-opt {
    color: #48cbb6;
    font-weight: bold;
}

/* 意式发布按钮 */
.med-publish-btn {
    flex-shrink: 0;
    /* 按钮大小固定 */
    white-space: nowrap;
    background: #4a3c28;
    color: #fdfcfb;
    padding: 15px 60px;
    border: none;
    border-radius: 2px;
    /* 方形圆角，更有建筑感 */
    font-weight: 600;
    letter-spacing: 3px;
    cursor: pointer;
    transition: all 0.4s;
    box-shadow: 0 10px 20px rgba(74, 60, 40, 0.2);
}

.med-publish-btn:hover {
    background: #8b5a2b;
    transform: translateY(-5px);
    box-shadow: 0 15px 30px rgba(139, 90, 43, 0.3);
}

/* 极简选择框 */
.med-select {
    width: 100%;
    /* 强制占满分栏 */
    padding: 12px 15px;
    border: 1px solid #e8dcc4;
    background: #fff;
    color: #8b5a2b;
    font-size: 0.9rem;
    font-family: "Georgia", serif;
    cursor: pointer;
    outline: none;
    transition: all 0.3s;
    border-radius: 2px;

    /* 自定义箭头图标 */
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23d2a679' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'%3E%3C/path%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 15px center;
}

.med-select:hover {
    border-color: #8b5a2b;
    background-color: #fcfaf2;
    box-shadow: 0 4px 15px rgba(139, 90, 43, 0.05);
}

/* 优化选项列表样式 (部分浏览器支持) */
.med-select option {
    background-color: #fcfaf2;
    color: #4a3c28;
    padding: 10px;
}

/* ==================== 📜 意式时尚弹窗样式 ==================== */

.med-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(74, 60, 40, 0.4);
    /* 深棕色半透明遮罩 */
    backdrop-filter: blur(8px);
    z-index: 9999;
    display: flex;
    justify-content: center;
    align-items: center;
}

.med-modal-card {
    background: #fdfcfb;
    background-image: url('https://www.transparenttextures.com/patterns/natural-paper.png');
    padding: 40px;
    width: 90%;
    max-width: 400px;
    border-radius: 4px;
    border: 1px solid #e8dcc4;
    box-shadow: 0 30px 70px rgba(0, 0, 0, 0.2);
    text-align: center;
}

.modal-decoration {
    font-size: 2rem;
    margin-bottom: 10px;
}

.med-modal-card h3 {
    font-family: "Georgia", serif;
    color: #4a3c28;
    font-size: 1.5rem;
    margin-bottom: 5px;
}

.med-modal-card p {
    font-size: 0.7rem;
    color: #bca38a;
    text-transform: uppercase;
    letter-spacing: 2px;
    margin-bottom: 25px;
}

.med-modal-input {
    width: 100%;
    padding: 12px 15px;
    background: rgba(255, 255, 255, 0.8);
    border: 1px solid #d2a679;
    outline: none;
    font-size: 1rem;
    color: #5d4a3b;
    text-align: center;
    transition: all 0.3s;
}

.med-modal-input:focus {
    background: #fff;
    box-shadow: 0 0 0 4px rgba(210, 166, 121, 0.1);
}

/* --- 弹窗内部表单美化 --- */
.med-modal-form {
    text-align: left;
    /* 表单文字左对齐 */
    margin-bottom: 25px;
}

.med-modal-label {
    display: block;
    font-size: 11px;
    font-weight: 800;
    color: #bca38a;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 6px;
    padding-left: 5px;
}

/* 多行文本框样式 */
.med-modal-textarea {
    width: 100%;
    padding: 12px 15px;
    background: rgba(255, 255, 255, 0.8);
    border: 1px solid #d2a679;
    outline: none;
    font-size: 0.9rem;
    color: #5d4a3b;
    font-family: inherit;
    resize: none;
    /* 禁止随意拉伸 */
    transition: all 0.3s;
    border-radius: 2px;
}

.med-modal-textarea:focus {
    background: #fff;
    border-color: #8b5a2b;
    box-shadow: 0 0 0 4px rgba(210, 166, 121, 0.1);
}

/* 保持输入框风格一致 */
.med-modal-input {
    text-align: left !important;
    /* 名称也改为左对齐，更整齐 */
}

.modal-ops {
    display: flex;
    gap: 15px;
    margin-top: 30px;
}

.modal-btn-confirm {
    flex: 2;
    padding: 12px;
    background: #4a3c28;
    color: #fcfaf2;
    border: none;
    font-weight: 600;
    cursor: pointer;
    transition: 0.3s;
}

.modal-btn-cancel {
    flex: 1;
    padding: 12px;
    background: transparent;
    border: 1px solid #d2a679;
    color: #8b5a2b;
    cursor: pointer;
    transition: 0.3s;
}

.modal-btn-confirm:hover {
    background: #8b5a2b;
}

.modal-btn-cancel:hover {
    background: rgba(210, 166, 121, 0.1);
}

/* 视频发布 */

/* ==================== 🎥 电影工作室专用布局 ==================== */

.video-studio-layout {
    display: flex;
    flex-direction: column;
    gap: 35px;
    height: auto;
    /* 允许高度自适应 */
}

/* 上层：左右对等的素材箱 */
.upload-top-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 30px;
}

.studio-upload-box {
    height: 200px;
    background: rgba(255, 255, 255, 0.4);
    border: 1.5px dashed #d2a679;
    border-radius: 4px;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.box-icon {
    /* 🔥 修改项：增大图标尺寸 */
    font-size: 2.5rem;
    display: block;
    margin-bottom: 10px;
}

.box-content p {
    /* 🔥 修改项：稍微增大文字 */
    font-size: 1.1rem;
    font-weight: 500;
}

.studio-upload-box:hover {
    background: #fff;
    border-color: #8b5a2b;
    transform: translateY(-2px);
    box-shadow: 0 10px 20px rgba(139, 90, 43, 0.05);
}

.box-content {
    text-align: center;
    color: #bca38a;
}

.box-icon {
    font-size: 2rem;
    display: block;
    margin-bottom: 5px;
}

/* 下层：巨幕预览区（填满原本空旷的红框位置） */
.cinema-monitor-section {
    width: 100%;
    margin-top: 10px;
}

.theater-display-frame {
    position: relative;
    background: #111;
    /* 🔥 微调项：将 padding 从 25px 50px 改为 20px 30px */
    padding: 20px 30px;
    border-radius: 4px;
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.3);
    display: flex;
    justify-content: center;
}

/* 胶片装饰线 */
.film-strip-edge {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 30px;
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    align-items: center;
}

.film-strip-edge.left {
    left: 10px;
}

.film-strip-edge.right {
    right: 10px;
}

.film-strip-edge span {
    width: 12px;
    height: 12px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 1px;
}

.monitor-screen-glass {
    width: 100%;
    max-width: 650px;
    aspect-ratio: 16 / 9;
    background: #000;
    overflow: hidden;
    border: 1px solid #333;
    box-shadow: inset 0 0 40px rgba(0, 0, 0, 0.8);
}

/* REC 指示器容器 */
.rec-status-indicator {
    position: absolute;
    top: 25px;
    left: 30px;
    z-index: 10;
    /* 确保浮在视频上方 */
    display: flex;
    align-items: center;
    gap: 10px;

    /* 经典的复古摄像机字体风格 */
    font-family: "Courier New", "Roboto Mono", monospace;
    font-weight: 700;
    color: #ff3b30;
    /* 鲜艳的警示红 */
    font-size: 0.9rem;
    letter-spacing: 1px;

    /* 添加一点微弱的光晕，模拟屏幕发光 */
    text-shadow: 0 0 8px rgba(255, 59, 48, 0.6);

    /* 关键：让鼠标事件穿透过去，不要挡住视频播放控件 */
    pointer-events: none;
}

/* 闪烁的红点 */
.rec-dot {
    width: 14px;
    height: 14px;
    background-color: #ff3b30;
    border-radius: 50%;
    box-shadow: 0 0 10px rgba(255, 59, 48, 0.9);
    /* 强烈的红色光晕 */

    /* 应用呼吸闪烁动画 */
    animation: rec-blink 1s cubic-bezier(0.4, 0, 0.6, 1) infinite alternate;
}

/* 时间码 (静态装饰，增加专业感) */
.rec-time {
    color: rgba(255, 255, 255, 0.8);
    /* 白色略带透明 */
    font-weight: 400;
    margin-left: 15px;
    text-shadow: none;
}

/* 定义呼吸闪烁动画 */
@keyframes rec-blink {
    0% {
        opacity: 1;
        transform: scale(1);
    }

    100% {
        opacity: 0.3;
        transform: scale(0.85);
        /* 稍微缩小一点，呼吸感更强 */
    }
}

.studio-video-player {
    width: 100%;
    height: 100%;
    object-fit: contain;
}

.standby-screen {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    color: #333;
    font-family: monospace;
    font-size: 0.9rem;
    position: relative;
}

/* 进度 HUD */
.upload-hud {
    margin-top: 15px;
    padding: 15px;
    background: rgba(var(--highlight-color-rgb), 0.05);
    border-radius: 4px;
    text-align: center;
}

.hud-inner span {
    font-size: 0.75rem;
    color: var(--highlight-color);
    font-weight: 700;
}

.hud-progress-track {
    width: 100%;
    height: 3px;
    background: #eee;
    margin-top: 8px;
    border-radius: 10px;
}

.hud-bar {
    height: 100%;
    background: #48cbb6;
    transition: width 0.3s;
}

/* --- 📻 音频预览区容器：限制大小，防止溢出 --- */
.audio-preview-section {
    background: rgba(255, 255, 255, 0.4);
    border: 1px solid rgba(210, 166, 121, 0.2);
    border-radius: 8px;
    padding: 30px;
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
}

/* --- 📻 音频布局：改为垂直排列 --- */
.audio-layout {
    display: flex !important;
    /* 强制覆盖之前的 grid */
    flex-direction: column;
    gap: 30px;
    height: auto !important;
}

/* --- 💿 居中试听工作台 --- */
.audio-preview-section.centered-monitor {
    width: 100%;
    max-width: 600px;
    /* 限制工作台宽度 */
    margin: 10px auto 0;
    /* 居中显示 */
    background: rgba(255, 255, 255, 0.5);
    border: 1px solid rgba(210, 166, 121, 0.3);
    border-radius: 12px;
    padding: 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-shadow: 0 15px 40px rgba(0, 0, 0, 0.03);
}

/* 唱机容器 */
.turntable-wrapper {
    position: relative;
    width: 200px;
    height: 200px;
    margin: 20px 0 35px;
}

/* 黑胶唱片容器 */
.vinyl-record-container {
    position: relative;
    width: 240px;
    /* 强制固定宽度，不给图片长大的机会 */
    height: 240px;
    margin-bottom: 25px;
}

/* 黑胶盘体：强制固定大小，解决撑爆问题 */
.vinyl-record {
    width: 100%;
    height: 100%;
    background: #111;
    border-radius: 50%;
    border: 6px solid #222;
    box-shadow: 0 12px 35px rgba(0, 0, 0, 0.3);
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
    position: relative;
    animation: vinyl-spin 6s linear infinite;
    /* 默认挂载动画 */
    animation-play-state: paused;
    /* 但默认是暂停的 */
}

/* 唱纹效果（让唱片看起来更真实） */
.vinyl-shimmer {
    position: absolute;
    inset: 0;
    background: repeating-radial-gradient(circle, transparent 0, rgba(255, 255, 255, 0.03) 2px, transparent 4px);
    pointer-events: none;
}

/* 封面：黑胶中心的艺术图 */
.vinyl-cover {
    width: 85px;
    /* 保持适中的大小 */
    height: 85px;
    border-radius: 50%;
    object-fit: cover;
    z-index: 2;
    border: 2px solid #222;
}

/* 唱片中心孔 */
.vinyl-center-hole {
    position: absolute;
    width: 10px;
    height: 10px;
    background: #fdfcfb;
    border-radius: 50%;
    z-index: 3;
    box-shadow: inset 0 0 3px rgba(0, 0, 0, 0.5);
}

/* 唱臂（艺术装饰） */
.tonearm {
    position: absolute;
    top: -20px;
    right: -40px;
    width: 80px;
    height: 150px;
    background: url('https://cdn-icons-png.flaticon.com/512/3043/3043663.png');
    /* 简洁唱臂素材 */
    background-size: contain;
    background-repeat: no-repeat;
    transform-origin: top right;
    transform: rotate(-30deg);
    /* 默认移开 */
    transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 5;
    filter: drop-shadow(4px 8px 12px rgba(0, 0, 0, 0.2));
}

.tonearm.is-playing {
    transform: rotate(5deg);
    /* 有音频时自动搭在唱片上 */
}

/* 播放控件区 */
.player-control-zone {
    width: 100%;
    display: flex;
    justify-content: center;
}

.elegant-audio-node {
    width: 100%;
    max-width: 450px;
    height: 40px;
    filter: sepia(0.3);
    /* 棕褐色复古滤镜 */
}

.waiting-hint {
    color: #bca38a;
    font-size: 0.85rem;
    letter-spacing: 2px;
    font-family: "Georgia", serif;
}

/* 旋转动画：只有上传音频后才转动 */
/* 旋转动画 */
.is-spinning {
    animation-play-state: running !important;
}

/* 旋转动画：定义一次性循环 */
@keyframes vinyl-spin {
    from {
        transform: rotate(0deg);
    }

    to {
        transform: rotate(360deg);
    }
}
</style>