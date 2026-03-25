import { Action } from '@stacksjs/actions'
import { EmailList } from '@stacksjs/orm'

export default new Action({
  name: 'ListIndexAction',
  description: 'Returns mailing list data for the dashboard.',
  method: 'GET',
  async handle() {
    try {
      const allLists = await EmailList.all()

      const lists = allLists.map(l => ({
        name: String(l.get('name') || ''),
        members: Number(l.get('member_count') || l.get('subscribers_count') || 0),
        growth: String(l.get('growth') || '+0'),
        status: String(l.get('status') || 'active'),
        lastSent: String(l.get('last_sent_at') || '-'),
      }))

      const totalSubscribers = lists.reduce((s, l) => s + l.members, 0)

      const stats = [
        { label: 'Total Subscribers', value: String(totalSubscribers) },
        { label: 'New This Week', value: '-' },
        { label: 'Unsubscribed', value: '-' },
        { label: 'Avg Open Rate', value: '-' },
      ]

      return { lists, stats }
    }
    catch {
      return {
        lists: [],
        stats: [
          { label: 'Total Subscribers', value: '0' },
          { label: 'New This Week', value: '0' },
          { label: 'Unsubscribed', value: '0' },
          { label: 'Avg Open Rate', value: '-' },
        ],
      }
    }
  },
})
