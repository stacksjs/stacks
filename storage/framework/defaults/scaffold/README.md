# __APP_NAME__

A [Stacks](https://stacksjs.com) application.

## Getting started

```bash
./buddy dev
```

`./buddy doctor` checks your setup if anything does not start.

## Everyday commands

| Command | What it does |
|---|---|
| `./buddy dev` | Start the development servers |
| `./buddy migrate` | Apply pending database migrations |
| `./buddy test` | Run the test suite |
| `./buddy typecheck` | Type check `app/`, `config/`, `resources/` and `routes/` |
| `./buddy lint` | Lint, and `./buddy lint:fix` to fix what can be fixed |
| `./buddy upgrade` | Move to the latest Stacks release |
| `./buddy list` | Every other command |

## Where things live

- `app/`, `resources/`, `routes/`, `database/`: your application.
- `config/`: every setting, one typed file per subsystem. System dependencies
  are declared in `config/deps.ts`, and `deps.yaml` is generated from it.
- `storage/framework/defaults`: the framework's default models, actions, views
  and routes. It is a gitignored link to `node_modules/@stacksjs/defaults`, so
  it upgrades with the `stacks` dependency. Override any default by creating the
  same path under `app/` or `resources/`, or run `./buddy publish:defaults` to
  commit a copy of the whole tree instead.

Read more at [stacksjs.com/docs](https://stacksjs.com/docs).
