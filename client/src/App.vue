<script setup>
import Navbar from './components/Navbar.vue' // 引入导航栏
</script>

<template>
  <Navbar />
  
  <router-view></router-view>
</template>

<style>
/* 这里不需要写样式了，都放在 style.css 里了 */
</style>