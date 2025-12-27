<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router' // 确保引入了 useRoute
import { api } from '@/utils/api'
import { message } from '@/utils/message.js'
import MarkdownIt from 'markdown-it'
import 'github-markdown-css/github-markdown-light.css'
import ArticleItem from '@/components/ArticleItem.vue'

const router = useRouter()
const route = useRoute()
const md = new MarkdownIt({ html: true, linkify: true, breaks: true })

// ==================== 状态管理 ====================
const activeTab = ref('article')
const isSubmitting = ref(false)
const sysCategories = ref([])
const userColumns = ref([])
const showNewColumnModal = ref(false);
const newColumnName = ref('');
const newColumnDesc = ref('');

// 文章表单
const articleForm = ref({
    title: '',
    summary: '',
    content: '',
    category: '',
    column_id: null,
    cover_image: ''
})

// 🔥 新增：图文表单 (专门用于 activeTab === 'short')
const shortForm = ref({
    title: '',
    summary: '',
    content: '', // 最终也会转为 markdown
    category: '',
    column_id: null,
    images: [] // 暂存上传的图片列表
})

// ==================== 数据获取 ====================
const fetchCategories = async () => {
    try {
        const res = await api.get('/categories')
        if (res.data.success) {
            sysCategories.value = res.data.data
            if (sysCategories.value.length > 0) {
                // 初始化所有表单的分类
                articleForm.value.category = sysCategories.value[0].name
                shortForm.value.category = sysCategories.value[0].name
                videoForm.value.category = sysCategories.value[0].name
                audioForm.value.category = sysCategories.value[0].name
            }
        }
    } catch (err) { console.error("加载频道失败:", err) }
}

const fetchUserColumns = async () => {
    try {
        const res = await api.get('/user/columns/simple')
        if (res.data.success) {
            userColumns.value = res.data.data
        }
    } catch (err) { console.error("加载专栏失败:", err) }
}

// ==================== 专栏管理 ====================
const handleColumnChange = () => {
    let currentColumnId;
    if (activeTab.value === 'article') currentColumnId = articleForm.value.column_id;
    else if (activeTab.value === 'video') currentColumnId = videoForm.value.column_id;
    else if (activeTab.value === 'audio') currentColumnId = audioForm.value.column_id;
    else if (activeTab.value === 'short') currentColumnId = shortForm.value.column_id; // 🔥 图文模式

    if (currentColumnId === '__new_column__') {
        showNewColumnModal.value = true;
        // 重置选中项
        if (activeTab.value === 'article') articleForm.value.column_id = null;
        else if (activeTab.value === 'video') videoForm.value.column_id = null;
        else if (activeTab.value === 'audio') audioForm.value.column_id = null;
        else if (activeTab.value === 'short') shortForm.value.column_id = null;
    }
}

const confirmAddColumn = async () => {
    if (!newColumnName.value.trim()) return message.warning('请输入专栏名称');
    try {
        const res = await api.post('/columns', {
            name: newColumnName.value,
            description: newColumnDesc.value
        });
        if (res.data.success) {
            const newId = res.data.data.id;
            message.success('新专栏已开启');
            await fetchUserColumns();

            // 自动选中
            if (activeTab.value === 'article') articleForm.value.column_id = newId;
            else if (activeTab.value === 'video') videoForm.value.column_id = newId;
            else if (activeTab.value === 'audio') audioForm.value.column_id = newId;
            else if (activeTab.value === 'short') shortForm.value.column_id = newId; // 🔥 图文

            showNewColumnModal.value = false;
            newColumnName.value = '';
            newColumnDesc.value = '';
        }
    } catch (err) { message.error('创建失败: ' + err.message); }
}

// ==================== 📝 文章发布逻辑 ====================
const renderedPreview = computed(() => md.render(articleForm.value.content || '*灵感实时预览...*'))
const isSuccess = ref(false)

