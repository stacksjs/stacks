---
title: Scaling the Database
description: "Connection pooling, read replicas, and sharding with Vitess. What each stage buys you, what it costs, and how to configure it in Stacks."
---
# Scaling the Database

Most applications never outgrow a single database server, and the ones that do rarely need every tool at once. This page covers the three stages in the order you should reach for them, because each is meaningfully more expensive to operate than the last:

1. **Connection pooling** - stop paying for connection setup on every request. Almost always worth turning on.
2. **Read replicas** - take read load off the primary. Buys a lot of headroom, at the cost of reads that can be slightly stale.
3. **Sharding with Vitess** - split one logical database across many servers. Only when one primary genuinely cannot hold the write volume or the data.

If you are not sure which you need, you almost certainly want the first one and not yet the third.

## Connection Pooling

Opening a database connection is expensive: a TCP handshake, a TLS handshake, and an authentication round trip before a single query runs. A pool keeps connections open and hands them out, so that cost is paid once instead of per request.

Configure it per connection in `config/database.ts`:

```typescript
// config/database.ts
export default {
  default: env.DB_CONNECTION || 'mysql',

  connections: {
    mysql: {
      name: env.DB_DATABASE || 'stacks',
      host: env.DB_HOST || '127.0.0.1',
      port: env.DB_PORT || 3306,
      username: env.DB_USERNAME || 'root',
      password: env.DB_PASSWORD || '',

      pool: {
        max: 10,
        idleTimeoutMs: 30_000,
        acquireTimeoutMs: 10_000,
      },
    },
  },
}
```

| Option | Meaning |
| --- | --- |
| `max` | Maximum simultaneous connections. |
| `min` | Minimum idle connections kept warm. |
| `idleTimeoutMs` | Close a connection after it has been idle this long. |
| `acquireTimeoutMs` | Give up waiting for a free connection after this long. |
| `maxLifetimeMs` | Recycle a connection at this age regardless of health. |
| `autoReconnect` | Reconnect automatically after the server drops a connection. |

Every knob is optional. Omitting the whole `pool` block leaves the driver on its own defaults, which is the right answer for an app that has never had to think about this.

Or set them from the environment:

```env
DB_POOL_MAX=10
DB_POOL_IDLE_TIMEOUT_MS=30000
DB_POOL_ACQUIRE_TIMEOUT_MS=10000
```

### Sizing the pool

The common mistake is setting `max` too high. Each connection consumes memory and a worker on the database server, and a pool larger than the server can serve just moves the queue from your app to the database, where it is harder to see. Start around 10 per application process and raise it only when you can show connection acquisition is the bottleneck.

Remember to multiply: eight app processes with `max: 25` is 200 connections, which is already past the default `max_connections` on many MySQL installs.

::: tip SQLite ignores this
SQLite is embedded and single-connection, so a `pool` block on the sqlite connection is ignored. It is not an error, but it does nothing.
:::

## Read Replicas

A read replica is a copy of your database that receives a stream of changes from the primary. Sending reads there frees the primary to do writes, which is usually the first real scaling win after pooling.

Declare replicas on the connection they replicate. Each entry inherits the port, credentials, and database name from the primary, so normally only `host` is needed:

```typescript
// config/database.ts
connections: {
  mysql: {
    name: 'stacks',
    host: 'primary.internal',
    username: 'app',
    password: env.DB_PASSWORD,

    replicas: [
      { host: 'replica-a.internal' },
      { host: 'replica-b.internal' },
    ],
  },
},

reads: {
  autoRoute: false,
  strategy: 'round-robin',
},
```

Or from the environment:

```env
DB_READ_HOSTS=replica-a.internal,replica-b.internal
```

Inheriting credentials is deliberate. Repeating a username and password on every replica entry is how host lists drift out of sync with a rotated password.

### The hazard: replication is asynchronous

