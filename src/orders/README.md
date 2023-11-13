# Orders Module

## Overview

The Orders Module is a core component of the SwiftShip AI platform that manages customer orders throughout their lifecycle. It serves as the central hub connecting users, shipments, returns, and carriers, providing comprehensive functionality for creating, managing, and analyzing orders.

## Features

- **Create Order**: Register a new order with details like order number, total, and user
- **Update Order**: Modify order status and other details
- **Filter Orders**: Search for orders by status, user, carrier, or order number
- **Delete Order**: Remove orders with appropriate restrictions
- **Order Status Management**: Track order status changes with business rules
- **Analytics**: Count orders by status and calculate total sales
- **User Orders**: Retrieve a user's order history
- **Related Entities**: Access an order's shipments and returns

## Data Model

An Order entity consists of:

| Field | Type | Description |
|-------|------|-------------|
| id | Integer | Unique identifier for the order |
| orderNumber | String | Unique number identifying the order |
| total | Float | Total amount of the order |
| status | Enum | Current status (PENDING, PAID, CANCELLED, REFUNDED) |
| userId | Integer | ID of the user who placed the order |
| carrierId | Integer | ID of the preferred carrier (nullable) |
| createdAt | DateTime | When the order was created |
| updatedAt | DateTime | When the order was last updated |

## Order Status Lifecycle

The order status follows a progression with specific rules for transitions:

1. **PENDING**: Initial status for new orders (default if not specified)
2. **PAID**: Order has been paid for and is ready for shipment
3. **CANCELLED**: Order has been cancelled
4. **REFUNDED**: Payment has been refunded to the customer

Status transition rules:
- CANCELLED orders cannot be changed to any other status
- REFUNDED orders cannot be changed to any other status

## GraphQL API

### Queries

#### Get All Orders
```graphql
query {
  orders {
    id
    orderNumber
    total
    status
    userId
    carrierId
    createdAt
    updatedAt
  }
}
```

#### Get Order by ID
```graphql
query {
  order(id: 1) {
    id
    orderNumber
    total
    status
    userId
    carrierId
    createdAt
    updatedAt
  }
}
```

#### Filter Orders
```graphql
query {
  filterOrders(ordersFilterInput: {
    status: PAID,
    userId: 1
  }) {
    id
    orderNumber
    total
    status
  }
}
```

#### Get Orders by User
```graphql
query {
  ordersByUser(userId: 1) {
    id
    orderNumber
    total
    status
    createdAt
  }
}
```

#### Get Orders by Status
```graphql
query {
  ordersByStatus(status: PENDING) {
    id
    orderNumber
    total
    userId
    createdAt
  }
}
```

#### Get Order Counts by Status
```graphql
query {
  orderCountsByStatus
}
```
Returns: `{"PENDING":5,"PAID":10,"CANCELLED":2,"REFUNDED":1}`

#### Get Total Sales
```graphql
query {
  totalSales
}
```
Returns: `4995.50`

### Mutations

#### Create Order
```graphql
mutation {
  createOrder(createOrderInput: {
    orderNumber: "ORD123456"
    total: 99.99
    userId: 1
    status: PENDING
  }) {
    id
    orderNumber
    total
    status
    createdAt
  }
}
```

#### Update Order
```graphql
mutation {
  updateOrder(updateOrderInput: {
    id: 1
    status: PAID
  }) {
    id
    orderNumber
    status
    updatedAt
  }
}
```

#### Delete Order
```graphql
mutation {
  deleteOrder(id: 1) {
    id
    orderNumber
    status
  }
}
```

## Implementation Details

The Orders module follows a clean architecture approach:

- **Model**: Defines the GraphQL and database schema for orders
- **Service**: Implements business logic and interacts with the database via Prisma
- **Resolver**: Handles GraphQL requests and delegates to the service layer

## Business Rules

The module enforces several business rules to maintain data integrity:

1. **User Validation**: Orders must be associated with a valid user
2. **Carrier Validation**: If a carrier is specified, it must exist in the system
3. **Status Transition Rules**: Only specific status transitions are allowed
4. **Deletion Restrictions**: Cannot delete orders that:
   - Have associated shipments
   - Have associated returns
   - Are in PAID status
5. **Order Number Uniqueness**: Order numbers must be unique across the system

## Relationships

The Orders module has relationships with several other entities:

- **User**: Each order belongs to a user
- **Carrier**: Orders may be associated with a preferred carrier
- **Shipment**: Orders can have multiple shipments
- **Return**: Orders can have multiple returns

## Error Handling

The module handles several error cases:

- **Not Found**: When an order, user, or carrier with the specified ID doesn't exist
- **Conflict**: When trying to create an order with a number that already exists
- **Bad Request**: For invalid status transitions or operations not allowed (e.g., deleting a paid order)

## Testing

Unit tests cover all service methods and error scenarios. To run the tests:

```bash
npm run test src/orders
```

## Future Enhancements

- Order items management (products, quantities, prices)
- Automatic order status updates based on shipment status
- Discount code application
- Tax calculation
- Currency conversion for international orders
- Order splitting for multi-carrier shipping
- Real-time order tracking portal
- Recurring orders and subscriptions 