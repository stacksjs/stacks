/**
 * `./buddy migrate:project --from=laravel` tests (stacksjs/stacks#1241).
 *
 * Three layers:
 *   1. Migration parser — pure regex parsing of Laravel `Schema::create()`
 *      bodies into SQL strings. Tested as pure functions.
 *   2. Model parser — pure regex parsing of Eloquent class definitions
 *      into Stacks `defineModel({})` source.
 *   3. End-to-end driver — feeds a synthetic Laravel project (tmp dir
 *      with composer.json + .env + app/Models/User.php +
 *      database/migrations/*.php) to `runMigrator`, asserts the emitted
 *      Stacks files land in the target.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { laravelFilenameToStacks, parseLaravelMigration } from '../src/migrators/laravel/migrations'
import { parseLaravelModel } from '../src/migrators/laravel/models'
import { renderReport, runMigrator } from '../src/migrators'

let root: string
let source: string
let target: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'stacks-migrate-project-'))
  source = join(root, 'source')
  target = join(root, 'target')
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

async function write(rel: string, body: string): Promise<void> {
  const abs = join(source, rel)
  await mkdir(join(abs, '..'), { recursive: true })
  await writeFile(abs, body)
}

describe('parseLaravelMigration() — Schema::create translator', () => {
  test('emits a CREATE TABLE for the canonical users migration', () => {
    const result = parseLaravelMigration(`<?php
return new class extends Migration {
    public function up(): void {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->rememberToken();
            $table->timestamps();
        });
    }
};
`)
    expect(result).not.toBeNull()
    expect(result!.table).toBe('users')
    expect(result!.sql).toContain('CREATE TABLE IF NOT EXISTS users (')
    expect(result!.sql).toContain('id INTEGER PRIMARY KEY AUTOINCREMENT')
    expect(result!.sql).toContain('name TEXT NOT NULL')
    expect(result!.sql).toContain('email TEXT NOT NULL')
    expect(result!.sql).toContain('email_verified_at DATETIME')
    expect(result!.sql).not.toContain('email_verified_at DATETIME NOT NULL')
    expect(result!.sql).toContain('password TEXT NOT NULL')
    expect(result!.sql).toContain('remember_token TEXT')
    expect(result!.sql).toContain('created_at DATETIME DEFAULT CURRENT_TIMESTAMP')
    expect(result!.sql).toContain('updated_at DATETIME')
    expect(result!.sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email);')
  })

  test('maps integer / boolean / json / decimal column types', () => {
    const result = parseLaravelMigration(`<?php
Schema::create('orders', function (Blueprint $table) {
    $table->id();
    $table->integer('quantity');
    $table->boolean('is_paid')->default(false);
    $table->json('metadata')->nullable();
    $table->decimal('total', 8, 2);
});
`)
    expect(result).not.toBeNull()
    expect(result!.sql).toContain('quantity INTEGER NOT NULL')
    expect(result!.sql).toContain('is_paid INTEGER NOT NULL DEFAULT 0')
    expect(result!.sql).toContain('metadata TEXT')
    expect(result!.sql).toContain('total REAL NOT NULL')
  })

  test('emits indexes for chained ->index() modifiers and standalone calls', () => {
    const result = parseLaravelMigration(`<?php
Schema::create('posts', function (Blueprint $table) {
    $table->id();
    $table->string('slug')->index();
    $table->integer('author_id');
    $table->index('author_id');
});
`)
    expect(result).not.toBeNull()
    expect(result!.sql).toContain('CREATE INDEX IF NOT EXISTS posts_slug_index ON posts(slug);')
    expect(result!.sql).toContain('CREATE INDEX IF NOT EXISTS posts_author_id_index ON posts(author_id);')
  })

  test('emits a composite unique index for $table->unique([\'a\', \'b\'])', () => {
    const result = parseLaravelMigration(`<?php
Schema::create('labels', function (Blueprint $table) {
    $table->id();
    $table->integer('board_id');
    $table->string('name');
    $table->unique(['board_id', 'name']);
});
`)
    expect(result).not.toBeNull()
    expect(result!.sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS labels_board_id_name_unique ON labels(board_id, name);')
  })

  test('translates softDeletes() to a nullable deleted_at column', () => {
    const result = parseLaravelMigration(`<?php
Schema::create('subscribers', function (Blueprint $table) {
    $table->id();
    $table->string('email');
    $table->softDeletes();
});
`)
    expect(result).not.toBeNull()
    expect(result!.sql).toContain('deleted_at DATETIME')
    expect(result!.sql).not.toContain('deleted_at DATETIME NOT NULL')
  })

  test('returns null for non-create migrations (alter, drop, data-only)', () => {
    expect(parseLaravelMigration(`<?php
Schema::table('users', function (Blueprint $table) {
    $table->string('avatar')->nullable();
});
`)).toBeNull()
    expect(parseLaravelMigration(`<?php
Schema::dropIfExists('users');
`)).toBeNull()
  })

  test('reports unparseable lines via the `skipped` array rather than throwing', () => {
    const result = parseLaravelMigration(`<?php
Schema::create('weird', function (Blueprint $table) {
    $table->id();
    $table->geometry('shape');
    DB::statement('CREATE TRIGGER ...');
    $table->string('name');
});
`)
    expect(result).not.toBeNull()
    expect(result!.sql).toContain('CREATE TABLE IF NOT EXISTS weird (')
    expect(result!.sql).toContain('name TEXT NOT NULL')
    expect(result!.skipped.length).toBeGreaterThan(0)
  })

  test('default value translates string, boolean, and numeric literals', () => {
    const result = parseLaravelMigration(`<?php
Schema::create('cfg', function (Blueprint $table) {
    $table->id();
    $table->string('color')->default('slate');
    $table->boolean('active')->default(true);
    $table->integer('retries')->default(3);
});
`)
    expect(result).not.toBeNull()
    expect(result!.sql).toContain('color TEXT NOT NULL DEFAULT \'slate\'')
    expect(result!.sql).toContain('active INTEGER NOT NULL DEFAULT 1')
    expect(result!.sql).toContain('retries INTEGER NOT NULL DEFAULT 3')
  })
})

describe('laravelFilenameToStacks() — filename rewriter', () => {
  test('rewrites create-table migrations into the Stacks sequence form', () => {
    expect(laravelFilenameToStacks('2024_01_15_120000_create_users_table.php', 1, 'users'))
      .toBe('0000000001-create-users-table.sql')
  })

  test('handles alter migrations', () => {
    expect(laravelFilenameToStacks('2024_03_02_100000_add_avatar_to_users.php', 12, 'users'))
      .toBe('0000000012-alter-users-migration.sql')
  })

  test('zero-pads the sequence to 10 digits', () => {
    expect(laravelFilenameToStacks('whatever.php', 7, 'foo')).toMatch(/^0000000007-/)
    expect(laravelFilenameToStacks('whatever.php', 9999999999, 'foo')).toMatch(/^9999999999-/)
  })
})

describe('parseLaravelModel() — Eloquent translator', () => {
  test('extracts class name, table, fillable, and casts', () => {
    const result = parseLaravelModel(`<?php
namespace App\\Models;
class User extends Authenticatable {
    use HasFactory, Notifiable;

    protected $table = 'users';

    protected $fillable = [
        'name',
        'email',
        'password',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'is_admin' => 'boolean',
    ];
}
`)
    expect(result).not.toBeNull()
    expect(result!.className).toBe('User')
    expect(result!.table).toBe('users')
    expect(result!.fillable).toEqual(['name', 'email', 'password'])
    expect(result!.hidden).toEqual(['password', 'remember_token'])
    expect(result!.casts).toEqual({
      email_verified_at: 'datetime',
      is_admin: 'boolean',
    })
    expect(result!.tsSource).toContain('name: \'User\'')
    expect(result!.tsSource).toContain('table: \'users\'')
    expect(result!.tsSource).toContain('is_admin: {')
    expect(result!.tsSource).toContain('rule: schema.boolean()')
  })

  test('falls back to pluralised snake_case for missing $table', () => {
    const result = parseLaravelModel(`<?php
class Post extends Model {
    protected $fillable = ['title'];
}
`)
    expect(result!.table).toBe('posts')
  })

  test('pluralisation handles y→ies and sibilant→es', () => {
    const company = parseLaravelModel(`<?php class Company extends Model {}`)
    expect(company!.table).toBe('companies')
    const box = parseLaravelModel(`<?php class Box extends Model {}`)
    expect(box!.table).toBe('boxes')
  })

  test('extracts belongsTo / hasMany / hasOne relationships', () => {
    const result = parseLaravelModel(`<?php
class Post extends Model {
    public function author() {
        return $this->belongsTo(User::class);
    }
    public function comments() {
        return $this->hasMany(Comment::class);
    }
    public function meta() {
        return $this->hasOne(PostMeta::class);
    }
}
`)
    expect(result!.relationships).toHaveLength(3)
    expect(result!.relationships).toContainEqual({ name: 'author', kind: 'belongsTo', target: 'User' })
    expect(result!.relationships).toContainEqual({ name: 'comments', kind: 'hasMany', target: 'Comment' })
    expect(result!.relationships).toContainEqual({ name: 'meta', kind: 'hasOne', target: 'PostMeta' })
    expect(result!.tsSource).toContain('relations: {')
    expect(result!.tsSource).toContain('author: { type: \'belongsTo\', target: \'User\' }')
  })

  test('flags SoftDeletes / HasFactory traits in notes', () => {
    const result = parseLaravelModel(`<?php
class Subscriber extends Model {
    use HasFactory, SoftDeletes;
    protected $fillable = ['email'];
}
`)
    expect(result!.notes.some(n => /SoftDeletes/.test(n))).toBe(true)
    expect(result!.notes.some(n => /HasFactory/.test(n))).toBe(true)
  })

  test('returns null when no class declaration is present', () => {
    expect(parseLaravelModel(`<?php // just a comment`)).toBeNull()
  })
})

describe('end-to-end: runMigrator({ from: \'laravel\' })', () => {
  async function seedLaravelProject(): Promise<void> {
    await write('.env', 'APP_NAME=Laravel\nDB_DATABASE=app\n')
    await write('.env.example', 'APP_NAME=Laravel\n')
    await write('composer.json', JSON.stringify({ require: { 'laravel/framework': '^11.0' } }))
    await write('app/Models/User.php', `<?php
namespace App\\Models;
class User extends Authenticatable {
    protected $table = 'users';
    protected $fillable = ['name', 'email'];
    public function posts() { return $this->hasMany(Post::class); }
}
`)
    await write('database/migrations/2024_01_15_120000_create_users_table.php', `<?php
return new class extends Migration {
    public function up(): void {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->timestamps();
        });
    }
};
`)
    await write('routes/web.php', '<?php Route::get(\'/\', fn () => view(\'welcome\'));')
    await write('app/Http/Controllers/UserController.php', '<?php class UserController {}')
  }

  test('emits Stacks-shaped models, migrations, and copies env', async () => {
    await seedLaravelProject()
    const report = await runMigrator({ source, target, from: 'laravel' })

    expect(existsSync(join(target, '.env'))).toBe(true)
    expect(existsSync(join(target, '.env.example'))).toBe(true)
    expect(existsSync(join(target, 'app/Models/User.ts'))).toBe(true)
    expect(existsSync(join(target, 'database/migrations/0000000001-create-users-table.sql'))).toBe(true)

    const sql = readFileSync(join(target, 'database/migrations/0000000001-create-users-table.sql'), 'utf8')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS users (')
    expect(sql).toContain('id INTEGER PRIMARY KEY AUTOINCREMENT')
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique')

    const model = readFileSync(join(target, 'app/Models/User.ts'), 'utf8')
    expect(model).toContain('defineModel({')
    expect(model).toContain('name: \'User\'')
    expect(model).toContain('posts: { type: \'hasMany\', target: \'Post\' }')

    // Surfaces we don't port yet should land as `skipped` so the report is honest.
    const skipped = report.entries.filter(e => e.status === 'skipped').map(e => e.source)
    expect(skipped).toContain('routes')
    expect(skipped).toContain('app/Http/Controllers')
    expect(skipped).toContain('composer.json')
  })

  test('--dry-run does not touch the target filesystem', async () => {
    await seedLaravelProject()
    const report = await runMigrator({ source, target, from: 'laravel', dryRun: true })

    expect(existsSync(target)).toBe(false)
    // Report still reflects what would have been translated.
    expect(report.entries.some(e => e.status === 'translated' && e.target.endsWith('User.ts'))).toBe(true)
  })

  test('renders a markdown report with sections per status', async () => {
    await seedLaravelProject()
    const report = await runMigrator({ source, target, from: 'laravel' })
    const md = renderReport(report)
    expect(md).toContain('# Migration report — laravel → Stacks')
    expect(md).toContain('## Translated')
    expect(md).toContain('## Copied verbatim')
    expect(md).toContain('## Skipped')
    expect(md).toContain('database/migrations/0000000001-create-users-table.sql')
  })
})

describe('end-to-end: runMigrator({ from: \'rails\' })', () => {
  test('returns a single not-implemented skipped entry', async () => {
    await mkdir(source, { recursive: true })
    const report = await runMigrator({ source, target, from: 'rails' })
    expect(report.entries).toHaveLength(1)
    expect(report.entries[0].status).toBe('skipped')
    expect(report.entries[0].note).toMatch(/not yet implemented/i)
  })
})
