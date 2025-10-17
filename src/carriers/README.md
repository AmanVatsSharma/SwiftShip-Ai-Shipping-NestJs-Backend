# Carrier Adapter Pattern

We use a simple adapter pattern to support multiple carriers behind a unified API.

- `CarrierAdapterService`: registry for adapters
- `SandboxCarrierAdapter`: default test adapter (code: SANDBOX)
- Add real adapters (e.g., `DelhiveryAdapter`, `XpressbeesAdapter`) implementing `CarrierAdapter`

## Flow
```mermaid
sequenceDiagram
  participant API as GraphQL API
  participant Svc as ShipmentsService
  participant Reg as CarrierAdapterService
  participant Carr as Carrier Adapter
  participant DB as Prisma

  API->>Svc: createShippingLabel(shipmentId)
  Svc->>DB: Load Shipment + Carrier
  Svc->>Reg: getAdapter(carrier.name)
  Reg-->>Svc: Adapter instance
  Svc->>Carr: generateLabel(request)
  Carr-->>Svc: label info (number, url)
  Svc->>DB: Save ShippingLabel
  Svc-->>API: ShippingLabel
  Svc-->>WS: Emit labelCreated
```

## Tracking Webhooks
- Expose REST endpoints per carrier to receive tracking updates
- Map payloads to `TrackingEvent`
- Auto-advance `Shipment.status`
- Emit `trackingEvent`
