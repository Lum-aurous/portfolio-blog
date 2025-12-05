# 🚀 My Personal Portfolio & Blog

这是一个基于 **Vue 3** 和 **Node.js** 全栈开发的个人博客系统。它不仅是我的个人简历展示页，还包含了一个功能完备的内容管理系统 (CMS)。

## ✨ 主要功能 (Features)

- **前台展示**
  - 🎨 **精美 UI**: 响应式设计，支持 **深色模式 (Dark Mode)** 一键切换。
  - 📱 **移动端适配**: 完美支持手机访问。
  - 📄 **简历展示**: 动态展示个人简介、技术栈、GitHub 链接。
  - 📝 **博客阅读**: 浏览文章列表及详情，支持 Markdown 渲染。
  - 💬 **互动评论**: 访客需登录后评论，支持回复互动。

- **后台管理 (Admin)**
  - 🔐 **安全体系**: 
    - RBAC 角色权限控制 (管理员/普通用户)。
    - **bcrypt** 密码加密存储，银行级安全性。
    - 路由守卫拦截非法访问。
  - ✍️ **文章发布**: 支持标题、摘要、内容编辑。
  - 🖼️ **图片上传**: 集成 **Multer**，支持封面图上传与预览。
  - 🛠️ **评论管理**: 管理员拥有专属标签，可删除违规评论。

## 🛠 技术栈 (Tech Stack)

- **前端**: Vue 3, Vite, Vue Router, Axios, CSS Variables
- **后端**: Node.js, Express, Multer (File Upload)
- **数据库**: MySQL 8.0
- **工具**: Git, cpolar (内网穿透)

## 📸 项目截图

*(此处可以上传几张你网站运行的截图，展示首页、后台等效果)*

## 🚀 如何运行 (How to run)

### 1. 克隆项目
\`\`\`bash
git clone https://github.com/YourUsername/my-portfolio-blog.git
\`\`\`

### 2. 启动后端
\`\`\`bash
cd server
npm install
# 需在 server/index.js 中配置你的 MySQL 密码
node index.js
\`\`\`

### 3. 启动前端
\`\`\`bash
cd client
npm install
npm run dev
\`\`\`

---
Made with ❤️ by Jack Bo