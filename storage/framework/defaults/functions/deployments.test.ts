import { describe, expect, it } from 'bun:test'
import {
  fetchDeployScript,
  fetchDeploymentTerminal,
  normalizeDeployment,
  normalizeDeploymentDetail,
  normalizeDeploymentList,
  summarizeDeployments,
  updateDeployScript,
} from './deployments'

describe('deployment dashboard data', () => {
  it('normalizes model API records in snake case', () => {
    expect(normalizeDeployment({
      id: 7,
      commit_hash: 'abc1234',
      commit_message: 'feat: ship dashboard',
      branch: 'main',
      status: 'SUCCESS',
      environment: 'production',
      duration: 45,
      author: 'Chris',
      created_at: '2026-07-29 12:00:00',
    })).toEqual({
      id: '7',
      commitHash: 'abc1234',
      commitMessage: 'feat: ship dashboard',
      branch: 'main',
      status: 'success',
      environment: 'production',
      duration: 45,
      author: 'Chris',
      url: '',
      errorLog: '',
      createdAt: '2026-07-29 12:00:00',
      updatedAt: '',
    })
  })

  it('reads the generated model API pagination shape', () => {
    const records = normalizeDeploymentList({
      data: [
        { id: 1, commitHash: 'abc1234', status: 'running' },
        { id: 2, commitHash: 'def5678', status: 'failed' },
      ],
    })

    expect(records.map(record => record.id)).toEqual(['1', '2'])
  })

  it('reads the dashboard detail shape without inventing a record', () => {
    expect(normalizeDeploymentDetail({
      deployment: { id: 4, commit_hash: 'abc1234', status: 'success' },
    })?.id).toBe('4')
    expect(normalizeDeploymentDetail({ deployment: null })).toBeNull()
  })

  it('summarizes only recorded deployment data', () => {
    const records = normalizeDeploymentList({
      data: [
        { id: 1, status: 'success', duration: 30 },
        { id: 2, status: 'failed', duration: 90 },
        { id: 3, status: 'running' },
      ],
    })

    expect(summarizeDeployments(records)).toEqual({
      total: 3,
      successful: 1,
      failed: 1,
      active: 1,
      averageDuration: 60,
    })
  })

  it('exports the deployment operations used by the dashboard components', () => {
    expect(typeof fetchDeployScript).toBe('function')
    expect(typeof updateDeployScript).toBe('function')
    expect(typeof fetchDeploymentTerminal).toBe('function')
  })
})
