# CI

Continuous Integration (CI) ensures your code is tested and validated before merging. Stacks provides built-in CI support and integrates seamlessly with popular CI/CD platforms.

## Overview

Stacks CI features:

- **Automated testing** - Run tests on every push
- **Type checking** - Validate TypeScript types
- **Linting** - Enforce code standards
- **Build validation** - Ensure builds succeed
- **Preview deployments** - Deploy PRs for review

## Quick Start

### Initialize CI

```bash
# Generate CI configuration files
buddy ci:init
```

This creates configuration files for:
- GitHub Actions
- GitLab CI
- CircleCI
- Jenkins

## GitHub Actions

### Basic Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Type check
        run: bun run typecheck

      - name: Lint
        run: bun run lint

      - name: Test
        run: bun test

      - name: Build
        run: bun run build
```

### Full CI/CD Pipeline

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_ENV: test

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run typecheck

  test:
    runs-on: ubuntu-latest
    needs: [lint, typecheck]

    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: password
          MYSQL_DATABASE: test
        ports:
          - 3306:3306
        options: >-
          --health-cmd="mysqladmin ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=3

      redis:
        image: redis:7
        ports:
          - 6379:6379
        options: >-
          --health-cmd="redis-cli ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=3

    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install

      - name: Run migrations
        run: bun run migrate
        env:
          DB_CONNECTION: mysql
          DB_HOST: 127.0.0.1
          DB_PORT: 3306
          DB_DATABASE: test
          DB_USERNAME: root
          DB_PASSWORD: password

      - name: Run tests
        run: bun test --coverage
        env:
          DB_CONNECTION: mysql
          DB_HOST: 127.0.0.1
          REDIS_HOST: 127.0.0.1

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  build:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run build

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build
          path: dist/

  deploy-preview:
    runs-on: ubuntu-latest
    needs: build
    if: github.event_name == 'pull_request'

    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install

      - name: Download build
        uses: actions/download-artifact@v4
        with:
          name: build
          path: dist/

      - name: Deploy preview
        run: bun run deploy --preview
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}

      - name: Comment preview URL
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '🚀 Preview deployed: https://preview-${{ github.event.number }}.myapp.com'
            })

  deploy-production:
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'

    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install

      - name: Download build
        uses: actions/download-artifact@v4
        with:
          name: build
          path: dist/

      - name: Deploy to production
        run: bun run deploy
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

### Matrix Testing

Test across multiple configurations:

```yaml
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        bun-version: ['1.0', '1.1', 'latest']

    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: ${{ matrix.bun-version }}
      - run: bun install
      - run: bun test
```

## GitLab CI

```yaml
# .gitlab-ci.yml
stages:
  - test
  - build
  - deploy

variables:
  BUN_VERSION: "1.1"

.setup: &setup
  before_script:
    - curl -fsSL https://bun.sh/install | bash
    - export PATH="$HOME/.bun/bin:$PATH"
    - bun install

lint:
  stage: test
  <<: *setup
  script:
    - bun run lint

typecheck:
  stage: test
  <<: *setup
  script:
    - bun run typecheck

test:
  stage: test
  <<: *setup
  services:
    - mysql:8.0
    - redis:7
  variables:
    MYSQL_ROOT_PASSWORD: password
    MYSQL_DATABASE: test
    DB_HOST: mysql
    REDIS_HOST: redis
  script:
    - bun run migrate
    - bun test --coverage
  coverage: '/Lines\s*:\s*(\d+\.\d+)%/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml

build:
  stage: build
  <<: *setup
  script:
    - bun run build
  artifacts:
    paths:
      - dist/
    expire_in: 1 week

deploy-staging:
  stage: deploy
  <<: *setup
  script:
    - bun run deploy --env=staging
  environment:
    name: staging
    url: https://staging.myapp.com
  only:
    - develop

deploy-production:
  stage: deploy
  <<: *setup
  script:
    - bun run deploy --env=production
  environment:
    name: production
    url: https://myapp.com
  only:
    - main
  when: manual
