<template>
  <ForumLayout :route="currentRoute">
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div class="lg:col-span-2">
        <ForumBreadcrumb :items="breadcrumbItems" />

        <div v-if="!filter">
          <ForumCategory title="Announcements">
            <ForumCategoryItem
              title="Welcome to the Stacks Community Forum"
              description="Important information about the forum rules and guidelines. Please read before posting."
              link="/forum/category/announcements/welcome"
              :topicCount="5"
              :postCount="42"
              icon="i-hugeicons-megaphone"
              :latestTopic="{
                title: 'Forum Rules and Guidelines',
                link: '/forum/topic/4',
                timeAgo: '1 week ago',
                author: 'Admin',
                authorLink: '/forum/profile/admin'
              }"
            />
            <ForumCategoryItem
              title="Stacks.js v2.0 Release Notes"
              description="Learn about the latest features and improvements in Stacks.js v2.0"
              link="/forum/category/announcements/release-notes"
              :topicCount="12"
              :postCount="87"
              icon="i-hugeicons-newspaper"
              :latestTopic="{
                title: 'Stacks.js v2.0 Released!',
                link: '/forum/topic/6',
                timeAgo: '3 days ago',
                author: 'StacksMaster',
                authorLink: '/forum/profile/stacksmaster'
              }"
            />
          </ForumCategory>

          <ForumCategory title="General Discussion">
            <ForumCategoryItem
              title="General Chat"
              description="A place to discuss anything related to Stacks.js and our community."
              link="/forum/category/general/chat"
              :topicCount="128"
              :postCount="1243"
              :latestTopic="{
                title: 'Best practices for database migrations in Stacks.js',
                link: '/forum/topic/3',
                timeAgo: '1 day ago',
                author: 'DatabaseGuru',
                authorLink: '/forum/profile/databaseguru'
              }"
            />
            <ForumCategoryItem
              title="Introductions"
              description="New to the forum? Introduce yourself here and meet other community members!"
              link="/forum/category/general/introductions"
              :topicCount="75"
              :postCount="312"
              icon="i-hugeicons-user-plus"
              :latestTopic="{
                title: 'Introducing myself to the community!',
                link: '/forum/topic/2',
                timeAgo: '5 hours ago',
                author: 'NewUser123',
                authorLink: '/forum/profile/newuser123'
              }"
            />
            <ForumCategoryItem
              title="Feedback & Suggestions"
              description="Share your ideas and suggestions for improving Stacks.js and the forum."
              link="/forum/category/general/feedback"
              :topicCount="34"
              :postCount="156"
              icon="i-hugeicons-lightbulb"
              :latestTopic="{
                title: 'Suggestion: Add dark mode to the forum',
                link: '/forum/topic/7',
                timeAgo: '2 days ago',
                author: 'DarkModeEnthusiast',
                authorLink: '/forum/profile/darkmode'
              }"
            />
          </ForumCategory>

          <ForumCategory title="Technical Support">
            <ForumCategoryItem
              title="Installation & Setup"
              description="Need help with installing or setting up Stacks.js? Ask here."
              link="/forum/category/support/installation"
              :topicCount="87"
              :postCount="423"
              icon="i-hugeicons-wrench"
              :latestTopic="{
                title: 'How to implement authentication in a new Stacks.js project?',
                link: '/forum/topic/1',
                timeAgo: '2 hours ago',
                author: 'JohnDoe',
                authorLink: '/forum/profile/johndoe'
              }"
            />
            <ForumCategoryItem
              title="Troubleshooting"
              description="Having issues with your Stacks.js project? Get help from the community."
              link="/forum/category/support/troubleshooting"
              :topicCount="142"
              :postCount="768"
              icon="i-hugeicons-bug"
              :latestTopic="{
                title: 'TypeError when using the new API client',
                link: '/forum/topic/8',
                timeAgo: '6 hours ago',
                author: 'BugHunter',
                authorLink: '/forum/profile/bughunter'
              }"
            />
            <ForumCategoryItem
              title="Feature Requests"
              description="Request new features or enhancements for Stacks.js."
              link="/forum/category/support/feature-requests"
              :topicCount="56"
              :postCount="289"
              icon="i-hugeicons-star"
              :latestTopic="{
                title: 'Request: Add built-in support for WebSockets',
                link: '/forum/topic/9',
                timeAgo: '4 days ago',
                author: 'RealtimeDev',
                authorLink: '/forum/profile/realtimedev'
              }"
            />
          </ForumCategory>
        </div>

        <ForumTopicList :title="listTitle">
          <ForumTopicItem
            v-for="topic in topics"
            :key="topic.id"
            :title="topic.title"
            :link="topic.link"
            :authorName="topic.authorName"
            :authorAvatar="topic.authorAvatar"
            :createdAt="topic.createdAt"
            :viewCount="topic.viewCount"
            :replyCount="topic.replyCount"
            :likeCount="topic.likeCount"
            :category="topic.category"
            :categoryLink="topic.categoryLink"
            :excerpt="topic.excerpt || ''"
            :isPinned="!!topic.isPinned"
            :isSolved="!!topic.isSolved"
            :lastReplyAuthorName="topic.lastReplyAuthorName || ''"
            :lastReplyAuthorAvatar="topic.lastReplyAuthorAvatar || ''"
            :lastReplyAt="topic.lastReplyAt || ''"
          />
        </ForumTopicList>

        <ForumPagination :currentPage="1" :totalPages="5" />
      </div>

      <div class="lg:col-span-1">
        <ForumSidebar
          :stats="{
            topics: 540,
            posts: 3287,
            members: 1245,
            newestMember: 'NewUser123'
          }"
          :popularTopics="[
            {
              id: 1,
              title: 'How to implement authentication in a new Stacks.js project?',
              link: '/forum/topic/1',
              replyCount: 3,
              viewCount: 45
            },
            {
              id: 2,
              title: 'Best practices for database migrations in Stacks.js',
              link: '/forum/topic/3',
              replyCount: 15,
              viewCount: 128
            },
            {
              id: 3,
              title: 'Introducing myself to the community!',
              link: '/forum/topic/2',
              replyCount: 8,
              viewCount: 32
            }
          ]"
          :onlineUsers="[
            { id: 1, name: 'JohnDoe', avatar: '/images/avatars/default.png' },
            { id: 2, name: 'DatabaseGuru', avatar: '/images/avatars/default.png' },
            { id: 3, name: 'NewUser123', avatar: '/images/avatars/default.png' },
            { id: 4, name: 'ExpertUser', avatar: '/images/avatars/default.png' },
            { id: 5, name: 'StacksMaster', avatar: '/images/avatars/default.png' }
          ]"
        />
      </div>
    </div>
  </ForumLayout>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ForumLayout from '../../components/Forum/ForumLayout.vue'
