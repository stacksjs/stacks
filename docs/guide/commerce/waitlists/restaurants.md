# Restaurant Waitlists

The Restaurant Waitlist module in the Commerce package provides a comprehensive set of functions to manage restaurant waitlists. This module helps you handle customer waiting lists, table assignments, wait times, and detailed analytics for restaurant operations.

## Getting Started

First, import the restaurant waitlist functionality from the Commerce package:

```ts
import { waitlists } from '@stacksjs/commerce'
```

## Fetching Waitlist Entries

The Commerce package provides several methods to fetch restaurant waitlist entries:

### Basic Fetching

```ts
// Fetch all entries
const allEntries = await waitlists.restaurant.fetchAll()

// Fetch a single entry
const entry = await waitlists.restaurant.fetchById(1)

// Fetch all waiting entries
const waitingEntries = await waitlists.restaurant.fetchWaiting()
```

### Analytics and Statistics

```ts
// Get current wait times
const waitTimes = await waitlists.restaurant.fetchCurrentWaitTimes()

// Get average wait times
const averageWaitTimes = await waitlists.restaurant.fetchAverageWaitTimes()

// Get tables turned today
const tableStats = await waitlists.restaurant.fetchTablesTurnedToday()

// Get seating rate
const seatingStats = await waitlists.restaurant.fetchSeatingRate(startDate, endDate)

// Get no-show statistics
const noShowStats = await waitlists.restaurant.fetchNoShowStats(startDate, endDate)

// Get seated statistics for last 24 hours
const seatedStats = await waitlists.restaurant.fetchSeatedStats()
```

### Detailed Analytics

```ts
// Get waiting entries with party sizes
const waitingWithSizes = await waitlists.restaurant.fetchWaitingWithPartySizes()

// Get waiting entries with quoted times
const waitingWithTimes = await waitlists.restaurant.fetchWaitingWithQuotedTimes()

// Get conversion rates
const conversionRates = await waitlists.restaurant.fetchConversionRates()

// Get time series statistics
const timeSeriesStats = await waitlists.restaurant.fetchTimeSeriesStats()
```

### Filtering and Counting

```ts
// Count by table preference
const tablePreferenceCounts = await waitlists.restaurant.fetchCountByTablePreference()

// Count by party size
const partySizeCounts = await waitlists.restaurant.fetchCountByAllPartySizes()

// Count by specific party size
const specificSizeCount = await waitlists.restaurant.fetchCountByPartySize(4)

// Count by date
const dateCount = await waitlists.restaurant.fetchCountByDate(new Date())

// Fetch between dates
const dateRangeEntries = await waitlists.restaurant.fetchBetweenDates(startDate, endDate)

// Fetch seated between dates
const seatedEntries = await waitlists.restaurant.fetchSeatedBetweenDates(startDate, endDate)
```

## Managing Waitlist Entries

### Store a New Entry

```ts
const newEntry = await waitlists.restaurant.store({
  name: 'John Doe',
  phone: '+1234567890',
  party_size: 4,
  table_preference: 'booth',
  check_in_time: new Date(),
  quoted_wait_time: 30,
  status: 'waiting',
})
```

### Store Multiple Entries

```ts
const newEntries = await waitlists.restaurant.bulkStore([
  {
    name: 'John Doe',
    phone: '+1234567890',
    party_size: 4,
    table_preference: 'booth',
  },
  {
    name: 'Jane Smith',
    phone: '+1234567891',
    party_size: 2,
    table_preference: 'window',
  },
])
```

### Update an Entry

```ts
const updatedEntry = await waitlists.restaurant.update(1, {
  name: 'John Doe Updated',
  phone: '+1234567892',
  table_preference: 'window',
})
```

### Update Status

```ts
const updatedStatus = await waitlists.restaurant.updateStatus(1, 'seated')
```

### Update Wait Times

```ts
const updatedWaitTimes = await waitlists.restaurant.updateWaitTimes(1, 30, 35)
```

### Update Party Size

```ts
const updatedPartySize = await waitlists.restaurant.updatePartySize(1, 5)
```

