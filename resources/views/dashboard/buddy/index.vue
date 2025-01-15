<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

interface User {
  id: number
  name: string
  email: string
  avatar: string
}

interface Conversation {
  id: number
  name: string
  lastMessage: string
  timestamp: string
  unread: boolean
  type: 'ai' | 'human'
  status: 'online' | 'offline'
}

interface Message {
  id: number
  content: string
  timestamp: string
  type: 'ai' | 'human'
  codeSnippet?: {
    language: string
    code: string
  }
  user: User
}

const route = useRoute()
const router = useRouter()

const activeConversation = ref<number>(1)

const conversations = ref<Conversation[]>([
  {
    id: 1,
    name: 'New Project Setup',
    lastMessage: 'I can help you set up a new Stacks.js project with TypeScript',
    timestamp: 'Moments ago',
    unread: true,
    type: 'ai',
    status: 'online'
  },
  {
    id: 2,
    name: 'Database Migration',
    lastMessage: 'Here\'s how to run your first migration in Stacks.js',
    timestamp: '2h ago',
    unread: false,
    type: 'ai',
    status: 'online'
  },
  {
    id: 3,
    name: 'API Documentation',
    lastMessage: 'Generated API documentation for your endpoints',
    timestamp: '1d ago',
    unread: false,
    type: 'ai',
    status: 'online'
  }
])

const messages = ref<Message[]>([
  {
    id: 1,
    type: 'human',
    user: {
      id: 1,
      name: 'Chris',
      email: 'chris@stacksjs.org',
      avatar: 'https://avatars.githubusercontent.com/u/6228425?v=4'
    },
    content: 'How do I create a new Stacks.js project with TypeScript?',
    timestamp: '2:30 PM'
  },
  {
    id: 2,
    type: 'ai',
    user: {
      id: 0,
      name: 'Buddy',
      email: 'ai@stacksjs.org',
      avatar: ''  // Will fallback to the AI circle
    },
    content: 'I can help you set up a new Stacks.js project. First, let\'s create a new project using the CLI:',
    timestamp: '2:31 PM',
    codeSnippet: {
      language: 'bash',
      code: 'npm create stacks@latest my-app\ncd my-app\npnpm install'
    }
  }
])

const newMessage = ref('')

const sendMessage = () => {
  if (newMessage.value.trim()) {
    const message: Message = {
      id: messages.value.length + 1,
      type: 'human',
      user: {
        id: 1,
        name: 'Chris',
        email: 'chris@stacksjs.org',
        avatar: '/avatars/chris.jpg'
      },
      content: newMessage.value,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    messages.value.push(message)
    newMessage.value = ''

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: messages.value.length + 1,
        type: 'ai',
        user: {
          id: 0,
          name: 'Buddy',
          email: 'ai@stacksjs.org',
          avatar: '/avatars/stacks-ai.jpg'
        },
        content: 'I\'m processing your request. How can I help you with Stacks.js?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
      messages.value.push(aiResponse)
    }, 1000)
  }
}

const selectConversation = (id: number) => {
  activeConversation.value = id
  router.push({ query: { conversation: id } })
}

const isActive = computed(() => (id: number) => activeConversation.value === id)
</script>
<template>
  <div class="h-screen flex bg-gray-100 overflow-hidden">
    <div class="w-80 bg-white border-r border-gray-200 flex flex-col">
      <!-- Sidebar Header -->
      <div class="flex-none p-4 border-b border-gray-200">
        <h2 class="text-lg font-semibold text-gray-900">Conversations</h2>
        <p class="text-sm text-gray-500">Ask any question you may have.</p>
      </div>

      <!-- Conversations List -->
      <div class="flex-1 overflow-y-auto">
        <div v-for="chat in conversations"
             :key="chat.id"
             @click="selectConversation(chat.id)"
             :class="[
               'p-4 cursor-pointer border-b border-gray-200',
               isActive(chat.id) ? 'bg-blue-50' : 'hover:bg-gray-50'
             ]">
          <div class="flex justify-between items-start">
            <div class="flex items-center space-x-3">
              <div class="relative">
                <div class="h-10 w-10 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 flex items-center justify-center">
                  <span class="text-white text-sm font-medium">{{ chat.name.charAt(0) }}</span>
                </div>
                <div v-if="chat.status === 'online'"
                     class="absolute -bottom-0.5 -right-0.5 bg-green-400 rounded-full w-3 h-3 border-2 border-white"></div>
              </div>
              <div>
                <h3 class="text-sm font-medium text-gray-900">{{ chat.name }}</h3>
                <p class="text-sm text-gray-500 mt-1 line-clamp-1">{{ chat.lastMessage }}</p>
              </div>
            </div>
            <div class="flex items-center space-x-2">
              <span class="text-xs text-gray-500 whitespace-nowrap">{{ chat.timestamp }}</span>
              <span v-if="chat.unread"
                    class="bg-blue-500 rounded-full w-2 h-2"></span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 flex flex-col">
      <!-- Chat Header -->
      <div class="flex-none bg-white border-b border-gray-200 p-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-4">
            <div class="h-10 w-10 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 flex items-center justify-center">
              <span class="text-white text-sm font-medium">AI</span>
            </div>
            <div>
              <h2 class="text-lg font-semibold text-gray-900">Buddy</h2>
              <p class="text-sm text-gray-500">Always here to help</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Chat Area -->
      <div class="flex-1 overflow-y-auto p-4 bg-gray-50">
        <div class="flex flex-col space-y-4 max-w-3xl mx-auto">
          <div v-for="message in messages"
               :key="message.id"
               :class="[
                 'flex items-start space-x-4',
                 message.type === 'ai' ? '' : 'justify-end'
               ]">
            <template v-if="message.type === 'ai'">
              <div class="h-10 w-10 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 flex items-center justify-center">
                <span class="text-white text-sm font-medium">AI</span>
              </div>
            </template>

            <div :class="[
                   'rounded-lg p-4 shadow max-w-lg',
                   message.type === 'ai' ? 'bg-white' : 'bg-blue-500 text-white'
                 ]">
              <div class="mb-1 flex items-center justify-between">
                <span class="font-medium">{{ message.user.name }}</span>
                <span class="text-sm opacity-75">{{ message.timestamp }}</span>
              </div>
              <p>{{ message.content }}</p>

              <div v-if="message.codeSnippet"
                   class="mt-3 bg-gray-800 rounded-md p-4 text-white">
                <pre><code>{{ message.codeSnippet.code }}</code></pre>
              </div>
            </div>

            <template v-if="message.type === 'human'">
              <img :src="message.user.avatar"
                   :alt="message.user.name"
                   class="h-10 w-10 rounded-full" />
            </template>
          </div>
        </div>
      </div>

      <!-- Message Input -->
      <div class="flex-none bg-white border-t border-gray-200 p-4">
        <div class="max-w-3xl mx-auto">
          <div class="flex items-center space-x-4">
            <input v-model="newMessage"
                   type="text"
                   placeholder="Ask anything about your project..."
                   @keyup.enter="sendMessage"
                   class="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none" />
            <button @click="sendMessage"
                    class="rounded-lg bg-blue-500 px-6 py-2 text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.h-screen {
  height: 100vh;
  max-height: 100vh;
}

.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
