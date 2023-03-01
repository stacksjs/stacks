// easily monitor and manage your cron jobs
export default [
  {
    function: '/demo', // ./functions/demo.ts
    schedule: '*/5 * * * *', // at every 5th minute
    name: 'Demo Cron Job', // optional
    description: 'A demo cron job that runs at every 5th minute', // optional
    timezone: 'America/New_York', // optional, defaults to APP_TIMEZONE
    active: true, // optional, defaults to true
  },
]
