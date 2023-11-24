# eCommerce Integrations Module

## Overview

The eCommerce Integrations module connects the SwiftShip AI platform with various eCommerce platforms, enabling seamless order management and data synchronization. Currently, it supports Shopify integration with a foundation for adding other platforms in the future.

## Features

- **Store Connection Management**:
  - Connect to Shopify stores via OAuth authentication
  - Validate and verify store credentials
  - View connected stores
  - Disconnect stores when no longer needed

- **Order Synchronization**:
  - Import orders from connected stores
  - Track order status changes
  - Map external order data to internal format

- **Product Management**:
  - Retrieve product information from connected stores
  - Enable product search and filtering

- **Extensible Architecture**:
  - Designed to easily add additional platform integrations (WooCommerce, Magento, etc.)
  - Common interfaces for cross-platform functionality

## Data Models

### ShopifyStore

Represents a connected Shopify store:

| Field | Type | Description |
|-------|------|-------------|
| id | String | Unique identifier for the store connection |
| shopDomain | String | The domain of the Shopify store (e.g., mystore.myshopify.com) |
| accessToken | String | OAuth access token for API authentication |
| connectedAt | DateTime | When the store was connected |
| updatedAt | DateTime | When the store was last updated |

### ShopifyOrder

Represents an order from a Shopify store:

| Field | Type | Description |
|-------|------|-------------|
| id | String | Unique identifier for the order |
| orderNumber | String | The order number from Shopify |
| total | Float | The total amount of the order |
| status | String | Current status of the order |
| storeId | String | ID of the related Shopify store |
| shopifyCreatedAt | DateTime? | When the order was created in Shopify |
| processedAt | DateTime? | When the order was processed in Shopify |
| currency | String? | Currency used for this order |
| customerEmail | String? | Email of the customer |
| customerName | String? | Name of the customer |
| createdAt | DateTime | When the order was created in our system |
| updatedAt | DateTime? | When the order was last updated in our system |

## Order Status Lifecycle

Shopify orders follow this status lifecycle:

- **PENDING**: Initial state when an order is created but not yet paid
- **PAID**: Order has been paid but not yet fulfilled
- **PARTIALLY_FULFILLED**: Some items have been fulfilled, but not all
- **FULFILLED**: All items have been fulfilled
- **CANCELLED**: Order has been cancelled
- **REFUNDED**: Order has been refunded

Status transitions adhere to business rules:
- Pending orders can be paid or cancelled
- Paid orders can be fulfilled, partially fulfilled, refunded, or cancelled
- Partially fulfilled orders can be fully fulfilled, refunded, or cancelled
- Fulfilled orders can only be refunded
- Cancelled or refunded orders cannot transition to any other status

## GraphQL API

### Queries

#### Get All Connected Stores
```graphql
query {
  shopifyStores {
    id
    shopDomain
    connectedAt
  }
}
```

#### Get Store by ID
```graphql
query {
  shopifyStore(id: "store-id") {
    id
    shopDomain
    connectedAt
  }
}
```

#### Get All Orders
```graphql
query {
  shopifyOrders {
    id
    orderNumber
    total
    status
    createdAt
  }
}
```

#### Get Orders by Store ID
```graphql
query {
  shopifyOrdersByStore(storeId: "store-id") {
    id
    orderNumber
    total
    status
    createdAt
  }
}
```

#### Get Products from Store
```graphql
query {
  shopifyProducts(storeId: "store-id") {
    # Response is dynamic based on Shopify API
    id
    title
    price
    # ... other fields
  }
}
```

### Mutations

#### Connect Shopify Store
```graphql
mutation {
  connectShopifyStore(
    connectStoreInput: {
      shopDomain: "mystore.myshopify.com"
      accessToken: "access-token"
    }
  ) {
    id
    shopDomain
    connectedAt
  }
}
```

#### Disconnect Shopify Store
```graphql
mutation {
  disconnectShopifyStore(id: "store-id") {
    id
    shopDomain
  }
}
```

#### Sync Shopify Orders
```graphql
mutation {
  syncShopifyOrders(storeId: "store-id")
}
```

