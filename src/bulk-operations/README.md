# Bulk Operations Module

## Overview

The Bulk Operations Module handles bulk processing for shipping operations, allowing users to process multiple shipments, orders, and pickups efficiently.

## Features

### 1. Bulk Label Generation ✅
- Generate labels for multiple shipments at once
- Support for PDF and ZPL formats
- Parallel processing for performance
- Error handling and reporting
- Batch processing (max 100 shipments per operation)

### 2. Bulk Pickup Scheduling ✅
- Schedule pickups for multiple shipments
- Single scheduled time for all pickups
- Validation and error handling
- Batch processing (max 50 shipments per operation)

### 3. Batch Order Processing ✅
- Process multiple orders simultaneously
- Create shipments for each order
- Optional auto-label generation
- Carrier assignment
- Sequential processing to avoid conflicts

### 4. Bulk Manifest Generation ✅
- Generate manifests for multiple shipments
- Link shipments to manifest
- Validation of all shipments

## GraphQL API

### Bulk Label Generation

```graphql
mutation {
  generateBulkLabels(input: {
    shipmentIds: [1, 2, 3, 4, 5]
    format: "PDF"
  }) {
    total
    successful
    failed
    successfulIds
    failedIds
    errors
    labelUrls
  }
}
```

### Bulk Pickup Scheduling

```graphql
mutation {
  scheduleBulkPickups(input: {
    shipmentIds: [1, 2, 3]
    scheduledAt: "2025-01-28T10:00:00Z"
  }) {
    total
    successful
    failed
    successfulIds
    failedIds
    errors
  }
}
```

### Batch Order Processing

```graphql
mutation {
  processBatchOrders(input: {
    orderIds: [1, 2, 3, 4, 5]
    carrierId: 1
    autoGenerateLabels: true
  }) {
    total
    successful
    failed
    successfulIds
    failedIds
    errors
  }
}
```

### Bulk Manifest Generation

```graphql
mutation {
  generateBulkManifest(shipmentIds: [1, 2, 3, 4, 5]) {
    manifestId
    manifestUrl
  }
}
```

## Implementation Details

### Performance Optimization

- **Parallel Processing**: Bulk operations use `Promise.allSettled()` for parallel execution
- **Batch Processing**: Operations are split into batches (10-50 items) to avoid overwhelming the system
- **Error Isolation**: Failures in one item don't stop the entire operation

### Error Handling

- Each operation tracks successes and failures separately
- Detailed error messages for each failed item
- Returns comprehensive results with IDs and errors

### Limits

- **Bulk Labels**: Maximum 100 shipments per operation
- **Bulk Pickups**: Maximum 50 shipments per operation
- **Batch Orders**: Maximum 100 orders per operation

## Flow Diagrams

### Bulk Label Generation Flow

```
1. Validate input (shipment IDs, format)
2. Split into batches (10 shipments per batch)
3. For each batch:
   a. Process in parallel
   b. Generate label for each shipment
   c. Track successes and failures
4. Aggregate results
5. Return comprehensive result
```

### Bulk Pickup Scheduling Flow

```
1. Validate input (shipment IDs, scheduled time)
2. Split into batches (10 shipments per batch)
3. For each batch:
   a. Verify shipment exists
   b. Schedule pickup in parallel
   c. Track successes and failures
4. Aggregate results
5. Return comprehensive result
```

## Response Format

All bulk operations return a `BulkOperationResult`:

```typescript
{
  total: number;           // Total items processed
  successful: number;      // Number of successful operations
  failed: number;          // Number of failed operations
  successfulIds?: number[]; // IDs of successful items
  failedIds?: number[];     // IDs of failed items
  errors?: string[];        // Error messages for failures
}
```

For bulk label generation, additional fields:
```typescript
{
  labelUrls?: string[];     // URLs of generated labels
  manifestUrl?: string;     // URL of generated manifest (if applicable)
}
```

## Best Practices

1. **Batch Size**: Keep batch sizes reasonable (10-50 items) for optimal performance
2. **Error Handling**: Always check the `failed` count and review `errors` array
3. **Retry Logic**: Implement retry logic for failed items
4. **Monitoring**: Monitor bulk operation performance and adjust batch sizes accordingly

## Future Enhancements

1. **Progress Tracking**: Real-time progress updates via WebSocket
2. **Scheduled Bulk Operations**: Schedule bulk operations for later execution
3. **Bulk Updates**: Update multiple shipments/orders at once
4. **Bulk Cancellation**: Cancel multiple shipments/orders
5. **Export Results**: Export bulk operation results to CSV/Excel

## Notes

- Bulk operations are designed for efficiency but should be used responsibly
- Large bulk operations may take time; consider implementing async processing
- Error messages provide detailed information for debugging failed items
