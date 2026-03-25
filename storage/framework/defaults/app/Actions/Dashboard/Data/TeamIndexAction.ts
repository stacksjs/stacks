import { Action } from '@stacksjs/actions'
import { Team } from '@stacksjs/orm'

export default new Action({
  name: 'TeamIndexAction',
  description: 'Returns team data for the dashboard.',
  method: 'GET',
  async handle() {
    try {
      const allTeams = await Team.all()
      const totalTeams = await Team.count()

      const teams = allTeams.map(t => ({
        name: String(t.get('name') || 'Team'),
        members: Number(t.get('members_count') || 0),
        projects: Number(t.get('projects_count') || 0),
        status: 'active',
        lead: String(t.get('lead') || 'Team Lead'),
      }))

      const totalMembers = teams.reduce((sum, t) => sum + t.members, 0)
      const totalProjects = teams.reduce((sum, t) => sum + t.projects, 0)

      const stats = [
        { label: 'Total Teams', value: String(totalTeams) },
        { label: 'Total Members', value: String(totalMembers) },
        { label: 'Active Projects', value: String(totalProjects) },
      ]

      return { teams, stats }
    }
    catch {
      return {
        teams: [],
        stats: [
          { label: 'Total Teams', value: '0' },
          { label: 'Total Members', value: '0' },
          { label: 'Active Projects', value: '0' },
        ],
      }
    }
  },
})
