# Labels and Tracking

This module now supports:
- Generating a shipping label for a shipment (stubbed deterministic label number)
- Ingesting tracking events and auto-advancing shipment status
- Real-time events via WebSocket: `labelCreated`, `trackingEvent`, `shipmentUpdate`

Carrier adapter pattern added with a `SANDBOX` adapter; replace with real carrier implementations.

## GraphQL examples
```graphql
mutation CreateLabel { createShippingLabel(createLabelInput: { shipmentId: 1, format: "PDF" }) { id labelNumber status } }

mutation Track {
  ingestTrackingEvent(ingestTrackingInput: {
    shipmentId: 1,
    trackingNumber: "TRK123",
    status: "In Transit",
    description: "Arrived at facility",
    occurredAt: "2025-01-01T12:00:00.000Z"
  }) { id status occurredAt }
}
```

## Notes
- Replace label generation with actual carrier APIs and store `labelUrl`.
- Consider idempotency keys for tracking ingestion.
- Expand `computeNextStatus` mapping per carrier semantics.