import ForumBreadcrumb from '../../components/Forum/ForumBreadcrumb.vue'
import ForumCategory from '../../components/Forum/ForumCategory.vue'
import ForumCategoryItem from '../../components/Forum/ForumCategoryItem.vue'
import ForumTopicList from '../../components/Forum/ForumTopicList.vue'
import ForumTopicItem from '../../components/Forum/ForumTopicItem.vue'
import ForumPagination from '../../components/Forum/ForumPagination.vue'
import ForumSidebar from '../../components/Forum/ForumSidebar.vue'

// In a real app, this would come from route params
// For now, we'll simulate it
const props = defineProps<{
  filter?: string
}>()

const filter = computed(() => props.filter || '')

const currentRoute = computed(() => {
  if (filter.value === 'popular') return 'forum-popular'
  if (filter.value === 'recent') return 'forum-recent'
  if (filter.value === 'solved') return 'forum-solved'
  return 'forum'
})

const breadcrumbItems = computed(() => {
  const items = [{ label: 'Forum Home', link: '/forum' }]

  if (filter.value) {
    const filters: Record<string, string> = {
      'popular': 'Popular',
      'recent': 'Recent',
      'solved': 'Solved'
    }

    const filterValue = filter.value as keyof typeof filters
    if (filters[filterValue]) {
      items.push({
        label: filters[filterValue],
        link: `/forum?filter=${filterValue}`
      })
    }
  }

  return items
})

const listTitle = computed(() => {
  if (filter.value === 'popular') return 'Popular Topics'
  if (filter.value === 'recent') return 'Recent Topics'
  if (filter.value === 'solved') return 'Solved Topics'
  return 'Recent Discussions'
})

// Define the Topic interface to fix type errors
interface Topic {
  id: number
  title: string
  link: string
  authorName: string
  authorAvatar: string
  createdAt: string
  viewCount: number
  replyCount: number
  likeCount: number
  category: string
  categoryLink: string
  excerpt?: string
  isPinned?: boolean
  isSolved?: boolean
  lastReplyAuthorName?: string
  lastReplyAuthorAvatar?: string
  lastReplyAt?: string
}

