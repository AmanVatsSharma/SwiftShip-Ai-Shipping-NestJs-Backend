# Shipping Rates Module

## Overview

The Shipping Rates Module manages shipping rate information within the SwiftShip AI platform. It provides robust functionality for creating, retrieving, updating, and comparing shipping rates across different carriers.

## Features

- **Create Shipping Rate**: Register a new shipping rate with carrier, service type, cost, and estimated delivery time
- **List Shipping Rates**: Retrieve all available shipping rates
- **Get Shipping Rate**: Fetch a specific rate by ID
- **Get Rates by Carrier**: Retrieve all rates for a specific carrier
- **Update Shipping Rate**: Modify rate information
- **Delete Shipping Rate**: Remove a rate from the system
- **Compare Rates**: Find the cheapest, fastest, or best value shipping option

## Data Model

A ShippingRate entity consists of:

| Field | Type | Description |
|-------|------|-------------|
| id | Integer | Unique identifier for the shipping rate |
| carrierId | Integer | ID of the carrier providing this shipping service |
| serviceName | String | Name of the shipping service (e.g., "Express", "Ground") |
| rate | Float | Cost of the shipping service |
| estimatedDeliveryDays | Integer | Estimated number of days for delivery |
| createdAt | DateTime | When the shipping rate was added to the system |
| updatedAt | DateTime | When the shipping rate was last updated |

## GraphQL API

### Queries

#### Get All Shipping Rates
```graphql
query {
  shippingRates {
    id
    carrierId
    serviceName
    rate
    estimatedDeliveryDays
    createdAt
    updatedAt
  }
}
```

#### Get Shipping Rate by ID
```graphql
query {
  shippingRate(id: 1) {
    id
    carrierId
    serviceName
    rate
    estimatedDeliveryDays
  }
}
```

#### Get Shipping Rates by Carrier
```graphql
query {
  shippingRatesByCarrier(carrierId: 1) {
    id
    serviceName
    rate
    estimatedDeliveryDays
  }
}
```

#### Get Cheapest Shipping Rate
```graphql
query {
  cheapestShippingRate {
    id
    carrierId
    serviceName
    rate
    estimatedDeliveryDays
  }
}
```

#### Get Fastest Shipping Rate
```graphql
query {
  fastestShippingRate {
    id
    carrierId
    serviceName
    rate
    estimatedDeliveryDays
  }
}
```

#### Get Best Value Shipping Rate
```graphql
query {
  bestValueShippingRate {
    id
    carrierId
    serviceName
    rate
    estimatedDeliveryDays
  }
}
```

### Mutations

#### Create Shipping Rate
```graphql
mutation {
  createShippingRate(createShippingRateInput: {
    carrierId: 1
    serviceName: "Express"
    rate: 15.99
    estimatedDeliveryDays: 2
  }) {
    id
    carrierId
    serviceName
    rate
    estimatedDeliveryDays
  }
}
```

#### Update Shipping Rate
```graphql
mutation {
  updateShippingRate(updateShippingRateInput: {
    id: 1
    rate: 12.99
    estimatedDeliveryDays: 3
  }) {
    id
    carrierId
    serviceName
    rate
    estimatedDeliveryDays
  }
}
```

#### Delete Shipping Rate
```graphql
mutation {
  deleteShippingRate(id: 1) {
    id
    serviceName
  }
}
```

## Implementation Details

The Shipping Rates module follows a clean architecture approach:

- **Model**: Defines the GraphQL and database schema for shipping rates
- **Service**: Implements business logic and interacts with the database via Prisma
- **Resolver**: Handles GraphQL requests and delegates to the service layer

## Smart Rate Selection

The module includes built-in intelligence for shipping rate optimization:

- **Cheapest Rate**: Find the most economical shipping option
- **Fastest Rate**: Find the shipping option with the shortest delivery time
- **Best Value Rate**: Find the optimal balance between cost and delivery time

## Error Handling

The module handles several error cases:

- **Not Found**: When a shipping rate or carrier with the specified ID doesn't exist
- **Conflict**: When trying to create a shipping rate with a name that already exists for a carrier
- **Bad Request**: When trying to create or update a shipping rate with an invalid carrier ID

## Testing

Unit tests cover all service methods and error scenarios. To run the tests:

```bash
npm run test src/shipping-rates
```

## Future Enhancements

- Dynamic rate calculation based on package dimensions and weight
- Zone-based shipping rate calculations
- Time-of-day and day-of-week rate variations
- Volume-based shipping discounts
- Real-time rate updates from carrier APIs 