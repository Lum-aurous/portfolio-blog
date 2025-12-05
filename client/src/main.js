import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router.js' // 👈 引入刚才写的路由配置

createApp(App)
    .use(router) // 👈 告诉 Vue 使用路由
    .mount('#app')