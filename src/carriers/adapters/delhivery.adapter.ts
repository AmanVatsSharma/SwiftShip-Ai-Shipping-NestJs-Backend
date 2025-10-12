import { CarrierAdapter, CarrierLabelRequest, CarrierLabelResponse } from '../adapter.interface';

export class DelhiveryAdapter implements CarrierAdapter {
  code = 'DELHIVERY';
  private readonly token: string;
  private readonly baseUrl: string;

  constructor(token: string, baseUrl = 'https://track.delhivery.com') {
    this.token = token;
    this.baseUrl = baseUrl;
  }

  async generateLabel(req: CarrierLabelRequest): Promise<CarrierLabelResponse> {
    // Placeholder implementation: integrate Delhivery label API here.
    // We return a safe fallback while wiring the adapter end-to-end.
    const labelNumber = `DLV-${req.shipmentId}-${Date.now()}`;
    return {
      labelNumber,
      labelUrl: undefined, // set to carrier URL once integrated
      format: (req.format as any) ?? 'PDF',
      carrierCode: this.code,
      serviceName: 'Delhivery Surface',
    };
  }
}