### Update Queue Position

```ts
const updatedPosition = await waitlists.restaurant.updateQueuePosition(1, 3)
```

### Delete Entries

Single entry deletion:
```ts
const deletedEntry = await waitlists.restaurant.destroy(1) // Returns the deleted entry
```

Bulk deletion:
```ts
const deletedCount = await waitlists.restaurant.bulkDestroy([1, 2, 3]) // Returns number of entries deleted
```

## Exporting Data

The module provides functionality to export waitlist data:

```ts
// Export to CSV
const csvExport = await waitlists.restaurant.exportRestaurantWaitlist('csv')

// Export to Excel
const excelExport = await waitlists.restaurant.exportRestaurantWaitlist('excel')

// Download export
await waitlists.restaurant.downloadRestaurantWaitlist('csv', 'waitlist_export.csv')

// Store export to disk
await waitlists.restaurant.storeRestaurantWaitlistExport('csv', '/path/to/export.csv')
```

## API Endpoints

The Restaurant Waitlist module provides RESTful API endpoints for managing waitlist entries. All endpoints are prefixed with `/commerce`.

```
GET    /commerce/waitlist/restaurants              # List all entries
POST   /commerce/waitlist/restaurants              # Create a new entry
POST   /commerce/waitlist/restaurants/bulk         # Create multiple entries
GET    /commerce/waitlist/restaurants/{id}         # Get a specific entry
PATCH  /commerce/waitlist/restaurants/{id}         # Update an entry
PATCH  /commerce/waitlist/restaurants/{id}/status  # Update entry status
PATCH  /commerce/waitlist/restaurants/{id}/wait    # Update wait times
PATCH  /commerce/waitlist/restaurants/{id}/size    # Update party size
PATCH  /commerce/waitlist/restaurants/{id}/queue   # Update queue position
DELETE /commerce/waitlist/restaurants/{id}         # Delete an entry
DELETE /commerce/waitlist/restaurants/bulk         # Delete multiple entries
GET    /commerce/waitlist/restaurants/export       # Export waitlist data
```

### Example Usage

```ts
// List all entries
const response = await fetch('/commerce/waitlist/restaurants')
const entries = await response.json()

// Create a new entry
const response = await fetch('/commerce/waitlist/restaurants', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'John Doe',
    phone: '+1234567890',
    party_size: 4,
    table_preference: 'booth',
  }),
})
const newEntry = await response.json()

// Update entry status
const response = await fetch('/commerce/waitlist/restaurants/1/status', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    status: 'seated',
  }),
})
const updatedStatus = await response.json()
```

### Response Format

A successful response includes the restaurant waitlist entry data with all its attributes:

```json
{
  "id": 1,
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "name": "John Doe",
  "phone": "+1234567890",
  "party_size": 4,
  "table_preference": "booth",
  "status": "waiting",
  "quoted_wait_time": 30,
  "actual_wait_time": null,
  "queue_position": 1,
  "check_in_time": "2024-01-01T00:00:00.000Z",
  "customer_id": 123,
  "notes": null,
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

## Error Handling

The Restaurant Waitlist module includes built-in error handling for common scenarios:

- Invalid entry IDs will throw appropriate errors
- Missing required fields during creation will throw validation errors
- All database operations are wrapped in try-catch blocks for proper error handling
- Bulk operations are handled atomically to ensure data consistency
- Status updates are validated against allowed values ('waiting', 'seated')
- Phone number validations ensure proper format
- Party size validations ensure positive numbers
- Wait time validations ensure proper time formats
- Queue position validations ensure proper ordering

Example error handling in your code:

```ts
try {
  const entry = await waitlists.restaurant.store({
    name: 'John Doe',
    phone: '+1234567890',
    party_size: 4,
    table_preference: 'booth',
  })
} catch (error) {
  console.error('Failed to create waitlist entry:', error.message)
}
```

This documentation covers the basic operations available in the Restaurant Waitlist module. Each function is type-safe and returns properly typed responses, making it easy to work with in TypeScript environments.