A row committed to the primary is not instantly on a replica. The lag is usually milliseconds, occasionally seconds under load. So this is a bug:

```typescript
await User.create({ email })
const user = await User.where('email', email).first() // may be null
```

It fails intermittently, depends on load, and disappears when you attach a debugger. That is why Stacks does **not** route reads to replicas by default.

### Explicit routing with `db.read`

The safe default is to opt in per query. Use `db.read` for the specific reads that genuinely tolerate stale data - dashboards, reports, analytics, search backfills:

```typescript
import { db } from '@stacksjs/database'

// Goes to a replica when one is configured.
const stats = await db.read
  .selectFrom('orders')
  .select(['status'])
  .count()

// Goes to the primary, always.
const order = await db.selectFrom('orders').where('id', id).first()
```

With no replicas configured, `db.read` transparently falls back to the primary, so adding it to your code is safe before you have provisioned anything.

### Automatic routing

If your application as a whole tolerates stale reads, you can route every read without asking:

```typescript
reads: {
  autoRoute: true,
},
```

```env
DB_READ_AUTO_ROUTE=true
```

Turning this on is a statement about your application, not a performance tweak. Two rules still protect you:

- **Reads inside a transaction stay on the primary.** A transaction must see its own uncommitted writes, and all of its statements must reach one connection.
- **Reads after a write in the same request stay on the primary.** Once a request has written anything, its later reads go to the primary, which covers the common read-your-writes case.

That second rule is scoped to a single request, so one request writing does not force every other request onto the primary. It is established at the request boundary; background jobs and one-shot scripts have no such boundary and should use `db.read` explicitly if they want a replica.

What is *not* covered: a read in a different request from the write. If user A saves a profile and user B loads it a few milliseconds later, B can see the old version. Decide whether that is acceptable before enabling this.

### Distribution strategies

| Strategy | Behavior |
| --- | --- |
| `round-robin` (default) | Even distribution across replicas. |
| `weighted` | Distribute by each replica's `weight`, for pools of mixed instance sizes. |
| `random` | Stateless choice. Useful across many app processes, where per-process round-robin can still land unevenly. |

```typescript
replicas: [
  { host: 'replica-small.internal', weight: 1 },
  { host: 'replica-large.internal', weight: 4 },
],

reads: { autoRoute: true, strategy: 'weighted' },
```

::: warning Replication health is not monitored here
A replica that has fallen far behind still receives traffic. Stacks does not probe replication lag on the read path, because a health check there costs more than it saves. Monitor lag at the infrastructure layer.
:::

## Sharding with Vitess

