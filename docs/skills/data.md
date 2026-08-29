---
title: "Data layer skills"
description: "Models, the ORM, queries, migrations, seeding and search."
---
# Data layer

Models, the ORM, queries, migrations, seeding and search.

Stacks derives migrations from your models rather than the other way round, so
the model is the source of truth for the schema. These cover that loop end to
end, plus the query surface and the search indexing that hangs off it.

7 skills.

| Skill | What it is for |
|---|---|
| [Database](/skills/data/database) | Connections, raw queries, SQL helpers and the four supported engines: SQLite, MySQL, PostgreSQL and DynamoDB. |
| [Faker](/skills/data/faker) | Fake data generation for seeders and tests, wrapping `ts-mocker`. |
| [Migrations](/skills/data/migrations) | Migrations here are derived from your models rather than hand-written. |
| [Models](/skills/data/models) | The `defineModel()` surface in full: attributes with validation and factories, relationships, the behaviour traits, computed properties, and the 50+ models the framework ships. |
| [ORM](/skills/data/orm) | The ORM itself: how `defineModel()` becomes a queryable model, how relationships resolve, what the traits attach, which system fields appear on their own, and the naming conventions the rest of the framework infers from. |
| [Query builder](/skills/data/query-builder) | The fluent query surface, backed by `bun-query-builder`. Chainable conditions, ordering, eager loading, pagination and transactions, plus the configuration in `config/query-builder.ts`. |
| [Search engine](/skills/data/search-engine) | Full-text search over Meilisearch or Algolia, and the `useSearch` trait that keeps a model indexed without a line of glue code. |

Every page here describes one `SKILL.md` under
[`storage/framework/defaults/ai/skills`](https://github.com/stacksjs/stacks/tree/main/storage/framework/defaults/ai/skills).
See [Using skills](/skills/using) to wire them into your agent.
