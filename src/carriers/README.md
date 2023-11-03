# Carriers Module

## Overview

The Carriers Module manages shipping carrier integrations within the SwiftShip AI platform. It provides CRUD operations for carrier entities, which represent shipping services like FedEx, UPS, DHL, etc.

## Features

- **Create Carrier**: Register a new shipping carrier with name and API key
- **List Carriers**: Retrieve all available shipping carriers
- **Get Carrier**: Fetch a specific carrier by ID
- **Update Carrier**: Modify carrier information
- **Delete Carrier**: Remove a carrier from the system

## Data Model

A Carrier entity consists of:

| Field | Type | Description |
|-------|------|-------------|
| id | Integer | Unique identifier for the carrier |
| name | String | Name of the shipping carrier (e.g., "FedEx", "UPS") |
| apiKey | String | API key for carrier service integration |
| createdAt | DateTime | When the carrier was added to the system |
| updatedAt | DateTime | When the carrier was last updated |

## GraphQL API

### Queries

#### Get All Carriers
```graphql
query {
  carriers {
    id
    name
    apiKey
    createdAt
    updatedAt
  }
}
```

#### Get Carrier by ID
```graphql
query {
  carrier(id: 1) {
    id
    name
    apiKey
    createdAt
    updatedAt
  }
}
```

### Mutations

#### Create Carrier
```graphql
mutation {
  createCarrier(createCarrierInput: {
    name: "FedEx"
    apiKey: "your-fedex-api-key"
  }) {
    id
    name
    createdAt
  }
}
```

#### Update Carrier
```graphql
mutation {
  updateCarrier(updateCarrierInput: {
    id: 1
    name: "FedEx Express"
  }) {
    id
    name
    updatedAt
  }
}
```

#### Delete Carrier
```graphql
mutation {
  deleteCarrier(id: 1) {
    id
    name
  }
}
```

## Implementation Details

The Carriers module follows a clean architecture approach:

- **Model**: Defines the GraphQL and database schema for carriers
- **Service**: Implements business logic and interacts with the database via Prisma
- **Resolver**: Handles GraphQL requests and delegates to the service layer

## Error Handling

The module handles several error cases:

- **Not Found**: When a carrier with the specified ID doesn't exist
- **Conflict**: When trying to create a carrier with a name that already exists
- **Foreign Key Conflict**: When trying to delete a carrier that is referenced by other entities

## Testing

Unit tests cover all service methods and error scenarios. To run the tests:

```bash
npm run test src/carriers
```

## Future Enhancements

- Integration with real carrier APIs for validation
- Support for carrier-specific configuration options
- Carrier rate caching and optimization
- Multi-region carrier support 