```

## CircleCI

```yaml
# .circleci/config.yml
version: 2.1

orbs:
  bun: oven-sh/bun@1

executors:
  default:
    docker:
      - image: cimg/base:stable
      - image: cimg/mysql:8.0
        environment:
          MYSQL_ROOT_PASSWORD: password
          MYSQL_DATABASE: test
      - image: cimg/redis:7.0

jobs:
  install:
    executor: default
    steps:
      - checkout
      - bun/install
      - run: bun install
      - persist_to_workspace:
          root: .
          paths:
            - node_modules
            - .bun

  lint:
    executor: default
    steps:
      - checkout
      - attach_workspace:
          at: .
      - bun/install
      - run: bun run lint

  test:
    executor: default
    steps:
      - checkout
      - attach_workspace:
          at: .
      - bun/install
      - run:
          name: Wait for MySQL
          command: dockerize -wait tcp://localhost:3306 -timeout 1m
      - run:
          name: Run migrations
          command: bun run migrate
          environment:
            DB_HOST: 127.0.0.1
      - run:
          name: Run tests
          command: bun test --coverage
      - store_test_results:
          path: test-results
      - store_artifacts:
          path: coverage

  build:
    executor: default
    steps:
      - checkout
      - attach_workspace:
          at: .
      - bun/install
      - run: bun run build
      - persist_to_workspace:
          root: .
          paths:
            - dist

  deploy:
    executor: default
    steps:
      - checkout
      - attach_workspace:
          at: .
      - bun/install
      - run: bun run deploy

workflows:
  ci:
    jobs:
      - install
      - lint:
          requires: [install]
      - test:
          requires: [install]
      - build:
          requires: [lint, test]
      - deploy:
          requires: [build]
          filters:
            branches:
              only: main
```

## Local CI

Run CI checks locally before pushing:

```bash
# Run all CI checks
buddy ci

# Run specific checks
buddy ci:lint
buddy ci:typecheck
buddy ci:test
buddy ci:build
```

## Pre-commit Hooks

Set up automatic checks before commits:

```bash
# Install hooks
buddy hooks:install
```

```typescript
// .husky/pre-commit
#!/bin/sh
bun run lint-staged
```

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

## Test Configuration

### Coverage Thresholds

```typescript
// bunfig.toml
[test]
coverage = true
coverageThreshold = { lines = 80, functions = 80, branches = 70 }
```

### Test Timeouts

```typescript
// bun.config.ts
export default {
  test: {
    timeout: 30000, // 30 seconds
    bail: true, // Stop on first failure
  },
}
```

## Notifications

### Slack Integration

```yaml
- name: Notify Slack
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    fields: repo,message,commit,author,action,eventName,ref,workflow
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
  if: always()
```

### Email Notifications

Configure in your CI platform settings to receive email on failures.

## Caching

Speed up CI with caching:

```yaml
- name: Cache Bun dependencies
  uses: actions/cache@v4
  with:
    path: |
      ~/.bun/install/cache
      node_modules
    key: ${{ runner.os }}-bun-${{ hashFiles('bun.lock') }}
    restore-keys: |
      ${{ runner.os }}-bun-
```

## Security Scanning

```yaml
security:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4

    - name: Run security audit
      run: bun audit

    - name: Run SAST
      uses: github/codeql-action/analyze@v2
```

## Best Practices

1. **Fail fast** - Run quick checks (lint, typecheck) first
2. **Parallelize** - Run independent jobs concurrently
3. **Cache dependencies** - Speed up subsequent runs
4. **Use services** - Spin up databases/Redis in CI
5. **Preview deployments** - Deploy PRs for review
6. **Protect main** - Require passing CI before merge

## Related

- [Testing](/guide/testing) - Writing tests
- [Linting](/guide/linting) - Code standards
- [Cloud Deployment](/guide/cloud) - Deploying applications