const submitArticle = async () => {
    // 1. 基础校验
    if (!articleForm.value.title.trim()) return message.warning('标题不可留白');
    if (!articleForm.value.content.trim()) return message.warning('请挥洒你的思绪');

    // 2. 自动生成摘要
    if (!articleForm.value.summary.trim()) {
        articleForm.value.summary = articleForm.value.content.substring(0, 80).replace(/[#*`>]/g, '') + '...';
    }

    isSubmitting.value = true;
    try {
        let res;
        // 🔥 分支逻辑：编辑 vs 发布
        if (isEditing.value) {
            res = await api.put(`/articles/${currentEditingId.value}`, articleForm.value);
        } else {
            res = await api.post('/articles', articleForm.value);
        }

        if (res.data.success) {
            isSuccess.value = true;
            setTimeout(() => {
                message.success(isEditing.value ? '📝 修改已保存！' : '✨ 灵感已封缄寄出！');

                if (isEditing.value) {
                    resetForm();        // 重置表单
                    activeTab.value = 'works'; // 编辑完跳回列表
                } else {
                    router.push('/blog'); // 新发布跳去博客页
                }
                isSuccess.value = false;
            }, 1500);
        }
    } catch (err) {
        message.error(isEditing.value ? '修改失败' : '发布失败');
        isSubmitting.value = false;
    }
}

// ==================== 📸 图文发布逻辑 (新功能) ====================
const shortImagesInput = ref(null)
// 🔥 新增：绑定右侧文本域的 DOM 元素，用于获取光标位置
const shortContentRef = ref(null)

// 批量上传图片并插入到编辑器
const handleShortImagesUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    console.log('📸 准备上传图片:', files.length, '张');

    if (shortForm.value.images.length + files.length > 9) {
        return message.warning('一次最多只能上传 9 张图片哦');
    }

    const formData = new FormData();
    files.forEach(file => {
        formData.append('images', file);
    });

    isSubmitting.value = true;
    try {
        const res = await api.post('/upload/comment-images', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (res.data.success) {
            const urls = res.data.data.urls;

            // 拼接完整 URL
            const isDev = import.meta.env.VITE_APP_ENV === 'development';
            const apiBase = isDev ? 'http://localhost:3000' : window.location.origin;
            const fullUrls = urls.map(url => `${apiBase}${url}`);

            // 1. 追加到本地左侧图片列表
            shortForm.value.images.push(...fullUrls);

            // 2. 🔥 核心优化：生成 Markdown 并精准插入到光标位置
            let imageMarkdown = '';
            fullUrls.forEach(url => {
                // 不再默认加前置换行符，而是根据插入位置决定
                imageMarkdown += `![图片](${url})\n`;
            });

            const textarea = shortContentRef.value;
            const currentContent = shortForm.value.content || '';

            if (!textarea) {
                // 如果找不到输入框（极少情况），默认追加到最后
                shortForm.value.content = currentContent + imageMarkdown;
            } else {
                // 获取光标位置 (selectionStart)
                const startPos = textarea.selectionStart;
                const endPos = textarea.selectionEnd;

                // 智能处理换行：
                // 如果光标不在开头，且光标前一个字符不是换行符，我们给图片前面补一个换行，避免和文字粘连
                const needPrefixNewLine = startPos > 0 && currentContent.charAt(startPos - 1) !== '\n';
                const finalInsertText = (needPrefixNewLine ? '\n' : '') + imageMarkdown;

                // ✂️ 字符串手术： 前半段 + 图片代码 + 后半段
                const newContent =
                    currentContent.substring(0, startPos) +
                    finalInsertText +
                    currentContent.substring(endPos, currentContent.length);

                shortForm.value.content = newContent;

                // 🎉 体验优化：上传完后，自动把光标移到图片代码的后面，方便用户继续打字
                // nextTick 确保数据更新到 DOM 后再调整光标
                setTimeout(() => {
                    const newCursorPos = startPos + finalInsertText.length;
                    textarea.focus();
                    textarea.setSelectionRange(newCursorPos, newCursorPos);
                }, 0);
            }

            message.success(`📸 成功添加 ${urls.length} 张图片`);

            // 3. 设置封面逻辑 (保持不变)
            if (!shortForm.value.cover_image && fullUrls.length > 0) {
                shortForm.value.cover_image = fullUrls[0];
            }
        }
    } catch (err) {
        console.error('❌ 上传失败:', err);
        message.error('图片上传失败: ' + (err.response?.data?.message || err.message));
    } finally {
        isSubmitting.value = false;
        e.target.value = '';
    }
}

// 🔥 优化后的删除逻辑：同步删除 Markdown 中的内容
const removeShortImage = (index) => {
    // 1. 获取要删除的图片 URL
    const urlToRemove = shortForm.value.images[index];

    if (urlToRemove) {
        // 2. 构造正则，匹配 Markdown 图片语法: ![任意描述](具体URL)
        // 这里的 escape 用来处理 URL 中可能存在的特殊符号，防止正则报错
        const escapedUrl = urlToRemove.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // 匹配 ![...](url) 以及后面可能紧跟的一个换行符(\n?)，避免删除后留下空行
        const regex = new RegExp(`!\\[.*?\\]\\(${escapedUrl}\\)\\n?`, 'g');

        // 3. 替换内容
        shortForm.value.content = shortForm.value.content.replace(regex, '');
        console.log('🗑️ 已同步移除 Markdown 内容中的图片引用');
    }

    // 4. 原有的数组移除逻辑
    shortForm.value.images.splice(index, 1);

    // 5. 封面图重置逻辑 (保持不变)
    if (shortForm.value.images.length > 0) {
        if (!shortForm.value.images.includes(shortForm.value.cover_image)) {
            shortForm.value.cover_image = shortForm.value.images[0];
        }
    } else {
        shortForm.value.cover_image = '';
    }
}

// 提交图文
const submitShort = async () => {
    // 1. 基础校验
    if (!shortForm.value.title.trim()) return message.warning('📸 请给这组图文起个标题');
    if (!shortForm.value.content.trim() && shortForm.value.images.length === 0) {
        return message.warning('📝 请添加一些文字描述或图片');
    }

    // 2. 封面兜底逻辑：如果没有手动设置封面，自动用第一张图
    // 注意：如果是编辑模式，可能已经有封面了，所以要判断 cover_image 是否为空
    if (!shortForm.value.cover_image && shortForm.value.images.length > 0) {
        shortForm.value.cover_image = shortForm.value.images[0];
    }

    // 3. 自动生成摘要
    if (!shortForm.value.summary.trim()) {
        const plainText = shortForm.value.content.replace(/!\[.*?\]\(.*?\)/g, '[图片]');
        shortForm.value.summary = plainText.substring(0, 80).trim() + '...';
    }

    isSubmitting.value = true;
    try {
        // 构造 Payload
        const payload = {
            title: shortForm.value.title,
            summary: shortForm.value.summary,
            content: shortForm.value.content, // Markdown 内容
            category: shortForm.value.category,
            column_id: shortForm.value.column_id,
            cover_image: shortForm.value.cover_image || null
        };

        let res;
        // 🔥 分支逻辑
        if (isEditing.value) {
            // 图文本质上存储在 articles 表，所以调用 articles 的更新接口
            res = await api.put(`/articles/${currentEditingId.value}`, payload);
        } else {
            res = await api.post('/articles', payload);
        }

        if (res.data.success) {
            isSuccess.value = true;
            setTimeout(() => {
                message.success(isEditing.value ? '📸 修改已保存！' : '📸 图文故事已定格！');

                if (isEditing.value) {
                    resetForm();
                    activeTab.value = 'works';
                } else {
                    router.push('/blog');
                }
                isSuccess.value = false;
            }, 1500);
        }
    } catch (err) {
        console.error('操作失败:', err);
        message.error('操作失败: ' + (err.response?.data?.message || err.message));
        isSubmitting.value = false;
    }
}

// 🔥 新增：记录当前正在被拖拽的图片索引
const dragStartIndex = ref(null);

// 🔥 新增：开始拖拽
const handleDragStart = (index) => {
    dragStartIndex.value = index;
    console.log('✊ 开始拖拽第', index, '张图片');
};

// 🔥 新增：放置图片 (核心逻辑：交换数组位置 + 交换 Markdown 文本内容)
const handleDrop = (dropIndex) => {
    const dragIndex = dragStartIndex.value;

    // 如果位置没变，或者没抓到东西，直接返回
    if (dragIndex === null || dragIndex === dropIndex) return;

    const images = shortForm.value.images;
    const urlDrag = images[dragIndex];
    const urlDrop = images[dropIndex];

    console.log(`🔄 交换图片: 从 [${dragIndex}] 拖到了 [${dropIndex}]`);

    // 1. 【Markdown 同步交换】(高难度动作)
    // 我们需要在文本中找到这两张图片的引用，并交换它们的位置
    // 构造精确的 Markdown 图片语法字符串
    // 注意：这里假设用户没有修改图片的 alt 描述 "![图片]"，如果用户改了描述，单纯匹配 URL 也可以
    // 为了稳健，我们直接在全文内容中交换 URL 字符串

    // ⚠️ 警告：直接 replace 会有先后顺序问题，所以我们用一个中间占位符
    const placeholder = '___TEMP_PLACEHOLDER___';

    // 先把内容里的 urlDrop 换成 占位符
    let newContent = shortForm.value.content.split(urlDrop).join(placeholder);
    // 再把 urlDrag 换成 urlDrop
    newContent = newContent.split(urlDrag).join(urlDrop);
    // 最后把 占位符 换成 urlDrag
    newContent = newContent.split(placeholder).join(urlDrag);

    shortForm.value.content = newContent;

    // 2. 【数组重排】
    // 移动元素：先删除原来的，再插入到新位置
    const [movedItem] = shortForm.value.images.splice(dragIndex, 1);
    shortForm.value.images.splice(dropIndex, 0, movedItem);

    // 3. 【封面逻辑重置】
    // 始终确保数组的第一张是封面 (符合直觉)
    if (shortForm.value.images.length > 0) {
        shortForm.value.cover_image = shortForm.value.images[0];
    }

    // 重置拖拽状态
    dragStartIndex.value = null;
    message.success('排序已更新');
};


// 🔥 核心交互闭环：监听 Markdown 内容变化，反向同步删除左侧图片列表
// 当用户在编辑器里手动删除了 ![图片](url) 代码时，左侧对应的图片预览也应该消失
watch(() => shortForm.value.content, (newContent) => {
    // 1. 如果列表本来就是空的，不需要处理
    if (shortForm.value.images.length === 0) return;

    // 2. 使用正则提取文本中目前所有的图片 URL
    // 匹配格式：![...](url)
    const regex = /!\[.*?\]\((.*?)\)/g;
    const currentUrlsInText = new Set();
    let match;

    while ((match = regex.exec(newContent)) !== null) {
        // match[1] 就是括号里的 url
        currentUrlsInText.add(match[1]);
    }

    // 3. 过滤 images 数组
    // 逻辑：保留那些【在文本中依然存在】的图片
    const survivingImages = shortForm.value.images.filter(img => currentUrlsInText.has(img));

    // 4. 只有当数量不一致时（说明有图片被删了），才更新数组，避免死循环
    if (survivingImages.length !== shortForm.value.images.length) {
        console.log('✂️ 监测到文本中删除了图片代码，同步移除左侧列表');
        shortForm.value.images = survivingImages;

        // 5. 再次检查封面逻辑 (如果封面图正好被删了，重置它)
        if (shortForm.value.images.length > 0) {
            if (!shortForm.value.images.includes(shortForm.value.cover_image)) {
                shortForm.value.cover_image = shortForm.value.images[0];
            }
        } else {
            shortForm.value.cover_image = '';
        }
    }
});



// ==================== 🎬 视频发布逻辑 (保持不变) ====================
const videoForm = ref({
    title: '', description: '', video_url: '', cover_url: '', category: '', column_id: null
})
const uploadProgress = ref(0);
const isUploading = ref(false);
const videoInput = ref(null)
const coverInput = ref(null)

const onVideoFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!['video/mp4', 'video/quicktime'].includes(file.type)) return message.error('仅支持 MP4/MOV');
    if (file.size > 500 * 1024 * 1024) return message.error('文件过大');

    const formData = new FormData();
    formData.append('video', file);
    isUploading.value = true;
    uploadProgress.value = 0;

    try {
        videoForm.value.video_url = URL.createObjectURL(file);
        const res = await api.post('/upload/video', formData, {
            headers: { 'Content-Type': undefined },
            onUploadProgress: (p) => { uploadProgress.value = Math.round((p.loaded * 100) / p.total); }
        });
        if (res.data.success) {
            videoForm.value.video_url = res.data.data.url;
            message.success('🎬 素材已入库');
        }
    } catch (err) { message.error('上传失败'); videoForm.value.video_url = ''; }
    finally { isUploading.value = false; }
};

const onCoverFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    try {
        const res = await api.post('/upload', formData);
        if (res.data.success) {
            videoForm.value.cover_url = res.data.data.url;
            message.success('✨ 海报已就绪');
        }
    } catch (err) { message.error('海报上传失败'); }
};

const submitVideo = async () => {
    // 1. 基础校验
    if (!videoForm.value.title.trim()) return message.warning('请命名您的作品');
    if (!videoForm.value.video_url) return message.warning('请上传灵感视频');

    isSubmitting.value = true;
    try {
        let res;
        // 🔥 分支逻辑
        if (isEditing.value) {
            // 编辑模式：调用 PUT
            res = await api.put(`/videos/${currentEditingId.value}`, videoForm.value);
        } else {
            // 发布模式：调用 POST
            res = await api.post('/videos', videoForm.value);
        }

        if (res.data.success) {
            isSuccess.value = true;
            setTimeout(() => {
                message.success(isEditing.value ? '🎬 信息已更新！' : '🎬 灵感映画已封缄展出！');

                if (isEditing.value) {
                    resetForm();
                    activeTab.value = 'works';
                } else {
                    router.push('/blog');
                }
                isSuccess.value = false;
            }, 1500);
        }
    } catch (err) {
        message.error('操作失败');
        isSubmitting.value = false;
    }
};

// ==================== 📻 音频发布逻辑 (保持不变) ====================
const isAudioPlaying = ref(false);
const handleAudioPlay = () => { isAudioPlaying.value = true; };
const handleAudioPause = () => { isAudioPlaying.value = false; };
const audioForm = ref({ title: '', description: '', audio_url: '', cover_url: '', category: '音乐', column_id: null })
const audioFileRef = ref(null)
const audioCoverRef = ref(null)
const isAudioUploading = ref(false)
const audioUploadProgress = ref(0)

const onAudioFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const formData = new FormData()
    formData.append('audio', file)
    isAudioUploading.value = true
    try {
        const res = await api.post('/upload/audio', formData, {
            headers: { 'Content-Type': undefined },
            onUploadProgress: (p) => { audioUploadProgress.value = Math.round((p.loaded * 100) / p.total) }
        })
        if (res.data.success) {
            audioForm.value.audio_url = res.data.data.url
            message.success('📻 旋律已载入')
        }
    } catch (err) { message.error('载入失败') }
    finally { isAudioUploading.value = false }
}

const onAudioCoverChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const formData = new FormData()
    formData.append('image', file)
    try {
        const res = await api.post('/upload', formData)
        if (res.data.success) {
            audioForm.value.cover_url = res.data.data.url
            message.success('✨ 封面已就绪')
        }
    } catch (err) { message.error('封面上传失败') }
}

const submitAudio = async () => {
    // 1. 基础校验
    if (!audioForm.value.title.trim()) return message.warning('请命名')
    if (!audioForm.value.audio_url) return message.warning('请上传素材')

    isSubmitting.value = true
    try {
        let res;
        // 🔥 分支逻辑
        if (isEditing.value) {
            res = await api.put(`/audios/${currentEditingId.value}`, audioForm.value)
        } else {
            res = await api.post('/audios', audioForm.value)
        }

        if (res.data.success) {
            isSuccess.value = true
            setTimeout(() => {
                message.success(isEditing.value ? '📻 唱片信息已修改！' : '📻 旋律已发行');

                if (isEditing.value) {
                    resetForm();
                    activeTab.value = 'works';
                } else {
                    router.push('/blog');
                }
                isSuccess.value = false;
            }, 1800)
        }
    } catch (err) {
        message.error('发布失败');
        isSubmitting.value = false;
    }
}

