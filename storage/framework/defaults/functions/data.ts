import { dashboardApi } from './dashboard-api'

export interface DataStats {
  total: number
  [key: string]: number
}

export interface DashboardActivity {
  id: number
  type: string
  description: string
  subjectType: string
  subjectId: number
  causer: string
  createdAt: string
}

export interface DashboardUser {
  id: number
  name: string
  email: string
  emailVerifiedAt: string
  createdAt: string
  updatedAt: string
}

export interface DashboardTeam {
  id: number
  name: string
  description: string
  memberCount: number
  status: string
  createdAt: string
  updatedAt: string
}

export interface DashboardSubscriber {
  id: number
  email: string
  status: string
  source: string
  unsubscribedAt: string
  createdAt: string
}

export interface DashboardDataResponse<T> {
  stats: DataStats
  error?: string
  activities?: T[]
  users?: T[]
  teams?: T[]
  subscribers?: T[]
}

export type DataMode = 'activity' | 'users' | 'teams' | 'subscribers'

const endpointByMode: Record<DataMode, string> = {
  activity: '/api/data/activity',
  users: '/api/data/users',
  teams: '/api/data/teams',
  subscribers: '/api/data/subscribers',
}

export async function fetchDashboardData<T>(mode: DataMode): Promise<DashboardDataResponse<T>> {
  return dashboardApi<DashboardDataResponse<T>>(endpointByMode[mode])
}
