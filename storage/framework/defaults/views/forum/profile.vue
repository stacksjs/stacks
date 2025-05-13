<template>
  <ForumLayout route="forum-profile">
    <div class="max-w-4xl mx-auto">
      <ForumBreadcrumb :items="[
        { label: 'Forum', link: '/forum' },
        { label: 'Members', link: '/forum/members' },
        { label: 'JohnDoe', link: '/forum/profile/johndoe' }
      ]" />

      <div class="bg-white border rounded-md mb-8">
        <div class="p-6 flex flex-col md:flex-row gap-6">
          <div class="flex flex-col items-center">
            <img src="/images/avatars/default.png" alt="JohnDoe" class="w-32 h-32 rounded-full">
            <div class="mt-4 text-center">
              <h1 class="text-xl font-bold">JohnDoe</h1>
              <div class="text-sm text-gray-500">Member since Jan 2023</div>
              <div class="mt-2 flex justify-center gap-2">
                <span class="bg-primary text-white text-xs px-2 py-1 rounded">Regular</span>
                <span class="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded">Staff</span>
              </div>
            </div>

            <div class="mt-4 w-full flex flex-col gap-2">
              <button class="w-full px-3 py-2 bg-primary text-white rounded-md hover:opacity-90 flex items-center justify-center">
                <span class="i-hugeicons-message mr-1"></span>
                Message
              </button>
              <button class="w-full px-3 py-2 border rounded-md hover:bg-gray-100 flex items-center justify-center">
                <span class="i-hugeicons-user-plus mr-1"></span>
                Follow
              </button>
            </div>
          </div>

          <div class="flex-grow">
            <div class="flex flex-wrap gap-4 mb-6">
              <div class="flex-grow min-w-32 p-4 border rounded-md text-center">
                <div class="text-2xl font-bold">256</div>
                <div class="text-sm text-gray-500">Topics</div>
              </div>
              <div class="flex-grow min-w-32 p-4 border rounded-md text-center">
                <div class="text-2xl font-bold">1,543</div>
                <div class="text-sm text-gray-500">Posts</div>
              </div>
              <div class="flex-grow min-w-32 p-4 border rounded-md text-center">
                <div class="text-2xl font-bold">87</div>
                <div class="text-sm text-gray-500">Solutions</div>
              </div>
              <div class="flex-grow min-w-32 p-4 border rounded-md text-center">
                <div class="text-2xl font-bold">12.5k</div>
                <div class="text-sm text-gray-500">Reputation</div>
              </div>
            </div>

            <div class="mb-6">
              <h2 class="text-lg font-medium mb-2">About</h2>
              <div class="border rounded-md p-4">
                <p>Full-stack developer with 5+ years of experience in web development. Passionate about JavaScript, Vue.js, and building great user experiences with Stacks.js. Currently working on several open-source projects and contributing to the Stacks.js ecosystem.</p>
                <div class="mt-4 flex flex-wrap gap-2">
                  <span class="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">JavaScript</span>
                  <span class="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">Vue.js</span>
                  <span class="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">Node.js</span>
                  <span class="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">TypeScript</span>
                  <span class="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">Stacks.js</span>
                </div>
              </div>
            </div>

            <div>
              <h2 class="text-lg font-medium mb-2">Contact & Social</h2>
              <div class="border rounded-md p-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <a href="https://johndoe.dev" target="_blank" class="flex items-center gap-2 text-gray-600 hover:text-primary">
                    <span class="i-hugeicons-globe"></span>
                    <span>johndoe.dev</span>
                  </a>
                  <a href="https://github.com/johndoe" target="_blank" class="flex items-center gap-2 text-gray-600 hover:text-primary">
                    <span class="i-hugeicons-github"></span>
                    <span>github.com/johndoe</span>
                  </a>
                  <a href="https://twitter.com/johndoe" target="_blank" class="flex items-center gap-2 text-gray-600 hover:text-primary">
                    <span class="i-hugeicons-twitter"></span>
                    <span>twitter.com/johndoe</span>
                  </a>
                  <a href="https://linkedin.com/in/johndoe" target="_blank" class="flex items-center gap-2 text-gray-600 hover:text-primary">
                    <span class="i-hugeicons-linkedin"></span>
                    <span>linkedin.com/in/johndoe</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="mb-8">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-medium">Recent Activity</h2>
          <div class="flex gap-2">
            <button class="px-3 py-1 bg-gray-100 rounded-md text-sm font-medium">Topics</button>
            <button class="px-3 py-1 hover:bg-gray-100 rounded-md text-sm">Replies</button>
            <button class="px-3 py-1 hover:bg-gray-100 rounded-md text-sm">Solutions</button>
          </div>
        </div>

        <div class="border rounded-md divide-y">
          <ForumTopicItem
            title="How to implement authentication in a new Stacks.js project?"
            link="/forum/topic/1"
            authorName="JohnDoe"
            authorAvatar="/images/avatars/default.png"
            createdAt="2 hours ago"
            :viewCount="45"
            :replyCount="3"
            :likeCount="7"
            category="Technical Support"
            categoryLink="/forum/category/support/installation"
            excerpt="I'm trying to implement authentication in my new project but I'm having some issues with the middleware..."
          />
          <ForumTopicItem
            title="Best practices for database migrations in Stacks.js"
            link="/forum/topic/3"
            authorName="JohnDoe"
            authorAvatar="/images/avatars/default.png"
            createdAt="1 day ago"
            :viewCount="128"
            :replyCount="15"
            :likeCount="24"
            category="General Discussion"
            categoryLink="/forum/category/general/chat"
            isSolved
          />
          <ForumTopicItem
            title="Vue 3 composition API vs options API in Stacks.js components"
            link="/forum/topic/5"
            authorName="JohnDoe"
            authorAvatar="/images/avatars/default.png"
            createdAt="3 days ago"
            :viewCount="256"
            :replyCount="32"
            :likeCount="48"
            category="General Discussion"
            categoryLink="/forum/category/general/chat"
          />
        </div>

        <div class="mt-4 text-center">
          <a href="/forum/profile/johndoe/topics" class="text-primary hover:underline">View all activity</a>
        </div>
      </div>

      <div>
        <h2 class="text-lg font-medium mb-4">Badges & Achievements</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          <div class="border rounded-md p-4 flex flex-col items-center text-center">
            <div class="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-2">
              <span class="i-hugeicons-trophy text-xl"></span>
            </div>
            <div class="font-medium">Top Contributor</div>
            <div class="text-xs text-gray-500">Earned May 2023</div>
          </div>
          <div class="border rounded-md p-4 flex flex-col items-center text-center">
            <div class="w-12 h-12 bg-success/10 text-success rounded-full flex items-center justify-center mb-2">
              <span class="i-hugeicons-lightbulb text-xl"></span>
            </div>
            <div class="font-medium">Problem Solver</div>
            <div class="text-xs text-gray-500">Earned Jun 2023</div>
          </div>
          <div class="border rounded-md p-4 flex flex-col items-center text-center">
            <div class="w-12 h-12 bg-secondary/10 text-secondary rounded-full flex items-center justify-center mb-2">
              <span class="i-hugeicons-heart text-xl"></span>
            </div>
            <div class="font-medium">Helpful Member</div>
            <div class="text-xs text-gray-500">Earned Aug 2023</div>
          </div>
          <div class="border rounded-md p-4 flex flex-col items-center text-center">
            <div class="w-12 h-12 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center mb-2">
              <span class="i-hugeicons-calendar text-xl"></span>
            </div>
            <div class="font-medium">1 Year Member</div>
            <div class="text-xs text-gray-500">Earned Jan 2024</div>
          </div>
        </div>
      </div>
    </div>
  </ForumLayout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import ForumLayout from '../../components/Forum/ForumLayout.vue'
import ForumBreadcrumb from '../../components/Forum/ForumBreadcrumb.vue'
import ForumTopicItem from '../../components/Forum/ForumTopicItem.vue'

// Get the username from the route params
const route = useRoute()
const username = computed(() => route.params.username as string || '')

// In a real app, we would fetch the user data based on the username
// For now, we'll simulate it with some static data
const user = computed(() => {
  // Sample user data
  return {
    username: username.value,
    name: username.value === 'johndoe' ? 'John Doe' : username.value,
    avatar: '/images/avatars/default.png',
    joinDate: 'January 15, 2023',
    bio: 'Full-stack developer passionate about Stacks.js and modern web development.',
    location: 'San Francisco, CA',
    website: 'https://johndoe.dev',
    github: 'johndoe',
    twitter: 'johndoe',
    topicCount: 12,
    replyCount: 48,
    reputation: 156,
    badges: [
      { name: 'New Member', icon: 'i-hugeicons-user-plus' },
      { name: 'Helpful', icon: 'i-hugeicons-lightbulb' },
      { name: 'Problem Solver', icon: 'i-hugeicons-check-circle' }
    ]
  }
})
</script>