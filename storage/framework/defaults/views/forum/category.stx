<template>
  <ForumLayout :route="routeType">
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div class="lg:col-span-2">
        <ForumBreadcrumb :items="breadcrumbItems" />

        <div class="mb-6">
          <div class="bg-gray-100 px-4 py-3 rounded-t-md flex items-center justify-between">
            <div>
              <h1 class="text-xl font-bold">{{ categoryTitle }}</h1>
              <p class="text-sm text-gray-600 mt-1">{{ categoryDescription }}</p>
            </div>

            <div>
              <a href="/forum/new-topic" class="px-4 py-2 bg-primary text-white rounded-md hover:opacity-90">New Topic</a>
            </div>
          </div>
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
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import ForumLayout from '../../components/Forum/ForumLayout.vue'
import ForumBreadcrumb from '../../components/Forum/ForumBreadcrumb.vue'
import ForumTopicList from '../../components/Forum/ForumTopicList.vue'
import ForumTopicItem from '../../components/Forum/ForumTopicItem.vue'
import ForumPagination from '../../components/Forum/ForumPagination.vue'
import ForumSidebar from '../../components/Forum/ForumSidebar.vue'

// Get the category and subcategory from the route params
const route = useRoute()
const category = computed(() => route.params.category as string || '')
const subcategory = computed(() => route.params.subcategory as string || '')
const filter = computed(() => route.query.filter as string || '')

// Define interfaces for our data structures
interface CategoryData {
  title: string;
  description: string;
  subcategories?: Record<string, SubcategoryData>;
}

interface SubcategoryData {
  title: string;
  description: string;
}

interface Topic {
  id: number;
  title: string;
  link: string;
  authorName: string;
  authorAvatar: string;
  createdAt: string;
  viewCount: number;
  replyCount: number;
  likeCount: number;
  category: string;
  categoryLink: string;
  excerpt?: string;
  isPinned?: boolean;
  isSolved?: boolean;
  lastReplyAuthorName?: string;
  lastReplyAuthorAvatar?: string;
  lastReplyAt?: string;
}

// Determine which category we're viewing
const categoryData = computed(() => {
  const categories: Record<string, CategoryData> = {
    'announcements': {
      title: 'Announcements',
      description: 'Official announcements from the Stacks.js team',
      subcategories: {
        'welcome': {
          title: 'Welcome to the Stacks Community Forum',
          description: 'Important information about the forum rules and guidelines. Please read before posting.'
        },
        'release-notes': {
          title: 'Stacks.js v2.0 Release Notes',
          description: 'Learn about the latest features and improvements in Stacks.js v2.0'
        }
      }
    },
    'general': {
      title: 'General Discussion',
      description: 'Discuss anything related to Stacks.js and our community',
      subcategories: {
        'chat': {
          title: 'General Chat',
          description: 'A place to discuss anything related to Stacks.js and our community.'
        },
        'introductions': {
          title: 'Introductions',
          description: 'New to the forum? Introduce yourself here and meet other community members!'
        },
        'feedback': {
          title: 'Feedback & Suggestions',
          description: 'Share your ideas and suggestions for improving Stacks.js and the forum.'
        }
      }
    },
    'support': {
      title: 'Technical Support',
      description: 'Get help with Stacks.js',
      subcategories: {
        'installation': {
          title: 'Installation & Setup',
          description: 'Need help with installing or setting up Stacks.js? Ask here.'
        },
        'troubleshooting': {
          title: 'Troubleshooting',
          description: 'Having issues with your Stacks.js project? Get help from the community.'
        },
        'feature-requests': {
          title: 'Feature Requests',
          description: 'Request new features or enhancements for Stacks.js.'
        }
      }
    }
  }

  const categoryValue = category.value || ''
  return categories[categoryValue] || {
    title: 'All Discussions',
    description: 'Browse all forum topics'
  }
})

const subcategoryData = computed(() => {
  if (!category.value || !subcategory.value) return null
  return categoryData.value?.subcategories?.[subcategory.value]
})