#### Create Shopify Order (Manual)
```graphql
mutation {
  createShopifyOrder(
    createShopifyOrderInput: {
      orderNumber: "1001"
      total: 99.99
      status: PAID
      storeId: "store-id"
    }
  ) {
    id
    orderNumber
    status
  }
}
```

#### Update Shopify Order Status
```graphql
mutation {
  updateShopifyOrderStatus(
    id: "order-id"
    status: FULFILLED
  ) {
    id
    orderNumber
    status
  }
}
```

#### Delete Shopify Order
```graphql
mutation {
  deleteShopifyOrder(id: "order-id") {
    id
    orderNumber
  }
}
```

## Implementation Details

The eCommerce Integrations module is built using:

- **NestJS**: Providing the framework and GraphQL support
- **Prisma**: For database operations and ORM
- **GraphQL**: For API exposure
- **HttpService**: For external API communication
- **class-validator**: For input validation

The architecture follows a clear separation of concerns:
- **Models**: Define data structures
- **Inputs**: Define data transfer objects with validation
- **Services**: Implement business logic and external API communication
- **Resolvers**: Handle GraphQL queries and mutations

## Security Considerations

- Access tokens are stored securely and never exposed via the API
- API rate limiting is implemented to prevent abuse
- All API requests are validated before processing
- Store ownership verification is performed during connection
- OAuth flow is used for secure authentication with platforms

## Error Handling

The module handles various error scenarios:

- **Bad Request**: Invalid inputs, format errors, or business rule violations
- **Not Found**: Requested resources do not exist
- **Unauthorized**: Authentication or permission issues
- **External API Errors**: Issues with the eCommerce platform API

All errors are logged with appropriate context for troubleshooting.

## Business Rules

- Each store must have a unique domain
- Order numbers must be unique
- Status transitions must follow the defined lifecycle
- A store cannot be deleted if it has orders
- API credentials must be validated before storing

## Testing

The eCommerce Integrations module includes comprehensive unit tests to ensure reliability and correctness:

### Shopify Integration Tests

- **ShopifyIntegrationService Tests**: Cover all core functionality including:
  - Store connection and verification
  - Store retrieval and listing
  - Store disconnection with proper validation
  - Credentials verification
  - Error handling for all operations

- **ShopifyOrdersService Tests**: Cover order management functionality including:
  - Order creation with store validation
  - Order retrieval (all, by store, by ID)
  - Order status updates
  - Order deletion
  - Error handling for all operations

To run the tests:

```bash
# Run all eCommerce integration tests
npm test -- src/ecommerce-integrations

# Run specific service tests
npm test -- src/ecommerce-integrations/platforms/shopify/services/shopify-integration.service.spec.ts
npm test -- src/ecommerce-integrations/platforms/shopify/services/shopify-orders.service.spec.ts
```

### Test Coverage

The tests provide high coverage of the codebase, focusing on:

- **Functionality**: All public methods are tested
- **Error Handling**: All error paths are verified
- **Edge Cases**: Boundary conditions are tested
- **Integration**: Service interactions are verified

## Best Practices

The eCommerce Integrations module follows these best practices:

1. **Separation of Concerns**: Each platform has its own module with clear responsibilities
2. **Interface-Based Design**: Common interfaces ensure consistent behavior across platforms
3. **Factory Pattern**: Platform-specific implementations are created through a factory
4. **Dependency Injection**: Services are properly injected for testability
5. **Error Handling**: Comprehensive error handling with appropriate exception types
6. **Validation**: Input validation using class-validator
7. **Logging**: Detailed logging for troubleshooting
8. **Documentation**: Comprehensive documentation of APIs and functionality

## Future Enhancements

- **WooCommerce Integration**: Support for WooCommerce stores
- **Magento Integration**: Support for Magento 2.x stores
- **BigCommerce Integration**: Support for BigCommerce stores
- **Webhooks Support**: Real-time updates from platforms
- **Inventory Synchronization**: Two-way inventory management
- **Order Fulfillment**: Create shipments directly from orders
- **Analytics**: Sales data aggregation across platforms
- **Improved Test Coverage**: Add integration tests with mock API responses 