import { CarrierAdapter, CarrierLabelRequest, CarrierLabelResponse } from '../adapter.interface';

export class SandboxCarrierAdapter implements CarrierAdapter {
  code = 'SANDBOX';

  async generateLabel(req: CarrierLabelRequest): Promise<CarrierLabelResponse> {
    const labelNumber = `SANDBOX-${req.shipmentId}-${Date.now()}`;
    return {
      labelNumber,
      labelUrl: undefined,
      format: (req.format as any) ?? 'PDF',
      carrierCode: this.code,
      serviceName: 'Sandbox Ground',
    };
  }
}
