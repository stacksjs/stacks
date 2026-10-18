# Published documentation consumer

This fixture checks the public dependency combination used by a documentation site, independently of the Stacks monorepo workspaces. The hosted workflow copies it outside the checkout, uses Bun 1.4.3 for an ordinary install and frozen reinstall, retains the genuine lockfile, and typechecks the published mouse composable with strict indexed access enabled.

The fixture contains public package metadata and a generic typed API example. A passing fixture does not establish that any application's private documentation build or privacy checks pass; those remain separate application gates.
