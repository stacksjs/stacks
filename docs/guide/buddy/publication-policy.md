# Application publication policy

A project can declare a mandatory local policy in its package manifest:

```json
{
  "scripts": {
    "publication:check": "bun scripts/check-publication.ts"
  }
}
```

Buddy executes that script before a real release, deployment, preview deployment,
iOS release, or GitHub release creation. The direct release and deployment
actions enforce it too. A declared policy must be a nonempty script and exit
successfully. There is no ignore flag. An absent policy preserves the existing
behavior of projects that have not configured one.

The policy receives `STACKS_PUBLICATION_CHANNEL`:

| Channel | Entry |
| --- | --- |
| `web` | Application deployment, including AWS, SSH, Hetzner and Fly |
| `preview` | Preview deployment |
| `ios` | iOS release |
| `github-release` | Package/application release and GitHub release creation |

`desktop` and `android` are also supported by the public
`@stacksjs/actions/publication-preflight` function for native publication
orchestrators. A platform builder is not automatically a publication step.
Call `assertPublicationAllowed({ cwd, channel })` immediately before publishing
through a custom maintained entrypoint, and retain platform-specific acceptance.

The script runs with the consumer's installed Bun, honoring its declared engine
range. Failure, cancellation, timeout and cleanup failure block publication.
Its output is hashed by the shared project-script runner. Run
`bun run publication:check` with the explicit channel to inspect the policy's
own report when diagnosing a refusal. No production secrets are copied into a
verification receipt.

Dry-run previews do not execute application scripts. Preview removal and
rollback remain recovery operations. Local builds and tests can verify private
content without qualifying it for publication. CI and native store workflows
should execute the same policy with their actual channel before uploads or
publication; a package script cannot intercept a remote service independently.

For example, an application may require complete media provenance and valid
redistribution evidence for every bundled file and destination. A passing build
does not establish those rights. The application owns that decision and its
evidence; Stacks enforces the declared gate before proceeding.

The AWS action also runs a present `cloud/deploy-script` `beforeDeploy` hook
before its build and infrastructure work. Named and default-object exports are
supported. A missing file is optional. A failed hook or one with a missing
dependency aborts the action. Use `publication:check` for a policy that must
apply consistently across all publication providers and commands.
