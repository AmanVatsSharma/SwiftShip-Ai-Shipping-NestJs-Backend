# Shipments Module

## Overview

The Shipments Module is a core component of the SwiftShip AI platform that manages the shipping logistics process. It provides comprehensive functionality for creating, tracking, updating, and monitoring shipments throughout their lifecycle.

## Features

- **Create Shipment**: Register a new shipment with tracking information, carrier, and order details
- **Track Shipment**: Retrieve shipment information and current status
- **Update Shipment Status**: Update shipment status as it progresses (e.g., pending → shipped → in transit → delivered)
- **Filter Shipments**: Search for shipments by status, order, or carrier
- **Delete Shipment**: Remove shipments (with appropriate restrictions)
- **Real-time Updates**: WebSocket integration for real-time shipment status notifications
- **Analytics**: Count shipments by status for dashboard reporting

## Data Model

A Shipment entity consists of:

| Field | Type | Description |
|-------|------|-------------|
| id | Integer | Unique identifier for the shipment |
| trackingNumber | String | Carrier-issued tracking number |
| status | Enum | Current status (PENDING, SHIPPED, IN_TRANSIT, DELIVERED, CANCELLED) |
| orderId | Integer | ID of the associated order |
| carrierId | Integer | ID of the carrier handling the shipment |
| shippedAt | DateTime | When the shipment was picked up by the carrier (nullable) |
| deliveredAt | DateTime | When the shipment was delivered (nullable) |
| createdAt | DateTime | When the shipment record was created |
| updatedAt | DateTime | When the shipment record was last updated |

## Shipment Status Lifecycle

The shipment status follows a natural progression:

1. **PENDING**: Shipment created but not yet picked up by carrier
2. **SHIPPED**: Carrier has picked up the shipment
3. **IN_TRANSIT**: Shipment is in transit to destination
4. **DELIVERED**: Shipment has been delivered
5. **CANCELLED**: Shipment has been cancelled

The module includes smart business logic to ensure status transitions make sense (e.g., can't move from DELIVERED to PENDING).

## GraphQL API

### Queries

#### Get All Shipments
```graphql
query {
  shipments {
    id
    trackingNumber
    status
    orderId
    carrierId
    shippedAt
    deliveredAt
    createdAt
    updatedAt
  }
}
```

#### Get Shipment by ID
```graphql
query {
  shipment(id: 1) {
    id
    trackingNumber
    status
    orderId
    carrierId
    shippedAt
    deliveredAt
  }
}
```

#### Filter Shipments
```graphql
query {
  filterShipments(shipmentsFilterInput: {
    status: SHIPPED,
    carrierId: 1
  }) {
    id
    trackingNumber
    status
    orderId
    carrierId
  }
}
```

#### Get Shipments by Status
```graphql
query {
  shipmentsByStatus(status: IN_TRANSIT) {
    id
    trackingNumber
    orderId
    carrierId
    shippedAt
  }
}
```

#### Get Shipments by Order
```graphql
query {
  shipmentsByOrder(orderId: 1) {
    id
    trackingNumber
    status
    carrierId
    shippedAt
    deliveredAt
  }
}
```

#### Get Shipment Counts by Status
```graphql
query {
  shipmentCountsByStatus
}
```
Returns: `{"PENDING":5,"SHIPPED":3,"IN_TRANSIT":2,"DELIVERED":10,"CANCELLED":0}`

### Mutations

#### Create Shipment
```graphql
mutation {
  createShipment(createShipmentInput: {
    trackingNumber: "TRK123456"
    status: PENDING
    orderId: 1
    carrierId: 1
  }) {
    id
    trackingNumber
    status
    createdAt
  }
}
```

#### Update Shipment
```graphql
mutation {
  updateShipment(updateShipmentInput: {
    id: 1
    status: SHIPPED
  }) {
    id
    trackingNumber
    status
    shippedAt
    updatedAt
  }
}
```

#### Delete Shipment
```graphql
mutation {
  deleteShipment(id: 1) {
    id
    trackingNumber
    status
  }
}
```

## Real-time Updates

The Shipments module includes a WebSocket gateway for real-time shipment updates. When a shipment is updated, clients subscribed to the `shipmentUpdate` event will receive the updated shipment data:

```javascript
// Client-side
const socket = io('http://localhost:3000');
socket.on('shipmentUpdate', (updatedShipment) => {
  console.log('Shipment updated:', updatedShipment);
  // Update UI with new shipment information
});
```

## Implementation Details

The Shipments module follows a clean architecture approach:

- **Model**: Defines the GraphQL and database schema for shipments
- **Service**: Implements business logic and interacts with the database via Prisma
- **Resolver**: Handles GraphQL requests and delegates to the service layer
- **Gateway**: Manages WebSocket connections for real-time updates

## Business Rules

The module enforces several business rules to maintain data integrity:

1. **Status Validation**: If `shippedAt` is set, status must be SHIPPED or later
2. **Delivery Validation**: If `deliveredAt` is set, status must be DELIVERED
3. **Auto Date Setting**: When marking a shipment as SHIPPED, it automatically sets `shippedAt` to current time if not provided
4. **Auto Date Setting**: When marking a shipment as DELIVERED, it automatically sets `deliveredAt` to current time if not provided
5. **Deletion Restriction**: Cannot delete shipments that have been delivered
6. **Status Transition Validation**: Cannot change a shipment with `shippedAt` back to PENDING

## Error Handling

The module handles several error cases:

- **Not Found**: When a shipment, order, or carrier with the specified ID doesn't exist
- **Conflict**: When trying to create a shipment with a tracking number that already exists
- **Bad Request**: For invalid status transitions or operations not allowed (e.g., deleting a delivered shipment)

## Testing

Unit tests cover all service methods and error scenarios. To run the tests:

```bash
npm run test src/shipments
```

## Future Enhancements

- Integration with carrier APIs for automatic status updates
- Geolocation tracking for shipments
- Estimated delivery time predictions using machine learning
- Batch shipment creation
- Customs documentation generation for international shipments
- Advanced analytics and reporting on shipping performance 