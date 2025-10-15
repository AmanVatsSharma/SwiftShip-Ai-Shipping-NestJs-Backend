import { CarrierAdapter, CarrierLabelRequest, CarrierLabelResponse } from '../adapter.interface';

export class XpressbeesAdapter implements CarrierAdapter {
  code = 'XPRESSBEES';
  constructor(private readonly token?: string, private readonly baseUrl: string = 'https://shipment.xpressbees.com') {}

  async generateLabel(req: CarrierLabelRequest): Promise<CarrierLabelResponse> {
    const labelNumber = `XBE-${req.shipmentId}-${Date.now()}`;
    return {
      labelNumber,
      labelUrl: undefined,
      format: (req.format as any) ?? 'PDF',
      carrierCode: this.code,
      serviceName: 'XB Standard',
    };
  }
}
