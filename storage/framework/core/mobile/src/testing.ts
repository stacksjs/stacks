import type { IosMobileConfig } from '@stacksjs/types/mobile'
import { resolve } from 'node:path'
import { initSimulatorDriver } from 'craft-native/ios'

export { createNativeMutationValidator, restoreShell as restoreIosShell, serializeSimulatorSteps } from 'craft-native/ios'
export type { NativeMutationValidator, NativeValidationResult, SimulatorStep } from 'craft-native/ios'
export { createScheduledWorkoutsFake, SCHEDULED_WORKOUT_ACTIVITIES } from './scheduled-workouts-fake'
export type { ScheduledWorkoutsFake, ScheduledWorkoutsFakeOptions } from './scheduled-workouts-fake'

/** Bun-only build/test entrypoint. The browser runtime never imports the iOS builder. */
export function prepareIosSimulatorDriver(config: IosMobileConfig, root: string = process.cwd()): { output: string, projectName: string } {
  const simulator = config.simulator ?? {}
  const output = resolve(root, simulator.output ?? 'storage/framework/mobile/ios-driver')
  const projectName = simulator.projectName ?? 'CraftDriver'
  initSimulatorDriver({
    ...simulator,
    output,
    projectName,
    bundleId: config.bundleId,
    tabs: config.tabs?.map(tab => tab.title),
  })
  return { output, projectName }
}