const getProxyUrl = (url) => {
    // 1. Strict null value processing
    if (!url || url === 'null' || url === 'undefined') {
        // Return a stable default image
        return 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&h=200';
    }

    // 2. Already a full URL
    if (url.startsWith('http') || url.startsWith('data:')) {
        return url;
    }

    // 3. Relative path: Complete full URL
    const isDev = import.meta.env.VITE_APP_ENV === 'development';
    const apiBase = isDev ? 'http://localhost:3000' : window.location.origin;

    // Ensure it starts with /
    let cleanPath = url.startsWith('/') ? url : '/' + url;

    // If it is a local upload path, append the API domain name
    if (cleanPath.startsWith('/uploads')) {
        return `${apiBase}${cleanPath}`;
    }

    // 4. External image proxy
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
}

// ==================== 📦 作品管理逻辑 (重构版) ====================
const worksSubTab = ref('article') // 当前选中的子分类: article, video, audio, short
const userWorks = ref([])
const worksPagination = ref({
    current: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1
})
const isLoadingWorks = ref(false)

// 二级导航配置
const worksNavItems = [
    { id: 'article', label: '📝 文章', count: 0 }, // count 可以后续扩展
    { id: 'short', label: '📸 图文', count: 0 },
    { id: 'video', label: '🎬 视频', count: 0 },
    { id: 'audio', label: '📻 音频', count: 0 }
]

// 数据清洗 (复用之前的逻辑，针对列表做适配)
// CreationCenter.vue

const sanitizeWorkItem = (item) => {
    // 1. 类型兜底 (非常重要！防止后端旧数据没有 type)
    let type = item.work_type || worksSubTab.value;

    // 2. 封面处理
    let cover = item.cover_image;
    // 图文自动提取逻辑
    if (type === 'short' && !cover && item.content) {
        const imgMatch = item.content.match(/!\[.*?\]\((.*?)\)/);
        if (imgMatch) cover = imgMatch[1];
    }

    // 3. 视频路径修正
    let videoUrl = item.video_url;
    if (type === 'video' && videoUrl) {
        // 确保路径以 / 开头 (如果不是 http 开头)
        if (!videoUrl.startsWith('http') && !videoUrl.startsWith('/')) {
            videoUrl = '/' + videoUrl;
        }
    }

    // 4. 音频路径修正
    let audioUrl = item.audio_url;
    if (type === 'audio' && audioUrl) {
        if (!audioUrl.startsWith('http') && !audioUrl.startsWith('/')) {
            audioUrl = '/' + audioUrl;
        }
    }

    // 5. 🔥 返回重组后的对象 (关键！不能只返回 item)
    return {
        ...item,
        work_type: type,      // 确保组件拿到正确的类型
        cover_image: cover,   // 确保组件拿到提取后的封面
        video_url: videoUrl,  // 确保组件拿到修正后的视频地址
        audio_url: audioUrl,  // 确保组件拿到修正后的音频地址

        // 统计数据兜底
        likes: Number(item.likes || 0),
        favorites: Number(item.favorites || 0),
        comments: Number(item.comments || 0),

        // 作者信息兜底
        author_name: item.author_name || '我',
        author_avatar: item.author_avatar || '',
        author_username: item.author_username || ''
    };
}

// 获取作品列表
const fetchUserWorks = async () => {
    isLoadingWorks.value = true;
    try {
        const res = await api.get('/user/my-works', {
            params: {
                type: worksSubTab.value,
                page: worksPagination.value.current,
                limit: worksPagination.value.pageSize
            }
        });

        if (res.data.success) {
            userWorks.value = (res.data.data.list || []).map(sanitizeWorkItem);
            // 更新分页信息
            const p = res.data.data.pagination;
            worksPagination.value = {
                current: p.current,
                pageSize: p.pageSize,
                total: p.total,
                totalPages: p.totalPages
            };
        }
    } catch (err) {
        console.error(err);
        message.error('作品加载失败');
    } finally {
        isLoadingWorks.value = false;
    }
}

// 切换子 Tab
const handleWorksTabChange = (type) => {
    if (worksSubTab.value === type) return;
    worksSubTab.value = type;
    worksPagination.value.current = 1; // 重置到第一页
    fetchUserWorks();
}

// 分页跳转
const changePage = (page) => {
    if (page < 1 || page > worksPagination.value.totalPages) return;
    worksPagination.value.current = page;
    fetchUserWorks();
    // 滚动回顶部 (可选)
    document.querySelector('.works-container')?.scrollTo({ top: 0, behavior: 'smooth' });
}

// 删除作品
const handleDeleteWork = async (work) => {
    if (!confirm(`确定要删除《${work.title}》吗？`)) return;

    try {
        let endpoint = `/articles/${work.id}`;
        // 根据当前的子Tab判断调用哪个接口
        if (worksSubTab.value === 'video') endpoint = `/videos/${work.id}`;
        else if (worksSubTab.value === 'audio') endpoint = `/audios/${work.id}`;
        // article 和 short 都走 articles 接口

        const res = await api.delete(endpoint);
        if (res.data.success) {
            message.success('已删除');
            fetchUserWorks(); // 刷新当前页
        }
    } catch (err) {
        message.error('删除失败');
    }
}

// 🔥 新增：编辑模式状态
const isEditing = ref(false)
const currentEditingId = ref(null)

// 监听主 Tab 切换到 'works'
watch(activeTab, (newVal) => {
    if (newVal === 'works') {
        fetchUserWorks();
    }
})