const categoryTitle = computed(() => {
  if (subcategoryData.value) return subcategoryData.value.title
  if (filter.value) {
    const filters: Record<string, string> = {
      'popular': 'Popular Discussions',
      'recent': 'Recent Discussions',
      'solved': 'Solved Discussions'
    }
    const filterValue = filter.value
    return filterValue ? filters[filterValue as keyof typeof filters] || categoryData.value.title : categoryData.value.title
  }
  return categoryData.value.title
})

const categoryDescription = computed(() => {
  if (subcategoryData.value) return subcategoryData.value.description
  return categoryData.value.description
})

const routeType = computed(() => {
  if (filter.value) return `forum-${filter.value}`
  return 'forum-category'
})

const listTitle = computed(() => {
  if (filter.value === 'popular') return 'Popular Topics'
  if (filter.value === 'recent') return 'Recent Topics'
  if (filter.value === 'solved') return 'Solved Topics'
  return 'Topics'
})

const breadcrumbItems = computed(() => {
  const items = [{ label: 'Forum Home', link: '/forum' }]

  if (category.value) {
    items.push({
      label: categoryData.value.title,
      link: `/forum/category/${category.value}`
    })
  }

  if (subcategory.value && subcategoryData.value) {
    items.push({
      label: subcategoryData.value.title,
      link: `/forum/category/${category.value}/${subcategory.value}`
    })
  }

  if (filter.value) {
    const filters: Record<string, string> = {
      'popular': 'Popular',
      'recent': 'Recent',
      'solved': 'Solved'
    }
    const filterValue = filter.value
    if (filterValue) {
      items.push({
        label: filters[filterValue as keyof typeof filters] || '',
        link: `/forum?filter=${filterValue}`
      })
    }
  }

  return items
})

// Sample topics data based on category/filter
const topics = computed((): Topic[] => {
  if (category.value === 'announcements' && subcategory.value === 'welcome') {
    return [
      {
        id: 4,
        title: 'Forum Rules and Guidelines',
        link: '/forum/topic/4',
        authorName: 'Admin',
        authorAvatar: '/images/avatars/default.png',
        createdAt: '1 week ago',
        viewCount: 325,
        replyCount: 12,
        likeCount: 45,
        category: 'Announcements',
        categoryLink: '/forum/category/announcements',
        excerpt: 'Welcome to the Stacks Community Forum! Please take a moment to read our community guidelines...',
        isPinned: true
      },
      {
        id: 10,
        title: 'How to get help on the forum',
        link: '/forum/topic/10',
        authorName: 'Admin',
        authorAvatar: '/images/avatars/default.png',
        createdAt: '2 weeks ago',
        viewCount: 210,
        replyCount: 5,
        likeCount: 18,
        category: 'Announcements',
        categoryLink: '/forum/category/announcements',
        excerpt: 'Here are some tips for getting the most out of the forum when you need help with Stacks.js...'
      }
    ]
  } else if (category.value === 'announcements' && subcategory.value === 'release-notes') {
    return [
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
        id: 11,
        title: 'Stacks.js v1.9 Release Notes',
        link: '/forum/topic/11',
        authorName: 'StacksMaster',
        authorAvatar: '/images/avatars/default.png',
        createdAt: '2 months ago',
        viewCount: 287,
        replyCount: 14,
        likeCount: 32,
        category: 'Announcements',
        categoryLink: '/forum/category/announcements',
        excerpt: 'This release includes several bug fixes and performance improvements...'
      }
    ]
  } else if (filter.value === 'popular') {
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
  } else if (category.value === 'support' && subcategory.value === 'installation') {
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
        id: 14,
        title: 'Error when installing Stacks.js via npm',
        link: '/forum/topic/14',
        authorName: 'NewDeveloper',
        authorAvatar: '/images/avatars/default.png',
        createdAt: '1 day ago',
        viewCount: 34,
        replyCount: 5,
        likeCount: 2,
        category: 'Technical Support',
        categoryLink: '/forum/category/support/installation',
        excerpt: 'I\'m getting an error when trying to install Stacks.js via npm...'
      }
    ]
  } else {
    // Default topics for any other category or main forum page
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