# Scaffolding Commands (Make)

The `make` commands generate boilerplate code and scaffold new files for your Stacks application.

## Overview

```bash
buddy make:action       # Create a new action
buddy make:command      # Create a new CLI command
buddy make:component    # Create a new component
buddy make:model        # Create a new model
buddy make:migration    # Create a new migration
buddy make:notification # Create a new notification
buddy make:policy       # Create a new authorization policy
buddy make:resource     # Create a new API resource
buddy make:job          # Create a new job
buddy make:factory      # Create a new factory
buddy make:database     # Create a new database
buddy make:lang         # Create a new language file
buddy make:stack        # Create a new stack project
buddy make:view         # Create a new page/view
buddy make:function     # Create a new function
buddy make:certificate  # Create a new SSL certificate
```

## Create Component

```bash
buddy make:component <name>
```

Creates a new Vue/Stacks component.

### Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--name` | `-n` | The name of the component |
| `--project` | `-p` | Target a specific project |
| `--verbose` | | Enable verbose output |

### Example

```bash
buddy make:component HelloWorld
buddy make:component UserCard
buddy make:component Dashboard/Stats
```

## Create Model

```bash
buddy make:model <name>
```

Creates a new database model with TypeScript types.

### Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--name` | `-n` | The name of the model |
| `--project` | `-p` | Target a specific project |
| `--verbose` | | Enable verbose output |

### Example

```bash
buddy make:model User
buddy make:model Post
buddy make:model Comment
```

## Create Migration

```bash
buddy make:migration <name>
```

Creates a new database migration file.

### Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--name` | `-n` | The name of the migration |
| `--project` | `-p` | Target a specific project |
| `--verbose` | | Enable verbose output |

### Example

```bash
buddy make:migration create_users_table
buddy make:migration add_email_to_users
buddy make:migration create_posts_table
```

## Create Action

```bash
buddy make:action <name>
```

Creates a new action file. Actions are reusable pieces of business logic.

### Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--name` | `-n` | The name of the action |
| `--project` | `-p` | Target a specific project |
| `--verbose` | | Enable verbose output |

### Example

```bash
buddy make:action SendWelcomeEmail
buddy make:action ProcessPayment
buddy make:action GenerateReport
```

## Create CLI Command

```bash
buddy make:command <name>
```

Creates a new CLI command that can be run with Buddy.

### Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--name` | `-n` | The name of the command |
| `--signature` | `-s` | The command signature (CLI name) |
| `--description` | `-d` | The command description |
| `--no-register` | | Do not register in Commands.ts |
| `--project` | `-p` | Target a specific project |
| `--verbose` | | Enable verbose output |

### Example

```bash
buddy make:command SendEmails
buddy make:command SendEmails --signature=send-emails
buddy make:command ProcessQueue --description="Process the job queue"
```

## Create Notification

```bash
buddy make:notification <name>
```

Creates a new notification (email, SMS, or chat).

### Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--name` | `-n` | The name of the notification |
| `--email` | `-e` | Is it an email notification? (default: true) |
| `--chat` | `-c` | Is it a chat notification? |
| `--sms` | `-s` | Is it an SMS notification? |
| `--project` | `-p` | Target a specific project |
| `--verbose` | | Enable verbose output |

### Example

```bash
buddy make:notification WelcomeEmail
buddy make:notification OrderShipped --email
buddy make:notification PasswordReset --sms
```

## Create Policy

```bash
buddy make:policy <name>
```

Creates a new authorization policy for controlling access to resources.

### Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--name` | `-n` | The name of the policy |
| `--model` | `-m` | The model this policy is for |
| `--no-register` | | Do not register in Gates.ts |
| `--project` | `-p` | Target a specific project |
| `--verbose` | | Enable verbose output |

### Example

```bash
buddy make:policy PostPolicy
buddy make:policy CommentPolicy --model=Comment
```

## Create Resource

```bash
buddy make:resource <name>
```

Creates a new API resource for transforming model data.

### Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--name` | `-n` | The name of the resource |
| `--model` | `-m` | The model this resource is for |
| `--collection` | `-c` | Create a collection resource |
| `--project` | `-p` | Target a specific project |
| `--verbose` | | Enable verbose output |

### Example

```bash
buddy make:resource UserResource
buddy make:resource PostResource --model=Post
buddy make:resource PostCollection --collection
```

## Create Job

```bash
buddy make:job <name>
```

Creates a new background job for queue processing.

### Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--name` | `-n` | The name of the job |
| `--queue` | `-q` | The queue to dispatch to (default: "default") |
| `--class` | `-c` | Create a class-based job |
| `--tries` | `-t` | Number of retry attempts (default: 3) |
| `--backoff` | `-b` | Backoff delay in seconds (default: 3) |
| `--project` | `-p` | Target a specific project |
| `--verbose` | | Enable verbose output |

### Example

```bash
buddy make:job SendWelcomeEmail
buddy make:job ProcessPayment --queue=payments
buddy make:job GenerateReport --tries=5 --backoff=10
```

## Create Database

```bash
buddy make:database <name>
```

Creates a new database.

### Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--name` | `-n` | The name of the database |
| `--project` | `-p` | Target a specific project |
| `--verbose` | | Enable verbose output |

### Example

```bash
buddy make:database my-cool-database
buddy make:database analytics
```

## Create Language File

```bash
buddy make:lang <locale>
```

Creates a new language/translation file.

### Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--name` | `-n` | The locale code |
| `--project` | `-p` | Target a specific project |
| `--verbose` | | Enable verbose output |

### Example

```bash
buddy make:lang de      # German
buddy make:lang fr      # French
buddy make:lang es      # Spanish
buddy make:lang zh-CN   # Chinese (Simplified)
```

## Create View/Page

```bash
buddy make:view <name>
```

Creates a new page/view component.

**Aliases:** `buddy make:page`

### Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--name` | `-n` | The name of the view |
| `--project` | `-p` | Target a specific project |
| `--verbose` | | Enable verbose output |

### Example

```bash
buddy make:view home
buddy make:view about
buddy make:view dashboard/settings
```

## Create Function

```bash
buddy make:function <name>
```

Creates a new function.

### Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--name` | `-n` | The name of the function |
| `--project` | `-p` | Target a specific project |
| `--verbose` | | Enable verbose output |

### Example

```bash
buddy make:function hello-world
buddy make:function calculate-tax
```

## Create Stack

```bash
buddy make:stack <name>
```

Creates a new Stacks project. This is similar to running `bunx stacks new <name>`.

### Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--name` | `-n` | The name of the stack |
| `--project` | `-p` | Target a specific project |
| `--verbose` | | Enable verbose output |

### Example

```bash
buddy make:stack my-project
buddy make:stack my-awesome-app
```

## Create Certificate

```bash
buddy make:certificate
```

Creates a new SSL certificate for local development.

**Aliases:** `buddy make:cert`

### Example

```bash
buddy make:certificate
```

## Create Queue Table

```bash
buddy make:queue-table
```

Creates the migration for the queue jobs table.

### Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--project` | `-p` | Target a specific project |
| `--verbose` | | Enable verbose output |

## Tips

### Naming Conventions

- **Components**: Use PascalCase (e.g., `UserCard`, `DashboardStats`)
- **Models**: Use PascalCase singular (e.g., `User`, `Post`, `Comment`)
- **Migrations**: Use snake_case with descriptive names (e.g., `create_users_table`)
- **Actions**: Use PascalCase with verb (e.g., `SendEmail`, `ProcessPayment`)
- **Commands**: Use PascalCase (e.g., `SendEmails`, `ProcessQueue`)

### File Locations

Generated files are placed in their appropriate directories:
- Components: `resources/components/`
- Models: `app/Models/`
- Migrations: `database/migrations/`
- Actions: `app/Actions/`
- Commands: `app/Commands/`
- Notifications: `app/Notifications/`
- Policies: `app/Policies/`
- Resources: `app/Resources/`
- Jobs: `app/Jobs/`
