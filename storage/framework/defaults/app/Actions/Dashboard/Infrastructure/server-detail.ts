import type {
  DashboardCloudEnvironment,
  DashboardCloudSnapshot,
  DashboardServerDefinition,
  DashboardServerDeployment,
} from '../Cloud/cloud-overview'

export interface DashboardServerDetail {
  kind: 'configuration' | 'deployment'
  server: DashboardServerDefinition | null
  deployment: DashboardServerDeployment | null
  environment: DashboardCloudEnvironment | null
}

function decodeIdentifier(value: string): string | null {
  const identifier = value.trim()
  if (!identifier)
    return null

  try {
    return decodeURIComponent(identifier)
  }
  catch {
    return null
  }
}

export function resolveDashboardServer(
  snapshot: DashboardCloudSnapshot,
  rawIdentifier: string,
): DashboardServerDetail | null {
  const identifier = decodeIdentifier(rawIdentifier)
  if (!identifier)
    return null

  const server = snapshot.serverDefinitions.find(definition =>
    definition.id === identifier
    || definition.key === identifier,
  )
  if (server) {
    return {
      kind: 'configuration',
      server,
      deployment: null,
      environment: null,
    }
  }

  const deployment = snapshot.deployments.find(item =>
    item.id === identifier
    || item.stackName === identifier,
  )
  if (!deployment)
    return null

  return {
    kind: 'deployment',
    server: null,
    deployment,
    environment: deployment.environment
      ? snapshot.environments.find(environment => environment.name === deployment.environment) ?? null
      : null,
  }
}
