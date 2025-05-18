# Print Devices

The Print Devices module in the Commerce package provides a comprehensive set of functions to manage print devices for receipt printing and monitoring. This module helps you handle printer management, status tracking, and performance analytics.

## Getting Started

First, import the print devices functionality from the Commerce package:

```ts
import { devices } from '@stacksjs/commerce'
```

## Fetching Print Devices

The Commerce package provides several methods to fetch print device information:

### Basic Fetching

```ts
// Fetch all devices
const allDevices = await devices.fetchAll()

// Fetch a single device
const device = await devices.fetchById(1)
```

### Analytics and Statistics

```ts
// Get total print count
const totalPrints = await devices.countTotalPrints()

// Get prints for specific device
const devicePrints = await devices.countPrintsByDeviceId(1)

// Calculate error rate
const errorRate = await devices.calculateErrorRate()

// Get printer health percentage
const printerHealth = await devices.calculatePrinterHealth()

// Get printer status counts
const statusCounts = await devices.getPrinterStatusCounts()
```

### Error Tracking

```ts
// Fetch errors for specific device
const deviceErrors = await devices.fetchErrorsByDeviceId(1)
```

## Managing Print Devices

### Store a New Device

```ts
const newDevice = await devices.store({
  name: 'Kitchen Printer 1',
  mac_address: '00:11:22:33:44:55',
  location: 'Kitchen',
  terminal: 'POS-1',
  status: 'online',
  print_count: 0,
})
```

### Store Multiple Devices

```ts
const newDevices = await devices.bulkStore([
  {
    name: 'Kitchen Printer 1',
    mac_address: '00:11:22:33:44:55',
    location: 'Kitchen',
    terminal: 'POS-1',
  },
  {
    name: 'Bar Printer 1',
    mac_address: '00:11:22:33:44:66',
    location: 'Bar',
    terminal: 'POS-2',
  },
])
```

### Update a Device

```ts
const updatedDevice = await devices.update(1, {
  name: 'Kitchen Printer 2',
  location: 'Kitchen Area',
})
```

### Update Device Status

```ts
const updatedStatus = await devices.updateStatus(1, 'online')
```

### Update Print Count

```ts
const updatedPrintCount = await devices.updatePrintCount(1, 150)
```

### Delete Devices

Single device deletion:
```ts
const deleted = await devices.destroy(1) // Returns true if successful
```

Bulk deletion:
```ts
const deletedCount = await devices.bulkDestroy([1, 2, 3]) // Returns number of devices deleted
```

## Exporting Data

The module provides functionality to export print device data:

```ts
// Export to CSV
const csvExport = await devices.exportPrintDevices('csv')

// Export to Excel
const excelExport = await devices.exportPrintDevices('excel')

// Download export
await devices.downloadPrintDevices('csv', 'print_devices.csv')

// Store export to disk
await devices.storePrintDevicesExport('csv', '/path/to/export.csv')
```

## API Endpoints

The Print Devices module provides RESTful API endpoints for managing print devices. All endpoints are prefixed with `/commerce`.

```
GET    /commerce/printers/devices              # List all devices
POST   /commerce/printers/devices              # Create a new device
POST   /commerce/printers/devices/bulk         # Create multiple devices
GET    /commerce/printers/devices/{id}         # Get a specific device
PATCH  /commerce/printers/devices/{id}         # Update a device
PATCH  /commerce/printers/devices/{id}/status  # Update device status
PATCH  /commerce/printers/devices/{id}/count   # Update print count
DELETE /commerce/printers/devices/{id}         # Delete a device
DELETE /commerce/printers/devices/bulk         # Delete multiple devices
GET    /commerce/printers/devices/export       # Export device data
```

### Example Usage

```ts
// List all devices
const response = await fetch('/commerce/printers/devices')
const devices = await response.json()

// Create a new device
const response = await fetch('/commerce/printers/devices', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'Kitchen Printer 1',
    mac_address: '00:11:22:33:44:55',
    location: 'Kitchen',
    terminal: 'POS-1',
  }),
})
const newDevice = await response.json()

// Update device status
const response = await fetch('/commerce/printers/devices/1/status', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    status: 'online',
  }),
})
const updatedStatus = await response.json()
```

### Response Format

A successful response includes the print device data with all its attributes:

```json
{
  "id": 1,
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Kitchen Printer 1",
  "mac_address": "00:11:22:33:44:55",
  "location": "Kitchen",
  "terminal": "POS-1",
  "status": "online",
  "print_count": 150,
  "last_ping": "2024-01-01T00:00:00.000Z",
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

## Error Handling

The Print Devices module includes built-in error handling for common scenarios:

- Invalid device IDs will throw appropriate errors
- Missing required fields during creation will throw validation errors
- All database operations are wrapped in try-catch blocks for proper error handling
- Bulk operations are handled atomically to ensure data consistency
- Status updates are validated against allowed values ('online', 'offline', 'warning')
- MAC address validations ensure proper format
- Print count validations ensure non-negative numbers

Example error handling in your code:

```ts
try {
  const device = await devices.store({
    name: 'Kitchen Printer 1',
    mac_address: '00:11:22:33:44:55',
    location: 'Kitchen',
    terminal: 'POS-1',
  })
} catch (error) {
  console.error('Failed to create print device:', error.message)
}
```

This documentation covers the basic operations available in the Print Devices module. Each function is type-safe and returns properly typed responses, making it easy to work with in TypeScript environments.
