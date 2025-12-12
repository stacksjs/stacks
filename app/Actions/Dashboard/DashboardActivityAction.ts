import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { Deployment, Error as ErrorModel, Order, Post } from '@stacksjs/orm'

export default new Action({
  name: 'Dashboard Activity',
  description: 'Fetch recent activity for dashboard',
  method: 'GET',

  async handle() {
    // Fetch recent items from various sources
    const [recentDeployments, recentOrders, recentPosts, recentErrors] = await Promise.all([
      Deployment.orderBy('created_at', 'desc').limit(3).get(),
      Order.orderBy('created_at', 'desc').limit(3).get(),
      Post.orderBy('created_at', 'desc').limit(3).get(),
      ErrorModel.orderBy('created_at', 'desc').limit(2).get(),
    ])

    // Format time ago helper
    const timeAgo = (date: Date | string) => {
      const now = new Date()
      const then = new Date(date)
      const seconds = Math.floor((now.getTime() - then.getTime()) / 1000)

      if (seconds < 60) return 'Just now'
      if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`
      if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`
      if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`
      return then.toLocaleDateString()
    }

    // Build activity items
    const activity: Array<{
      id: number
      type: string
      title: string
      time: string
      status: 'success' | 'error' | 'warning'
    }> = []

    let idCounter = 1

    // Add deployments
    for (const deployment of recentDeployments) {
      activity.push({
        id: idCounter++,
        type: 'deployment',
        title: `Deployment ${deployment.status === 'success' ? 'completed' : deployment.status}`,
        time: timeAgo(deployment.created_at),
        status: deployment.status === 'success' ? 'success' : deployment.status === 'failed' ? 'error' : 'warning',
      })
    }

    // Add orders
    for (const order of recentOrders) {
      activity.push({
        id: idCounter++,
        type: 'commerce',
        title: `New order #${order.id} received`,
        time: timeAgo(order.created_at),
        status: 'success',
      })
    }

    // Add posts
    for (const post of recentPosts) {
      activity.push({
        id: idCounter++,
        type: 'blog',
        title: `Blog post "${post.title}" published`,
        time: timeAgo(post.created_at),
        status: 'success',
      })
    }

    // Add errors
    for (const error of recentErrors) {
      activity.push({
        id: idCounter++,
        type: 'error',
        title: `Error: ${error.message?.substring(0, 50) || 'Unknown error'}`,
        time: timeAgo(error.created_at),
        status: 'error',
      })
    }

    // Sort by most recent and limit
    activity.sort((a, b) => {
      // Simple sort - items with "Just now" or "minutes ago" come first
      if (a.time.includes('Just now')) return -1
      if (b.time.includes('Just now')) return 1
      if (a.time.includes('minutes')) return -1
      if (b.time.includes('minutes')) return 1
      return 0
    })

    return response.json({ activity: activity.slice(0, 8) })
  },
})
