// run all the upgrade actions

  if (options?.framework || options?.all)
    await updateFramework(options)

  if (options?.dependencies || options?.all)
    await updateDependencies(options)

  if (options?.packageManager || options?.all)
    await updatePackageManager(options)

  if (options?.node || options?.all)
    await updateNode(options)

  else
    process.exit(ExitCode.InvalidArgument)

  // TODO: also update CI files & configurations, and other files, possibly
  // we want this to be smart enough to update only if files that have been updated
  // TODO: this script should trigger regeneration of auto-imports.d.ts & components.d.ts
