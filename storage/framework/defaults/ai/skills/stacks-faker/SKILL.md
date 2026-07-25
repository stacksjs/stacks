---
name: stacks-faker
description: Use when working with fake data generation in a Stacks application — seeding databases, generating test data, model factories, or using faker utilities. Covers @stacksjs/faker (wrapper around ts-mocker) and its integration with the database seeder.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Faker

`@stacksjs/faker` wraps `ts-mocker` with a `@faker-js/faker`-compatible API plus enhanced modules for vehicle, company, lorem, location, datatype, and helpers.

## Key Paths
- Core package: `storage/framework/core/faker/src/`
- Source: `storage/framework/core/faker/src/index.ts` (265 lines)
- Tests: `storage/framework/core/faker/tests/faker.test.ts`
- Seeder integration: `storage/framework/core/database/src/seeder.ts`

## Usage

```typescript
import { faker } from '@stacksjs/faker'

faker.person.fullName()        // 'John Smith'
faker.internet.email()         // 'john.smith@example.com'
faker.lorem.sentence()         // 'Lorem ipsum dolor sit amet.'
faker.number.int({ min: 1, max: 100 })  // 42
faker.datatype.uuid()          // 'a1b2c3d4-...'
faker.vehicle.vrm()            // 'AB12 CDE'
```

## Modules

### datatype (Compatibility Layer)
```typescript
faker.datatype.boolean(): boolean
faker.datatype.number(options?: { min?: number, max?: number }): number
faker.datatype.float(options?: { min?: number, max?: number, precision?: number }): number
faker.datatype.uuid(): string
faker.datatype.string(length?: number): string           // default: 10
faker.datatype.array<T>(generator: () => T, length?: number): T[]
```

### location
```typescript
faker.location.street(): string
faker.location.streetAddress(useFullAddress?: boolean): string
faker.location.city(): string
faker.location.state(): string
faker.location.stateAbbr(): string
faker.location.country(): string
faker.location.countryCode(): string
faker.location.zipCode(): string
faker.location.latitude(options?: { min?, max?, precision? }): number
faker.location.longitude(options?: { min?, max?, precision? }): number
faker.location.direction(): string
faker.location.buildingNumber(): string
```

### company
```typescript
faker.company.name(): string
faker.company.catchPhrase(): string
faker.company.buzzPhrase(): string
```

### vehicle (Fully Custom)
```typescript
faker.vehicle.vrm(): string             // UK Registration: 'AB12 CDE'
faker.vehicle.vehicle(): string          // 'Toyota Camry'
faker.vehicle.type(): string             // Sedan, SUV, Truck, Van, Coupe, etc.
faker.vehicle.manufacturer(): string     // Toyota, Honda, Ford, BMW, Tesla, etc.
faker.vehicle.model(): string            // Camry, Accord, F-150, Model 3, etc.
faker.vehicle.fuel(): string             // Gasoline, Diesel, Electric, Hybrid
faker.vehicle.vin(): string              // 17-character VIN
faker.vehicle.color(): string            // Black, White, Silver, Red, Blue, etc.
```

### helpers
```typescript
faker.helpers.arrayElement<T>(array: T[]): T
faker.helpers.arrayElements<T>(array: T[], count?: number): T[]
faker.helpers.shuffle<T>(array: T[]): T[]
faker.helpers.maybe<T>(cb: () => T, options?: { probability?: number }): T | undefined
faker.helpers.objectKey<T>(obj: T): keyof T
faker.helpers.objectValue<T>(obj: T): T[keyof T]
```

### lorem
```typescript
faker.lorem.word(): string
faker.lorem.words(count?: number): string              // default: 3
faker.lorem.sentence(maxWords?: number): string        // default: 3-10 words
faker.lorem.sentences(count?, separator?): string      // default: 3, sep: ' '
faker.lorem.paragraph(sentenceCount?): string
faker.lorem.paragraphs(count?, separator?): string     // default: 3, sep: '\n\n'
faker.lorem.text(length?: number): string              // default: 200 chars
faker.lorem.slug(wordCount?: number): string           // URL-safe, default: 3
faker.lorem.lines(count?: number): string              // default: 3
```

### Inherited from ts-mocker
```typescript
faker.commerce.department() / .price() / .productName() / .productDescription()
faker.date.past() / .future() / .recent() / .soon()
faker.finance.creditCardNumber()
faker.image.avatar() / .url()
faker.internet.email() / .ip() / .mac() / .url() / .userAgent()
faker.number.int() / .float()
faker.person.fullName()
faker.phone.number()
faker.string.alpha() / .alphanumeric() / .numeric() / .uuid()
faker.system.fileName() / .filePath() / .fileType()
faker.word.adjective() / .noun()
```

## Seeder Integration

Model attributes declare a `factory` function receiving `faker`:

```typescript
{
  name: {
    validator: { rule: 'string', min: 3, max: 255 },
    factory: faker => faker.company.name(),
  },
  status: {
    validator: { rule: 'enum', options: ['active', 'inactive'] },
    factory: faker => faker.helpers.arrayElement(['active', 'inactive']),
  },
}
```

### How Seeding Works
1. Model needs `traits: { useSeeder: { count: N } }`
2. `generateRecord()` calls `attr.factory(faker)` for each attribute
3. Falls back to `attr.default` if factory fails
4. Converts camelCase → snake_case for DB columns
5. Auto-hashes password fields (bcrypt)
6. Inserts in batches of 100
7. Order: User (0), Team (1), Project (2), everything else (10)

### Smart Default Inference (no factory defined)
- `is*`, `has*`, `*able` → `false`
- `*count`, `*amount`, `*quantity` → `0`
- `*url`, `*link` → `'https://example.com'`
- `*email` → `faker.internet.email()`
- `*name` → `faker.person.fullName()`
- Unknown → `null`

## Gotchas
- **Not @faker-js/faker** — wrapper around `ts-mocker`. Most APIs compatible but not all
- **Custom modules override base** — lorem, datatype, location, company, vehicle, helpers are custom
- **Vehicle module is fully custom** — hardcoded manufacturer/model lists, not from ts-mocker
- **Factory receives faker** — signature is `(faker: Faker) => value`, not `() => value`
- **Password detection is heuristic** — by name pattern or `hidden: true` attribute
- **Seeder batch size is 100** — records inserted in chunks
- **Model seeding order matters** — User first, then Team, Project, everything else
