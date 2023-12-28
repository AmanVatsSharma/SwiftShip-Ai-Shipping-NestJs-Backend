# Users Module

## Overview

The Users module provides core functionality for managing users within the SwiftShip AI platform. It supports creating, retrieving, updating, and deleting user profiles, which are essential for authentication, order management, and other personalized services.

## Features

- **User Management**:
  - Create new user accounts (with optional role assignment)
  - Retrieve user profiles (including roles)
  - Update user information and roles
  - Delete user accounts

- **Role Assignment**:
  - Assign roles to users during creation or update
  - List user roles in all user queries

- **Data Validation**:
  - Email format validation
  - Name length validation
  - Required field validation
  - Duplicate email prevention

- **Error Handling**:
  - Clear error messages for validation failures
  - Proper error types for different scenarios
  - Comprehensive exception handling

## Data Model

A User entity consists of:

| Field | Type | Description |
|-------|------|-------------|
| id | Integer | Unique identifier for the user |
| email | String | User's email address (unique) |
| name | String | User's name (optional) |
| createdAt | DateTime | When the user account was created |
| updatedAt | DateTime | When the user account was last updated |
| roles | [Role] | List of roles assigned to the user |

## GraphQL API

### Queries

#### Get All Users
```graphql
query {
  users {
    id
    email
    name
    createdAt
    updatedAt
    roles {
      id
      name
      description
    }
  }
}
```

#### Get User by ID
```graphql
query {
  user(id: 1) {
    id
    email
    name
    createdAt
    updatedAt
    roles {
      id
      name
      description
    }
  }
}
```

### Mutations

#### Create User (with roles)
```graphql
mutation {
  createUser(createUserInput: {
    email: "user@example.com"
    name: "John Doe"
    roleIds: [1, 2]
  }) {
    id
    email
    name
    createdAt
    roles {
      id
      name
    }
  }
}
```

#### Update User (roles)
```graphql
mutation {
  updateUser(updateUserInput: {
    id: 1
    name: "Jane Doe"
    email: "jane@example.com"
    roleIds: [2]
  }) {
    id
    email
    name
    updatedAt
    roles {
      id
      name
    }
  }
}
```

#### Delete User
```graphql
mutation {
  removeUser(id: 1) {
    id
    email
    name
    roles {
      id
      name
    }
  }
}
```

## Implementation Details

The Users module follows a clean architecture approach:

- **Entity**: Defines the GraphQL and database schema for users (now includes roles)
- **DTOs**: Define the input structures for creating and updating users (now support roleIds)
- **Service**: Implements business logic and interacts with the database via Prisma (handles role assignment)
- **Resolver**: Handles GraphQL requests and delegates to the service layer

## Business Rules

The module enforces several business rules to maintain data integrity:

1. **Email Uniqueness**: Each user must have a unique email address
2. **Required Fields**: Email is required for user creation
3. **Data Validation**: Email must be in a valid format
4. **Name Validation**: Name must be between 2 and 100 characters (if provided)
5. **Role Assignment**: Only valid role IDs can be assigned to users

## Error Handling

The module handles various error scenarios:

- **Not Found**: When a user with the specified ID doesn't exist
- **Conflict**: When trying to create a user with an email that already exists
- **Bad Request**: For validation failures (invalid email format, etc.)
- **Internal Server Error**: For unexpected database or system errors

All errors are properly typed and include descriptive messages to aid in troubleshooting.

## Testing

The Users module includes comprehensive unit tests covering:

- **Service Tests**: Test all service methods and error scenarios
- **Resolver Tests**: Test all resolver methods with mock service responses

To run the tests:

```bash
# Run all Users module tests
npm test -- src/users

# Run specific test files
npm test -- src/users/users.service.spec.ts
npm test -- src/users/users.resolver.spec.ts
```

### Test Coverage

The tests provide thorough coverage of the codebase, focusing on:

- **Core Functionality**: All public methods are tested
- **Error Handling**: All error paths are verified
- **Edge Cases**: Boundary conditions are tested
- **Business Rules**: All business rules are validated

## Integration with other Modules

The Users module is integrated with:

- **Orders Module**: Users can have multiple orders
- **Roles Module**: Users can have multiple roles (RBAC)

## Future Enhancements

- **Role-based Authorization**: Add role management for users
- **Profile Expansion**: Additional user profile fields (address, phone, etc.)
- **Password Management**: Secure password storage and reset functionality
- **Account Verification**: Email verification for new accounts
- **Social Auth Integration**: Login via Google, Facebook, etc.
- **User Preferences**: Save and manage user preferences
- **Activity Logging**: Track user activity for security and analytics

## Role Management & Assignment

- Users can be assigned one or more roles for RBAC (Role-Based Access Control).
- Roles can be managed via the Roles module (see `src/users/roles.*`).
- Assign roles to users during creation or update using the `roleIds` field.
- All user queries return the user's roles.

See the **Roles Module** documentation for more details on role creation, update, and deletion. 