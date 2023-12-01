# Returns Module

## Overview

The Returns Module is a crucial component of the SwiftShip AI platform that manages product returns and reverse logistics. It provides comprehensive functionality for creating, tracking, approving, and managing returns throughout their lifecycle.

## Features

- **Create Return**: Register a new return request with reason and order information
- **Track Return**: Retrieve return information and current status
- **Update Return Status**: Update return status as it progresses through the returns workflow
- **Filter Returns**: Search for returns by status or order
- **Delete Return**: Remove returns (with appropriate restrictions)
- **Analytics**: Count returns by status for dashboard reporting

## Data Model

A Return entity consists of:

| Field | Type | Description |
|-------|------|-------------|
| id | Integer | Unique identifier for the return |
| returnNumber | String | Unique number identifying the return |
| status | Enum | Current status (REQUESTED, APPROVED, REJECTED, COMPLETED, CANCELLED) |
| reason | String | Customer's reason for the return |
| pickupScheduledAt | DateTime | When the return pickup is scheduled (nullable) |
| orderId | Integer | ID of the associated order |
| createdAt | DateTime | When the return record was created |
| updatedAt | DateTime | When the return record was last updated |

## Return Status Lifecycle

The return status follows a specific progression with rules for transitions:

1. **REQUESTED**: Customer has requested a return (initial status)
2. **APPROVED**: Merchant has approved the return request
3. **REJECTED**: Merchant has rejected the return request
4. **COMPLETED**: Return has been received and processed
5. **CANCELLED**: Return request has been cancelled

The module enforces specific status transition rules:
- New returns must have status REQUESTED
- COMPLETED returns cannot be updated
- CANCELLED returns cannot be updated
- REJECTED returns can only be changed to CANCELLED
- REQUESTED returns can transition to any status except COMPLETED
- APPROVED returns can only transition to COMPLETED or CANCELLED

## GraphQL API

### Queries

#### Get All Returns
```graphql
query {
  returns {
    id
    returnNumber
    status
    reason
    pickupScheduledAt
    orderId
    createdAt
    updatedAt
  }
}
```

#### Get Return by ID
```graphql
query {
  return(id: 1) {
    id
    returnNumber
    status
    reason
    pickupScheduledAt
    orderId
  }
}
```

#### Filter Returns
```graphql
query {
  filterReturns(returnsFilterInput: {
    status: APPROVED,
    orderId: 1
  }) {
    id
    returnNumber
    status
    reason
    pickupScheduledAt
  }
}
```

#### Get Returns by Status
```graphql
query {
  returnsByStatus(status: REQUESTED) {
    id
    returnNumber
    reason
    orderId
    pickupScheduledAt
  }
}
```

#### Get Returns by Order
```graphql
query {
  returnsByOrder(orderId: 1) {
    id
    returnNumber
    status
    reason
    pickupScheduledAt
  }
}
```

#### Get Return Counts by Status
```graphql
query {
  returnCountsByStatus
}
```
Returns: `{"REQUESTED":5,"APPROVED":3,"REJECTED":2,"COMPLETED":10,"CANCELLED":0}`

### Mutations

#### Create Return
```graphql
mutation {
  createReturn(createReturnInput: {
    returnNumber: "RET123456"
    status: REQUESTED
    reason: "Item damaged"
    orderId: 1
  }) {
    id
    returnNumber
    status
    createdAt
  }
}
```

#### Update Return
```graphql
mutation {
  updateReturn(updateReturnInput: {
    id: 1
    status: APPROVED
    pickupScheduledAt: "2023-08-15T10:00:00Z"
  }) {
    id
    returnNumber
    status
    pickupScheduledAt
    updatedAt
  }
}
```

#### Delete Return
```graphql
mutation {
  deleteReturn(id: 1) {
    id
    returnNumber
    status
  }
}
```

## Implementation Details

The Returns module follows a clean architecture approach:

- **Model**: Defines the GraphQL and database schema for returns
- **Service**: Implements business logic and interacts with the database via Prisma
- **Resolver**: Handles GraphQL requests and delegates to the service layer

## Business Rules

The module enforces several business rules to maintain data integrity:

1. **Status Validation**: New returns must have status REQUESTED
2. **Status Transition Rules**: Only specific status transitions are allowed based on current status
3. **Deletion Restriction**: Cannot delete returns that are already COMPLETED or APPROVED
4. **Order Validation**: Returns must be associated with a valid order
5. **Return Number Uniqueness**: Return numbers must be unique across the system

## Error Handling

The module handles several error cases:

- **Not Found**: When a return or order with the specified ID doesn't exist
- **Conflict**: When trying to create a return with a number that already exists
- **Bad Request**: For invalid status transitions or operations not allowed (e.g., deleting a completed return)

## Testing

Unit tests cover all service methods and error scenarios. To run the tests:

```bash
npm run test src/returns
```

## Future Enhancements

- Integration with shipping providers for return label generation
- Automatic refund processing when a return is completed
- Email notifications at each status change
- Return policy enforcement based on product type and time since purchase
- QR code generation for easy return tracking
- Return reason analytics for product quality improvement 