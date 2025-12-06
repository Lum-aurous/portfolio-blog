<script setup>
import Navbar from './components/Navbar.vue' 
</script>

<template>
  <div class="background-animate"></div> <Navbar />
  
  <router-view></router-view>
</template>

<style>
/* 这里不需要写样式了，都放在 style.css 里了 */
</style>