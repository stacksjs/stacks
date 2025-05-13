<template>
  <div class="space-y-6">
    <!-- Search -->
    <div class="border rounded-md p-4">
      <h3 class="font-medium mb-3">Search</h3>
      <div class="relative">
        <input
          type="text"
          placeholder="Search topics..."
          class="w-full border rounded-md py-2 pl-3 pr-10 focus:outline-none focus:ring-2 focus:ring-primary"
        >
        <button class="absolute right-3 top-2">
          <span class="i-hugeicons-search"></span>
        </button>
      </div>
    </div>

    <!-- Stats -->
    <div class="border rounded-md p-4">
      <h3 class="font-medium mb-3">Forum Stats</h3>
      <div class="space-y-2">
        <div class="flex justify-between">
          <span class="text-gray-600">Topics:</span>
          <span class="font-medium">{{ stats.topics }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-600">Posts:</span>
          <span class="font-medium">{{ stats.posts }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-600">Members:</span>
          <span class="font-medium">{{ stats.members }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-600">Newest Member:</span>
          <a href="#" class="text-primary hover:underline">{{ stats.newestMember }}</a>
        </div>
      </div>
    </div>

    <!-- Popular Topics -->
    <div class="border rounded-md p-4">
      <h3 class="font-medium mb-3">Popular Topics</h3>
      <ul class="space-y-3">
        <li v-for="topic in popularTopics" :key="topic.id">
          <a :href="topic.link" class="text-primary hover:underline block line-clamp-1">{{ topic.title }}</a>
          <div class="text-xs text-gray-500 mt-1">
            {{ topic.replyCount }} replies • {{ topic.viewCount }} views
          </div>
        </li>
      </ul>
    </div>

    <!-- Online Users -->
    <div class="border rounded-md p-4">
      <h3 class="font-medium mb-3">Online Now</h3>
      <div class="flex flex-wrap gap-2">
        <div v-for="user in onlineUsers" :key="user.id" class="relative">
          <img :src="user.avatar" :alt="user.name" class="w-8 h-8 rounded-full">
          <span class="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></span>
        </div>
      </div>
      <div class="text-xs text-gray-500 mt-3">
        {{ onlineUsers.length }} users online now
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  stats: {
    topics: number
    posts: number
    members: number
    newestMember: string
  }
  popularTopics: Array<{
    id: string | number
    title: string
    link: string
    replyCount: number
    viewCount: number
  }>
  onlineUsers: Array<{
    id: string | number
    name: string
    avatar: string
  }>
}>()
</script>