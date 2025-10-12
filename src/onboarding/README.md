# Onboarding (AOM) Module

This module tracks Account/Onboarding Milestones (AOM) and gates critical flows until required steps are complete.

## Milestones
- KYC submitted and approved
- Pickup address added and verified
- Carrier connected
- E-commerce platform connected
- Payments configured
- Test label generated
- First pickup scheduled

Status auto-computes to NOT_STARTED, IN_PROGRESS, BLOCKED (e.g., KYC pending), or COMPLETED. The `nextAction` gives guidance.

## GraphQL
Queries and mutations:
```graphql
query GetState($userId: Int!) { onboardingState(userId: $userId) { status nextAction blockedReason } }
mutation UpdateState($userId: Int!, $input: UpdateOnboardingInput!) { updateOnboardingState(userId: $userId, updateOnboardingInput: $input) { status nextAction } }
```

## Flowchart
```mermaid
flowchart TD
  A[Start] --> B{KYC Approved?}
  B -- No --> B1[BLOCKED: Await KYC]
  B -- Yes --> C{Pickup Address Added?}
  C -- No --> C1[Add Pickup Address]
  C -- Yes --> D{Pickup Verified?}
  D -- No --> D1[Verify Pickup]
  D -- Yes --> E{Carrier Connected?}
  E -- No --> E1[Connect Carrier]
  E -- Yes --> F{E-commerce Connected?}
  F -- No --> F1[Connect Store]
  F -- Yes --> G{Payments Configured?}
  G -- No --> G1[Configure Payments]
  G -- Yes --> H{Test Label Generated?}
  H -- No --> H1[Generate Test Label]
  H -- Yes --> I{First Pickup Scheduled?}
  I -- No --> I1[Schedule First Pickup]
  I -- Yes --> J[COMPLETED]
```

## Guard
`OnboardingGuard` blocks operations when status is BLOCKED. Inject and apply to resolvers as needed.
