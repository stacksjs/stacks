import { Action } from '@stacksjs/actions'
import { Log } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Log Stats',
  description: 'Log Stats ORM Action',
  method: 'GET',
  async handle() {
    // Get current timestamp and 24 hours ago timestamp
    const now = Date.now()
    const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000)

    // Fetch logs within the last 24 hours
    const logs = await Log.where('timestamp', '>=', twentyFourHoursAgo)
      .orderBy('timestamp', 'asc')
      .get()

    // Group logs by hour and count them
    const hourlyStats = logs.reduce((acc: { [key: string]: number }, log) => {
      const date = new Date(log.timestamp)
      const hour = date.getHours()
      const day = date.getDate()
      const month = date.getMonth() + 1
      const year = date.getFullYear()
      const key = `${year}-${month}-${day} ${hour}:00`

      if (!acc[key]) {
        acc[key] = 0
      }
      acc[key]++

      return acc
    }, {})

    // Format data for line graph
    const data = Object.entries(hourlyStats).map(([time, count]) => ({
      time,
      count,
    }))

    return response.json({
      data,
      timeRange: {
        start: twentyFourHoursAgo,
        end: now,
      },
    })
  },
})