// 🔥 新增：处理点击“编辑”按钮
const handleEditWork = (work) => {
    console.log('正在编辑:', work);
    isEditing.value = true;
    currentEditingId.value = work.id;

    // 1. 根据类型切换到对应的 Tab
    // 注意：work.work_type 已经在列表中清洗过了 (article, short, video, audio)
    activeTab.value = work.work_type;

    // 2. 数据回填逻辑
    if (work.work_type === 'article') {
        articleForm.value = {
            title: work.title,
            summary: work.summary,
            content: work.content, // 注意：列表接口需要返回 content 字段
            category: work.category,
            cover_image: work.cover_image,
            column_id: null // 暂时不回填专栏，或者你需要后端返回 column_id
        };
    }
    else if (work.work_type === 'short') {
        shortForm.value = {
            title: work.title,
            summary: work.summary,
            content: work.content,
            category: work.category,
            cover_image: work.cover_image,
            column_id: null,
            images: [] // 图片列表很难从 Markdown 反解回数组，这里留空，用户直接在编辑器里改
        };
    }
    else if (work.work_type === 'video') {
        videoForm.value = {
            title: work.title,
            description: work.summary, // 注意字段映射：列表叫 summary，表单叫 description
            video_url: work.video_url,
            cover_url: work.cover_image, // 列表叫 cover_image，表单叫 cover_url
            category: work.category,
            column_id: null
        };
    }
    else if (work.work_type === 'audio') {
        audioForm.value = {
            title: work.title,
            description: work.summary,
            audio_url: work.audio_url,
            cover_url: work.cover_image,
            category: work.category,
            column_id: null
        };
    }

    message.info('已进入编辑模式，修改完成后请保存');
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 🔥 新增：取消编辑 / 重置表单
const resetForm = () => {
    isEditing.value = false;
    currentEditingId.value = null;
    // 清空表单
    articleForm.value = { title: '', summary: '', content: '', category: sysCategories.value[0]?.name, column_id: null, cover_image: '' };
    shortForm.value = { title: '', summary: '', content: '', category: sysCategories.value[0]?.name, column_id: null, images: [] };
    videoForm.value = { title: '', description: '', video_url: '', cover_url: '', category: sysCategories.value[0]?.name, column_id: null };
    audioForm.value = { title: '', description: '', audio_url: '', cover_url: '', category: sysCategories.value[0]?.name, column_id: null };
}

// 🔥 新增：社交列表状态
const socialList = ref([])
const socialPagination = ref({ current: 1, pageSize: 12, total: 0, totalPages: 1 })
const isLoadingSocial = ref(false)

// 获取社交列表 (type: 'followers' | 'following')
const fetchSocialList = async (type) => {
    isLoadingSocial.value = true;
    const endpoint = type === 'fans' ? '/user/followers' : '/user/following';

    try {
        const res = await api.get(endpoint, {
            params: {
                page: socialPagination.value.current,
                limit: socialPagination.value.pageSize
            }
        });

        if (res.data.success) {
            socialList.value = res.data.data.list;
            const p = res.data.data.pagination;
            socialPagination.value = {
                current: p.current,
                pageSize: p.pageSize,
                total: p.total,
                totalPages: p.totalPages
            };
        }
    } catch (err) {
        console.error(err);
        message.error('加载列表失败');
    } finally {
        isLoadingSocial.value = false;
    }
}

// 社交列表翻页
const changeSocialPage = (page) => {
    if (page < 1 || page > socialPagination.value.totalPages) return;
    socialPagination.value.current = page;
    fetchSocialList(activeTab.value);
}

// 监听内部 Tab 切换
watch(activeTab, (newVal) => {
    if (newVal === 'works') fetchUserWorks();
    else if (newVal === 'fans' || newVal === 'follows') {
        socialPagination.value.current = 1;
        fetchSocialList(newVal);
    }
})

// 监听 Tab 切换，如果切走了，询问是否退出编辑模式（或者自动退出）
watch(activeTab, (newTab, oldTab) => {
    if (newTab === 'works') {
        fetchUserWorks();
    }
    // 如果正在编辑，但用户手动点了其他 Tab (且不是为了去编辑对应的 Tab)，则重置
    // 这里简单处理：只要手动切 Tab，就视为放弃编辑
    if (isEditing.value && newTab !== oldTab) {
        // 这里可以加个 confirm，为了体验流畅我们先不加，或者仅当切换到 'works' 时重置
        if (newTab === 'works') {
            resetForm();
        }
    }
})

// 🔥🔥🔥 核心修复：监听路由变化，实现从 Profile 跳转 🔥🔥🔥
watch(
    () => route.query.tab,
    (newTab) => {
        if (newTab && ['article', 'video', 'audio', 'short', 'works', 'fans', 'follows'].includes(newTab)) {
            activeTab.value = newTab;
            // 立即触发数据加载
            if (newTab === 'works') fetchUserWorks();
            else if (newTab === 'fans' || newTab === 'follows') fetchSocialList(newTab);
        }
    },
    { immediate: true } // 立即执行，处理刷新或初次进入的情况
);

onMounted(() => {
    fetchCategories()
    fetchUserColumns()
    // 🔥 自动选中分类
    if (route.query.category) {
        articleForm.value.category = route.query.category;
    }
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
                </div>
            </aside>

            <main class="creation-workspace animate__animated animate__fadeIn">
                <!-- 纯文章 -->
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
                                            <option v-for="col in userColumns" :key="col.id" :value="col.id">📘 {{
                                                col.name }}</option>
                                            <option value="__new_column__" class="new-col-opt">+ 开启新专栏...</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div class="action-group">
                                <button v-if="isEditing" class="med-cancel-btn"
                                    @click="resetForm(); activeTab = 'works'">
                                    取消修改
                                </button>
                                <button class="med-publish-btn" @click="submitArticle" :disabled="isSubmitting">
                                    <span>{{ isSubmitting ? '处理中...' : (isEditing ? 'SAVE / 保存修改' : 'PUBLISH / 立即发布')
                                        }}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- 图文 -->
                <section v-else-if="activeTab === 'short'"
                    class="workspace-card mediterranean-theme animate__animated animate__fadeIn"
                    :class="{ 'is-sealed': isSuccess }">
                    <div v-if="isSuccess" class="wax-seal-stamp animate__animated animate__bounceInDown">
                        <div class="seal-inner">V</div>
                    </div>

                    <div class="studio-header">
                        <input v-model="shortForm.title" class="elegant-title-input" placeholder="Galleria / 图文标题...">
                        <div class="summary-input-container">
                            <input v-model="shortForm.summary" class="elegant-summary-input"
                                placeholder="Didascalia / 写一段简短的描述...">
                        </div>
                        <div class="header-divider"></div>
                    </div>

                    <div class="studio-body short-layout">
                        <div class="photo-upload-zone" @click="shortImagesInput.click()">
                            <div class="upload-placeholder" v-if="shortForm.images.length === 0">
                                <span class="upload-icon">📸</span>
                                <p>点击添加图片 (支持多选)</p>
                                <small>记录美好瞬间</small>
                            </div>

                            <div class="photo-grid" v-else>
                                <div v-for="(img, index) in shortForm.images" :key="img" class="photo-item"
                                    :class="{ 'is-dragging': dragStartIndex === index }" draggable="true"
                                    @dragstart="handleDragStart(index)" @dragover.prevent @dragenter.prevent
                                    @drop="handleDrop(index)" @click.stop>
                                    <img :src="getProxyUrl(img)" />

                                    <div class="delete-btn" @click.stop="removeShortImage(index)">
                                        ×
                                    </div>

                                    <div class="drag-handle">
                                        <span>⋮⋮</span>
                                    </div>
                                </div>

                                <div class="photo-add-btn">
                                    <span>+</span>
                                </div>
                            </div>

                            <input type="file" ref="shortImagesInput" hidden multiple accept="image/*"
                                @change="handleShortImagesUpload" @click.stop>
                        </div>

                        <div class="text-editor-zone">
                            <div class="editor-pane">
                                <div class="label-tag">Story / 故事详情</div>
                                <textarea ref="shortContentRef" v-model="shortForm.content"
                                    class="italian-textarea short-textarea"
                                    placeholder="在这里写下图片的故事... (图片会自动插入到这里)"></textarea>
                            </div>
                        </div>
                    </div>

                    <div class="studio-footer">
                        <div class="footer-inner-layout">
                            <div class="config-group">
                                <div class="med-select-wrapper">
                                    <span class="med-label">Canale / 公共频道</span>
                                    <div class="select-box-styled">
                                        <select v-model="shortForm.category" class="med-select">
                                            <option v-for="cat in sysCategories" :key="cat.id" :value="cat.name">
                                                {{ cat.icon }} {{ cat.name }}
                                            </option>
                                        </select>
                                    </div>
                                </div>
                                <div class="med-select-wrapper">
                                    <span class="med-label">Collezione / 个人专栏</span>
                                    <div class="select-box-styled">
                                        <select v-model="shortForm.column_id" class="med-select"
                                            @change="handleColumnChange">
                                            <option :value="null">-- 不归入专栏 --</option>
                                            <option v-for="col in userColumns" :key="col.id" :value="col.id">📘 {{
                                                col.name }}</option>
                                            <option value="__new_column__" class="new-col-opt">+ 开启新专栏...</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div class="action-group">
                                <button v-if="isEditing" class="med-cancel-btn"
                                    @click="resetForm(); activeTab = 'works'">
                                    取消修改
                                </button>
                                <button class="med-publish-btn" @click="submitShort" :disabled="isSubmitting">
                                    <span>{{ isSubmitting ? '定格中...' : (isEditing ? 'SAVE / 保存修改' : 'SHARE / 分享此刻')
                                        }}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- 视频 -->
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
                                    <small>MP4 / MOV (500MB以内)</small>
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
                                    <div class="select-box-styled">
                                        <select v-model="videoForm.category" class="med-select">
                                            <option v-for="cat in sysCategories" :key="cat.id" :value="cat.name">
                                                {{ cat.icon }} {{ cat.name }}
                                            </option>
                                        </select>
                                    </div>
                                </div>
                                <div class="med-select-wrapper">
                                    <span class="med-label">Collezione / 个人专栏</span>
                                    <div class="select-box-styled">
                                        <select v-model="videoForm.column_id" class="med-select"
                                            @change="handleColumnChange">
                                            <option :value="null">-- 不归入专栏 --</option>
                                            <option v-for="col in userColumns" :key="col.id" :value="col.id">📘 {{
                                                col.name }}</option>
                                            <option value="__new_column__" class="new-col-opt">+ 开启新专栏...</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div class="action-group">
                                <button v-if="isEditing" class="med-cancel-btn"
                                    @click="resetForm(); activeTab = 'works'">
                                    取消修改
                                </button>
                                <button class="med-publish-btn" @click="submitVideo"
                                    :disabled="isSubmitting || isUploading">
                                    <span>{{ isSubmitting ? '处理中...' : (isEditing ? 'SAVE / 保存修改' : 'EXHIBIT / 立即发布')
                                        }}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- 音频 -->
                <section v-else-if="activeTab === 'audio'"
                    class="workspace-card mediterranean-theme animate__animated animate__fadeIn"
                    :class="{ 'is-sealed': isSuccess }">
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
                                            <option v-for="col in userColumns" :key="col.id" :value="col.id">📘 {{
                                                col.name }}</option>
                                            <option value="__new_column__" class="new-col-opt">+ 开启新专栏...</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div class="action-group">
                                <button v-if="isEditing" class="med-cancel-btn"
                                    @click="resetForm(); activeTab = 'works'">
                                    取消修改
                                </button>
                                <button class="med-publish-btn" @click="submitAudio"
                                    :disabled="isSubmitting || isAudioUploading">
                                    <span>{{ isSubmitting ? '刻录中...' : (isEditing ? 'SAVE / 保存修改' : 'RELEASE / 立即发行')
                                        }}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- 作品管理 -->
                <section v-else-if="activeTab === 'works'"
                    class="workspace-card mediterranean-theme animate__animated animate__fadeIn">

                    <div class="studio-header works-header">
                        <h2 class="works-title">My Portfolio / 作品管理</h2>
                        <div class="works-sub-nav">
                            <div v-for="tab in worksNavItems" :key="tab.id" class="sub-nav-item"
                                :class="{ active: worksSubTab === tab.id }" @click="handleWorksTabChange(tab.id)">
                                {{ tab.label }}
                            </div>
                        </div>
                        <div class="header-divider"></div>
                    </div>

                    <div class="works-container">
                        <div v-if="isLoadingWorks" class="loading-box">
                            <div class="spinner"></div>
                        </div>

                        <div v-else-if="userWorks.length > 0" class="works-list-wrapper">
                            <div class="works-list">
                                <div v-for="work in userWorks" :key="work.id" class="work-item-wrapper">
                                    <button class="delete-work-btn" @click.stop="handleDeleteWork(work)" title="删除此作品">
                                        <span>🗑️</span>
                                    </button>

                                    <button class="edit-work-btn" @click.stop="handleEditWork(work)" title="编辑此作品">
                                        <span>✎</span>
                                    </button>

                                    <ArticleItem :data="work"
                                        @click="router.push({ path: `/article/${work.id}`, query: { type: work.work_type } })" />
                                </div>
                            </div>

                            <div class="pagination-bar" v-if="worksPagination.totalPages > 1">
                                <button class="page-btn" :disabled="worksPagination.current === 1"
                                    @click="changePage(worksPagination.current - 1)">
                                    ← 上一页
                                </button>

                                <span class="page-info">
                                    {{ worksPagination.current }} / {{ worksPagination.totalPages }}
                                </span>

                                <button class="page-btn"
                                    :disabled="worksPagination.current === worksPagination.totalPages"
                                    @click="changePage(worksPagination.current + 1)">
                                    下一页 →
                                </button>
                            </div>
                        </div>

                        <div v-else class="empty-state-works">
                            <span class="empty-icon">🍃</span>
                            <p>该分类下暂无作品，快去创作吧！</p>
                            <button class="create-now-btn" @click="activeTab = worksSubTab">立即创作</button>
                        </div>
                    </div>
                </section>

                <!-- 粉丝和关注 -->
                <section v-else-if="activeTab === 'fans' || activeTab === 'follows'"
                    class="workspace-card mediterranean-theme animate__animated animate__fadeIn">

                    <div class="studio-header works-header">
                        <h2 class="works-title">
                            {{ activeTab === 'fans' ? 'My Fans / 粉丝列表' : 'Following / 我的关注' }}
                        </h2>
                        <div class="header-divider"></div>
                    </div>

                    <div class="works-container">
                        <div v-if="isLoadingSocial" class="loading-box">
                            <div class="spinner"></div>
                        </div>

                        <div v-else-if="socialList.length > 0" class="social-list-wrapper">
                            <div class="social-grid">
                                <div v-for="user in socialList" :key="user.id" class="user-card"
                                    @click="router.push(`/profile/${user.username}`)">
                                    <div class="card-avatar">
                                        <img :src="getProxyUrl(user.avatar)" alt="avatar">
                                    </div>
                                    <div class="card-info">
                                        <h3 class="card-name">{{ user.nickname || user.username }}</h3>
                                        <p class="card-bio">{{ user.bio || '这个人很懒，什么都没写~' }}</p>
                                        <div class="card-stats">
                                            <span><b>{{ user.fans_count }}</b> 粉丝</span>
                                            <span class="divider">|</span>
                                            <span><b>{{ user.follow_count }}</b> 关注</span>
                                        </div>
                                    </div>
                                    <div class="card-action" v-if="activeTab === 'fans' && user.is_following">
                                        <span class="mutual-tag">互相关注</span>
                                    </div>
                                </div>
                            </div>

                            <div class="pagination-bar" v-if="socialPagination.totalPages > 1">
                                <button class="page-btn" :disabled="socialPagination.current === 1"
                                    @click="changeSocialPage(socialPagination.current - 1)">←</button>
                                <span class="page-info">{{ socialPagination.current }} / {{ socialPagination.totalPages
                                }}</span>
                                <button class="page-btn"
                                    :disabled="socialPagination.current === socialPagination.totalPages"
                                    @click="changeSocialPage(socialPagination.current + 1)">→</button>
                            </div>
                        </div>

                        <div v-else class="empty-state-works">
                            <span class="empty-icon">🍃</span>
                            <p>{{ activeTab === 'fans' ? '还没有粉丝哦，快去发布作品吧！' : '你还没有关注任何人呢~' }}</p>
                        </div>
                    </div>
                </section>
            </main>
        </div>

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

/* ==================== 🔙 极致优化的返回按钮交互 ==================== */

.header-left {
    display: flex;
    align-items: center;
    gap: 15px;
    cursor: pointer;
    /* 让整个区域都显示小手 */
    padding: 10px;
    margin-left: -10px;
    /* 视觉修正，让 hover 背景不突兀 */
    border-radius: 12px;
    transition: all 0.3s ease;
}

/* 整个区域悬停时，背景微微变亮 */
.header-left:hover {
    background: rgba(255, 255, 255, 0.6);
}

.back-btn {
    /* 1. 基础形态：圆形玻璃质感 */
    width: 42px;
    height: 42px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.8);
    border: 1px solid rgba(0, 0, 0, 0.08);
    font-size: 1.2rem;
    color: #64748b;
    font-family: system-ui, -apple-system, sans-serif;
    /* 确保箭头符号标准显示 */

    /* 2. 核心动画配置：贝塞尔曲线实现 Q 弹效果 */
    transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);

    position: relative;
    overflow: hidden;
    /* 防止点击波纹溢出 */
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
}

/* --- 🖱️ 悬停效果 (Hover) --- */
.header-left:hover .back-btn {
    color: #42b883;
    /* 变绿 */
    border-color: #42b883;
    background: #fff;
    /* 向左轻微位移，心理暗示“返回” */
    transform: translateX(-4px) scale(1.05);
    /* 绿色光晕 */
    box-shadow: 0 4px 15px rgba(66, 184, 131, 0.3);
}

/* --- 👆 点击效果 (Active) --- */
.header-left:active .back-btn {
    /* 模拟物理按压，缩小并下沉 */
    transform: scale(0.9) translateX(-4px);
    background: #e6f7f0;
    /* 点击时背景变深一点的绿 */
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
    /* 内阴影增加深度 */
    transition: all 0.1s ease;
    /* 点击反应要快 */
}

/* --- 🌟 标题文字联动 --- */
.hub-title {
    font-size: 1.4rem;
    color: #1e293b;
    display: flex;
    flex-direction: column;
    transition: transform 0.3s ease;
    /* 文字也加个过渡 */
}

/* 鼠标放上去时，标题也微微动一下，增加整体感 */
.header-left:hover .hub-title {
    transform: translateX(2px);
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
    transition: color 0.3s;
}

.header-left:hover .hub-title small {
    color: #42b883;
    /* 小标题也跟着变绿 */
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

/* 底部按钮组容器 */
.action-group {
    display: flex;
    gap: 15px;
    align-items: center;
}

/* 取消按钮样式 */
.med-cancel-btn {
    background: transparent;
    border: 1px solid #d2a679;
    /* 与主题色呼应的边框 */
    color: #8b5a2b;
    padding: 14px 30px;
    /* 调整大小与发布按钮协调 */
    border-radius: 2px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 600;
    transition: all 0.3s;
}

.med-cancel-btn:hover {
    background: rgba(210, 166, 121, 0.1);
    transform: translateY(-2px);
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


/* ==================== 📸 图文专用布局 ==================== */

.short-layout {
    display: grid;
    grid-template-columns: 350px 1fr;
    /* 左侧图片区窄一点，右侧文字区宽 */
    gap: 30px;
    height: 600px;
}

.photo-upload-zone {
    background: rgba(255, 255, 255, 0.4);
    border: 1.5px dashed #d2a679;
    border-radius: 8px;
    padding: 15px;
    cursor: pointer;
    transition: all 0.3s;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
}

.photo-upload-zone:hover {
    background: rgba(255, 255, 255, 0.8);
    border-color: #8b5a2b;
}

.upload-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #bca38a;
    text-align: center;
}

.upload-icon {
    font-size: 3rem;
    margin-bottom: 10px;
}

.photo-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
}

.photo-item {
    width: 100%;
    aspect-ratio: 1;
    border-radius: 6px;
    overflow: hidden;
    position: relative;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
    transition: transform 0.2s, box-shadow 0.2s;
    /* 增加阴影过渡 */
    cursor: grab;
    /* 鼠标变成抓手 */
}

.photo-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

/* 🔥 新增：拖拽时的样式 - 正在被拖动的那个元素变为半透明 */
.photo-item.is-dragging {
    opacity: 0.4;
    border: 2px dashed #d2a679;
    transform: scale(0.95);
}

/* 🔥 新增：拖拽悬停时的交互 - 增加一点按压感 */
.photo-item:active {
    cursor: grabbing;
}

/* 🔥 新增：拖拽手柄样式 (左下角或者任意你喜欢的位置) */
.drag-handle {
    position: absolute;
    bottom: 5px;
    left: 5px;
    color: rgba(255, 255, 255, 0.8);
    background: rgba(0, 0, 0, 0.3);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
    pointer-events: none;
    /* 让鼠标事件穿透，不影响拖拽主体 */
    opacity: 0;
    transition: opacity 0.3s;
}

.photo-item:hover .drag-handle {
    opacity: 1;
}

/* 🔥 新增：删除按钮样式 */
.delete-btn {
    position: absolute;
    top: 5px;
    right: 5px;
    width: 24px;
    height: 24px;
    background: rgba(0, 0, 0, 0.6);
    /* 半透明黑色背景 */
    color: #fff;
    border-radius: 50%;
    /* 圆形 */
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    opacity: 0;
    /* 默认隐藏 */
    transition: all 0.3s ease;
    z-index: 20;
}

.delete-btn:hover {
    background: #ff3b30;
    /* 悬停在按钮上时变红，提示删除 */
    transform: scale(1.1);
}

/* 🔥 新增：当鼠标悬停在图片上时，显示删除按钮 */
.photo-item:hover .delete-btn {
    opacity: 1;
}

.photo-add-btn {
    width: 100%;
    aspect-ratio: 1;
    border: 2px dashed #d2a679;
    border-radius: 6px;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 2rem;
    color: #d2a679;
    background: rgba(255, 255, 255, 0.5);
    transition: all 0.2s;
}

.photo-add-btn:hover {
    background: #fff;
    color: #8b5a2b;
}

.text-editor-zone {
    height: 100%;
    display: flex;
    flex-direction: column;
}

.short-textarea {
    background: rgba(255, 255, 255, 0.6);
    /* 稍微不透明一点 */
    height: 100%;
}

/* 🔥 作品管理样式 */
.works-title {
    font-family: "Georgia", serif;
    color: #4a3c28;
    font-size: 1.8rem;
    margin-bottom: 5px;
}

.works-container {
    height: 100%;
    overflow-y: auto;
    padding: 0 10px;
    /* 隐藏滚动条但保留功能 */
    scrollbar-width: none;
}

.works-container::-webkit-scrollbar {
    display: none;
}

.works-list {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding-bottom: 40px;
}

.work-item-wrapper {
    position: relative;
    transition: transform 0.2s;
}

.work-item-wrapper:hover {
    transform: translateY(-2px);
}

/* 删除按钮 */
.delete-work-btn {
    position: absolute;
    top: 15px;
    right: 15px;
    z-index: 10;
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid #ffcccc;
    color: #ff4d4f;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    font-size: 14px;
    opacity: 0;
    transition: all 0.3s;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.work-item-wrapper:hover .delete-work-btn {
    opacity: 1;
}

.delete-work-btn:hover {
    background: #ff4d4f;
    color: white;
    transform: scale(1.1);
}

.empty-state-works {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 400px;
    color: #bca38a;
}

.loading-box {
    display: flex;
    justify-content: center;
    padding: 50px;
}

.spinner {
    width: 30px;
    height: 30px;
    border: 3px solid #f3f3f3;
    border-top: 3px solid #d2a679;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

/* 🔥 作品管理专属样式 */

.works-header {
    margin-bottom: 10px;
}

.works-title {
    font-family: "Georgia", serif;
    color: #4a3c28;
    font-size: 1.8rem;
    margin-bottom: 20px;
}

/* 二级导航栏 */
.works-sub-nav {
    display: flex;
    justify-content: center;
    gap: 15px;
    margin-bottom: 15px;
}

.sub-nav-item {
    padding: 8px 24px;
    border-radius: 20px;
    font-size: 0.95rem;
    font-weight: 600;
    color: #8b5a2b;
    background: rgba(255, 255, 255, 0.6);
    border: 1px solid rgba(210, 166, 121, 0.2);
    cursor: pointer;
    transition: all 0.3s;
    user-select: none;
}

.sub-nav-item:hover {
    background: #fff;
    transform: translateY(-2px);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
}

.sub-nav-item.active {
    background: #42b883;
    /* 使用主题绿 */
    color: white;
    border-color: #42b883;
    box-shadow: 0 4px 15px rgba(66, 184, 131, 0.3);
}

/* 列表容器 */
.works-container {
    height: 100%;
    overflow-y: auto;
    padding: 0 5px;
    /* 隐藏滚动条 */
    scrollbar-width: none;
}

.works-container::-webkit-scrollbar {
    display: none;
}

.works-list-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
}

.works-list {
    display: flex;
    flex-direction: column;
    gap: 20px;
    margin-bottom: 30px;
}

.work-item-wrapper {
    position: relative;
    transition: transform 0.2s;
}

.work-item-wrapper:hover {
    transform: translateY(-2px);
    z-index: 2;
    /* 悬浮时层级提高 */
}

/* 删除按钮 */
.delete-work-btn {
    position: absolute;
    top: 15px;
    right: 15px;
    z-index: 10;
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid #ffcccc;
    color: #ff4d4f;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    font-size: 14px;
    opacity: 0;
    /* 默认隐藏 */
    transition: all 0.3s;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.work-item-wrapper:hover .delete-work-btn {
    opacity: 1;
    /* 悬停整行时显示 */
}

.delete-work-btn:hover {
    background: #ff4d4f;
    color: white;
    transform: scale(1.1);
}

/* 分页条 */
.pagination-bar {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 20px;
    margin-top: auto;
    /* 沉底 */
    padding-top: 20px;
    padding-bottom: 20px;
}

.page-btn {
    padding: 8px 16px;
    background: #fff;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    color: #555;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
    border-color: #42b883;
    color: #42b883;
}

.page-btn:disabled {
    background: #f5f5f5;
    color: #ccc;
    cursor: not-allowed;
    border-color: #eee;
}

.page-info {
    font-family: "Georgia", serif;
    font-weight: bold;
    color: #8b5a2b;
}

/* 空状态 */
.empty-state-works {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 300px;
    color: #bca38a;
}

.empty-icon {
    font-size: 3rem;
    margin-bottom: 10px;
}

.create-now-btn {
    margin-top: 15px;
    padding: 8px 20px;
    background: #42b883;
    color: white;
    border: none;
    border-radius: 20px;
    cursor: pointer;
    font-weight: 600;
}

/* 社交卡片网格布局 */
.social-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    /* 强制三列 */
    gap: 20px;
    padding-bottom: 30px;
}

.user-card {
    background: #fff;
    border: 1px solid #eee;
    border-radius: 12px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    transition: all 0.3s;
    cursor: pointer;
    position: relative;
    overflow: hidden;
}

.user-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
    border-color: #d2a679;
}

.card-avatar {
    width: 70px;
    height: 70px;
    border-radius: 50%;
    overflow: hidden;
    border: 3px solid #f8f9fa;
    margin-bottom: 12px;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
}

.card-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.card-name {
    font-size: 1.1rem;
    font-weight: 700;
    color: #333;
    margin: 0 0 6px 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
}

.card-bio {
    font-size: 0.8rem;
    color: #888;
    margin: 0 0 15px 0;
    line-height: 1.5;
    height: 36px;
    /* 限制两行高度 */
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
}

.card-stats {
    font-size: 0.8rem;
    color: #666;
    background: #fcfaf2;
    padding: 6px 15px;
    border-radius: 20px;
    display: flex;
    gap: 10px;
}

.card-stats b {
    color: #d2a679;
    font-weight: 800;
}

.divider {
    color: #ddd;
}

.mutual-tag {
    position: absolute;
    top: 10px;
    right: 10px;
    font-size: 10px;
    color: #42b883;
    background: rgba(66, 184, 131, 0.1);
    padding: 2px 6px;
    border-radius: 4px;
}

/* 响应式适配 */
@media (max-width: 1100px) {
    .social-grid {
        grid-template-columns: repeat(2, 1fr);
        /* 窄屏变两列 */
    }
}

@media (max-width: 768px) {
    .social-grid {
        grid-template-columns: 1fr;
        /* 手机单列 */
    }
}
</style>