[Vitess](https://vitess.io/) presents MySQL through `vtgate`, which speaks the MySQL wire protocol and routes each query to the right tablet or shard.

An unsharded keyspace is a practical starting point: it retains ordinary MySQL foreign keys, `AUTO_INCREMENT`, and single-shard transactions while putting the routing and operational layer in place. Split the keyspace only when one primary genuinely cannot hold the write volume or data.

### Configuration

```typescript
// config/database.ts
export default {
  default: 'vitess',

  connections: {
    vitess: {
      name: env.DB_DATABASE || 'stacks', // this is a KEYSPACE
      host: env.DB_HOST || '127.0.0.1',  // vtgate, not a MySQL server
      port: env.DB_PORT || 15306,        // vtgate's port, not 3306
      username: env.DB_USERNAME || 'root',
      password: env.DB_PASSWORD || '',
      sharded: env.DB_VITESS_SHARDED ?? false,
    },
  },
}
```

```env
DB_CONNECTION=vitess
DB_HOST=vtgate.internal
DB_PORT=15306
DB_DATABASE=commerce
DB_VITESS_SHARDED=false
```

Two details differ from a plain MySQL connection and both matter:

- **`name` is a keyspace**, not a database. It is the unit Vitess shards and what the VSchema is written against.
- **The port is 15306**, vtgate's MySQL-protocol port. Connecting to 3306 on a Vitess cluster reaches an individual tablet's underlying MySQL and silently bypasses sharding altogether. That is worse than a connection error, because everything appears to work.

Set `DB_VITESS_SHARDED=true` only after the keyspace is split. Stacks then enables the stricter DDL audit and bun-query-builder generation profile described below.

### What a sharded keyspace cannot do

A keyspace is split across shards that share nothing, and three consequences follow:

**No foreign keys.** Enforcing one would need a cross-shard read on every write. Referential integrity moves into your application. `buddy doctor` reports orphan rows.

**No `AUTO_INCREMENT`.** Every shard would independently hand out the same values and collide. This is not a syntax error, which makes it more dangerous than one: the DDL succeeds and the collisions appear later, under load, as duplicate-key failures on inserts that used to be fine. Use `useUuid: true` on your models, or back a table with a sequence in an unsharded keyspace.

**No cross-shard ACID.** A transaction touching two shards is best-effort or two-phase, not the single-node guarantee the rest of the framework assumes.

Stacks checks for the first two before running any migration:

```bash
./buddy migrate
```

```
❌ Error: The migration files in database/migrations use SQL features that vitess does not implement.

Nothing was migrated, so the database is unchanged.

89 use(s) of REFERENCES across 17 file(s), for example:
  0000000122-create-campaign_sends-table.sql:3  "campaign_id" INTEGER not null REFERENCES "campaigns"("id"),

Distributed engines cannot enforce a foreign key across shards, so referential
integrity has to move into the application. Regenerate the corpus for this
dialect - the generator emits the backing index without the constraint - and
rely on the model relationships plus `buddy doctor` (which reports orphan rows)
instead of database-level cascades.
```

This runs before the first statement, so a corpus that cannot work never half-applies. If you know your corpus is fine, `STACKS_ALLOW_DDL_CONSTRAINT_VIOLATIONS=1` proceeds anyway.

### Generating a VSchema

Vitess needs a VSchema: a document that says, for every table, which column decides the shard and how that column maps to one. Without it vtgate cannot route a query.

```bash
./buddy generate:vschema           # writes database/vschema.json
./buddy generate:vschema --dry-run # print it instead
```

Stacks derives it from your models, because the interesting part is a fact your models already state.

Sharding each table by its own `id` looks obviously correct and is quietly the worst option: `users` lands on the shard for `users.id`, `posts` on the shard for `posts.id`, and a join between them has to fan out to every shard and merge. The database still answers, so nothing looks broken. It just costs several times more than it should, and the cost grows as you add shards.

The fix is to co-locate: a child table shards by the key of its **parent**, so a user and all of their posts live on one shard and the join stays local. `belongsTo` already declares that relationship, so the generator reads it:

```
Root entities (sharded by their own id):
  users       ->  id (hash)
  categories  ->  id (hash)

Co-located with a parent (joins to that parent stay on one shard):
  orders      ->  customer_id (hash), with customers
  order_items ->  order_id (hash), with orders
  comments    ->  post_id (hash), with posts

Warnings:
  order_items: belongs to 2 parents; sharded by Order only, so joins through Product will scatter
```

The report is printed so you can challenge it. A generated topology you cannot see is one you cannot review.

Note that co-location is one level deep. If `comments` belongs to `posts` and `posts` belongs to `users`, comments co-locate with their post, not with their user. Making that transitive needs a lookup vindex you have to design, so the generator stops rather than inventing a topology that looks right and is not.

### Overriding the derived choice

When the derived column is wrong, declare it on the model:

```typescript
// app/Models/Order.ts
export default defineModel({
  name: 'Order',
  table: 'orders',

  traits: {
    useUuid: true, // sharded keyspaces cannot use AUTO_INCREMENT

    sharding: {
      column: 'tenant_id',
      vindex: 'hash',
    },
  },
})
```

| Option | Meaning |
| --- | --- |
| `column` | Column whose value decides the shard. Rows sharing a value land together. |
| `vindex` | How that column maps to a shard. `hash` (default), `xxhash`, `binary`, `binary_md5`, `unicode_loose_md5`. |
| `unsharded` | Copy this table to every shard instead of splitting it. |
| `sequence` | Sequence table backing an integer primary key. |

Mark small, frequently-joined lookup tables as reference tables. Splitting them would make every join against them a scatter-gather, while duplicating a few hundred rows costs nothing:

```typescript
traits: {
  sharding: { unsharded: true },
},
```

### Schema changes

Vitess applies schema changes through its own online DDL machinery so they can roll out shard by shard without locking the keyspace. `buddy migrate` applies DDL over the connection, which is appropriate for an unsharded keyspace but not for a sharded one. For sharded keyspaces, generate the migrations and hand the SQL to Vitess:

```bash
./buddy generate:migrations
vtctldclient ApplySchema --sql-file database/migrations/<file>.sql <keyspace>
```

### Managing the cluster from ts-cloud

If you deploy with [ts-cloud](https://github.com/stacksjs/ts-cloud), its dashboard manages most of this for you. Declare the cluster and, optionally, its control plane:

```typescript
// cloud.config.ts
infrastructure: {
  appDatabase: {
    engine: 'vitess',
    name: 'commerce',           // keyspace
    host: 'vtgate.internal',
    port: 15306,
    username: 'app',
    password: env.DB_PASSWORD,

    vitess: {
      vtctldAddr: 'vtctld.internal:15999',
      cell: 'zone1',
      clientVersion: '21.0.0',
    },
  },
},
```

The dashboard then shows keyspaces, shards, and tablet health, and flags any shard with no serving primary. That failure is worth calling out: such a shard still answers reads and only fails writes, so it does not look like an outage.

Schema changes applied from the dashboard run as Vitess online DDL and are tracked with live progress, so a migration can be retried, cancelled, or completed from there.

::: tip vtctldAddr is optional
Everything above works through vtgate alone, over the same connection your application already uses. Only creating a keyspace and applying a VSchema are vtctld operations. Leave `vtctldAddr` unset and the dashboard stays fully observable but read-only, which is the right default for a cluster you did not provision with ts-cloud.
:::

### Provisioning a cluster

ts-cloud can also install and run Vitess on the box:

```typescript
// cloud.config.ts
infrastructure: {
  compute: {
    services: {
      vitess: {
        cell: 'zone1',
        keyspaces: [
          { name: 'commerce', sharded: true },
          { name: 'lookup' },
        ],
      },
    },
  },
},
```

That installs Vitess and etcd from the pantry registry, writes systemd units for etcd, vtctld, vttablet (beside a managed mysqld), and vtgate, registers the cell, creates the keyspaces, and waits for vtgate to actually serve before the deploy is allowed to continue.

For development, one process instead of five:

```typescript
services: {
  vitess: { mode: 'combo' },
},
```

`combo` runs the whole stack inside `vtcombo` with an in-memory topology. There is nothing to bootstrap and it goes away cleanly, which makes it right for local work and CI. It is **not durable** and binds to loopback with no authentication, so it must never hold real data.

::: warning Single-box by design
Cluster mode puts every component on one machine. That is a real deployment for staging, small production, and anywhere you want Vitess's routing and online DDL before you need horizontal scale - but a sharded keyspace here has all of its shards on one host, so you get the semantics without the fault tolerance.

Spreading tablets across machines needs per-shard placement and reparent policy, which are decisions to make deliberately rather than defaults to inherit. For that, run the cluster yourself (or use a managed provider) and point ts-cloud at it with `vitess.vtctldAddr`.
:::

## Related

- [Database Package](/packages/database) - connection configuration and the query builder
- [Models](/basics/models) - traits, including `sharding`
- [Query Monitoring](/guide/query-monitoring) - finding the slow queries worth scaling for
