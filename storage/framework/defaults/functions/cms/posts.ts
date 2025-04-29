import type { Posts } from '../types'
import { useFetch, useStorage } from '@vueuse/core'

// Create a persistent posts array using VueUse's useStorage
const posts = useStorage<Posts[]>('posts', [])

const baseURL = 'http://localhost:3008/api'

// Basic fetch function to get all posts
async function fetchPosts() {
  const { error, data } = useFetch<Posts[]>(`${baseURL}/cms/posts`)

  if (error.value) {
    console.error('Error fetching posts:', error.value)
    return []
  }

  // Ensure data is an array before assigning
  if (Array.isArray(data.value)) {
    posts.value = data.value
    return data.value
  }
  else {
    console.error('Expected array of posts but received:', typeof data.value)
    return []
  }
}

async function createPost(post: Posts) {
  const { error, data } = useFetch<Posts>(`${baseURL}/cms/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...post,
      author_name: post.author_name,
      author_email: post.author_email,
    }),
  })

  if (error.value) {
    console.error('Error creating post:', error.value)
    return null
  }

  if (data.value) {
    posts.value.push(data.value)
    return data.value
  }
  return null
}

async function updatePost(post: Posts) {
  const { error, data } = useFetch<Posts>(`${baseURL}/cms/posts/${post.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...post,
      author_name: post.author_name,
      author_email: post.author_email,
    }),
  })

  if (error.value) {
    console.error('Error updating post:', error.value)
    return null
  }

  if (data.value) {
    const index = posts.value.findIndex(p => p.id === post.id)
    if (index !== -1) {
      posts.value[index] = data.value
    }
    return data.value
  }
  return null
}

async function deletePost(id: number) {
  const { error } = useFetch(`${baseURL}/cms/posts/${id}`, {
    method: 'DELETE',
  })

  if (error.value) {
    console.error('Error deleting post:', error.value)
    return false
  }

  const index = posts.value.findIndex(p => p.id === id)
  if (index !== -1) {
    posts.value.splice(index, 1)
  }

  return true
}

// Export the composable
export function usePosts() {
  return {
    posts,
    fetchPosts,
    createPost,
    updatePost,
    deletePost,
  }
}
