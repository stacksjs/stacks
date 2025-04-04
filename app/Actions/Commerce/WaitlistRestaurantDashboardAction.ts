import { Action } from '@stacksjs/actions'
import { waitlists } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'WaitlistRestaurant Dashboard',
  description: 'Get restaurant dashboard statistics',
  method: 'GET',
  async handle() {
    const [
      currentWaitTimes,
      seatedCounts,
      noShowCounts,
      timeSeriesData,
    ] = await Promise.all([
      // Current wait times (for waiting customers)
      waitlists.restaurant.fetchAll({
        where: {
          status: 'waiting',
        },
        select: ['quoted_wait_time', 'actual_wait_time'],
      }),

      // Seated counts in last 24 hours
      waitlists.restaurant.fetchAll({
        where: {
          status: 'seated',
          seated_at: {
            gte: Date.now() - 24 * 60 * 60 * 1000, // Last 24 hours
          },
        },
        select: ['seated_at'],
      }),

      // No-show counts in last 24 hours
      waitlists.restaurant.fetchAll({
        where: {
          status: 'no_show',
          no_show_at: {
            gte: Date.now() - 24 * 60 * 60 * 1000, // Last 24 hours
          },
        },
        select: ['no_show_at'],
      }),

      // Time series data for all statuses
      waitlists.restaurant.fetchAll({
        select: ['created_at', 'status'],
      }),
    ])

    // Process current wait times
    const waitTimeStats = {
      averageQuoted: currentWaitTimes.reduce((acc, curr) => acc + curr.quoted_wait_time, 0) / currentWaitTimes.length || 0,
      averageActual: currentWaitTimes.reduce((acc, curr) => acc + (curr.actual_wait_time || 0), 0) / currentWaitTimes.length || 0,
    }

    // Process seated counts
    const seatedStats = {
      total: seatedCounts.length,
      byHour: Array(24).fill(0).map((_, hour) => ({
        hour,
        count: seatedCounts.filter(entry => {
          const entryHour = new Date(entry.seated_at).getHours()
          return entryHour === hour
        }).length,
      })),
    }

    // Process no-show counts
    const noShowStats = {
      total: noShowCounts.length,
      byHour: Array(24).fill(0).map((_, hour) => ({
        hour,
        count: noShowCounts.filter(entry => {
          const entryHour = new Date(entry.no_show_at).getHours()
          return entryHour === hour
        }).length,
      })),
    }

    // Process time series data
    const timeSeriesStats = timeSeriesData.reduce((acc, curr) => {
      const date = new Date(curr.created_at).toISOString().split('T')[0]
      if (!acc[date]) {
        acc[date] = {
          total: 0,
          waiting: 0,
          seated: 0,
          cancelled: 0,
          no_show: 0,
        }
      }
      acc[date].total++
      acc[date][curr.status]++
      return acc
    }, {})

    return response.json({
      waitTimeStats,
      seatedStats,
      noShowStats,
      timeSeriesStats,
    })
  },
}) 