// Sample topics data based on filter
const topics = computed((): Topic[] => {
  if (filter.value === 'popular') {
    return [
      {
        id: 3,
        title: 'Best practices for database migrations in Stacks.js',
        link: '/forum/topic/3',
        authorName: 'DatabaseGuru',
        authorAvatar: '/images/avatars/default.png',
        createdAt: '1 day ago',
        viewCount: 128,
        replyCount: 15,
        likeCount: 24,
        category: 'General Discussion',
        categoryLink: '/forum/category/general/chat',
        isSolved: true,
        lastReplyAuthorName: 'ExpertUser',
        lastReplyAuthorAvatar: '/images/avatars/default.png',
        lastReplyAt: '3 hours ago'
      },
      {
        id: 6,
        title: 'Stacks.js v2.0 Released!',
        link: '/forum/topic/6',
        authorName: 'StacksMaster',
        authorAvatar: '/images/avatars/default.png',
        createdAt: '3 days ago',
        viewCount: 412,
        replyCount: 28,
        likeCount: 76,
        category: 'Announcements',
        categoryLink: '/forum/category/announcements',
        excerpt: 'We\'re excited to announce the release of Stacks.js v2.0 with major performance improvements and new features...',
        isPinned: true
      },
      {
        id: 5,
        title: 'Vue 3 composition API vs options API in Stacks.js components',
        link: '/forum/topic/5',
        authorName: 'JohnDoe',
        authorAvatar: '/images/avatars/default.png',
        createdAt: '3 days ago',
        viewCount: 256,
        replyCount: 32,
        likeCount: 48,
        category: 'General Discussion',
        categoryLink: '/forum/category/general/chat'
      }
    ]
  } else if (filter.value === 'recent') {
    return [
      {
        id: 1,
        title: 'How to implement authentication in a new Stacks.js project?',
        link: '/forum/topic/1',
        authorName: 'JohnDoe',
        authorAvatar: '/images/avatars/default.png',
        createdAt: '2 hours ago',
        viewCount: 45,
        replyCount: 3,
        likeCount: 7,
        category: 'Technical Support',
        categoryLink: '/forum/category/support/installation',
        excerpt: 'I\'m trying to implement authentication in my new project but I\'m having some issues with the middleware...'
      },
      {
        id: 2,
        title: 'Introducing myself to the community!',
        link: '/forum/topic/2',
        authorName: 'NewUser123',
        authorAvatar: '/images/avatars/default.png',
        createdAt: '5 hours ago',
        viewCount: 32,
        replyCount: 8,
        likeCount: 12,
        category: 'Introductions',
        categoryLink: '/forum/category/general/introductions',
        isPinned: true
      },
      {
        id: 8,
        title: 'TypeError when using the new API client',
        link: '/forum/topic/8',
        authorName: 'BugHunter',
        authorAvatar: '/images/avatars/default.png',
        createdAt: '6 hours ago',
        viewCount: 67,
        replyCount: 4,
        likeCount: 3,
        category: 'Troubleshooting',
        categoryLink: '/forum/category/support/troubleshooting'
      }
    ]
  } else if (filter.value === 'solved') {
    return [
      {
        id: 3,
        title: 'Best practices for database migrations in Stacks.js',
        link: '/forum/topic/3',
        authorName: 'DatabaseGuru',
        authorAvatar: '/images/avatars/default.png',
        createdAt: '1 day ago',
        viewCount: 128,
        replyCount: 15,
        likeCount: 24,
        category: 'General Discussion',
        categoryLink: '/forum/category/general/chat',
        isSolved: true,
        lastReplyAuthorName: 'ExpertUser',
        lastReplyAuthorAvatar: '/images/avatars/default.png',
        lastReplyAt: '3 hours ago'
      },
      {
        id: 12,
        title: 'How to fix CORS issues with Stacks.js API',
        link: '/forum/topic/12',
        authorName: 'WebDev',
        authorAvatar: '/images/avatars/default.png',
        createdAt: '1 week ago',
        viewCount: 98,
        replyCount: 7,
        likeCount: 15,
        category: 'Troubleshooting',
        categoryLink: '/forum/category/support/troubleshooting',
        isSolved: true
      },
      {
        id: 13,
        title: 'Best way to structure a large Stacks.js project',
        link: '/forum/topic/13',
        authorName: 'ArchitectDev',
        authorAvatar: '/images/avatars/default.png',
        createdAt: '2 weeks ago',
        viewCount: 156,
        replyCount: 12,
        likeCount: 28,
        category: 'General Discussion',
        categoryLink: '/forum/category/general/chat',
        isSolved: true
      }
    ]
  } else {
    // Default topics for main forum page
    return [
      {
        id: 1,
        title: 'How to implement authentication in a new Stacks.js project?',
        link: '/forum/topic/1',
        authorName: 'JohnDoe',
        authorAvatar: '/images/avatars/default.png',
        createdAt: '2 hours ago',
        viewCount: 45,
        replyCount: 3,
        likeCount: 7,
        category: 'Technical Support',
        categoryLink: '/forum/category/support/installation',
        excerpt: 'I\'m trying to implement authentication in my new project but I\'m having some issues with the middleware...'
      },
      {
        id: 2,
        title: 'Introducing myself to the community!',
        link: '/forum/topic/2',
        authorName: 'NewUser123',
        authorAvatar: '/images/avatars/default.png',
        createdAt: '5 hours ago',
        viewCount: 32,
        replyCount: 8,
        likeCount: 12,
        category: 'Introductions',
        categoryLink: '/forum/category/general/introductions',
        isPinned: true
      },
      {
        id: 3,
        title: 'Best practices for database migrations in Stacks.js',
        link: '/forum/topic/3',
        authorName: 'DatabaseGuru',
        authorAvatar: '/images/avatars/default.png',
        createdAt: '1 day ago',
        viewCount: 128,
        replyCount: 15,
        likeCount: 24,
        category: 'General Discussion',
        categoryLink: '/forum/category/general/chat',
        isSolved: true,
        lastReplyAuthorName: 'ExpertUser',
        lastReplyAuthorAvatar: '/images/avatars/default.png',
        lastReplyAt: '3 hours ago'
      }
    ]
  }
})
</script>
