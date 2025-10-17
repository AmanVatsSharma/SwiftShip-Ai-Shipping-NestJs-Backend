export interface CarrierLabelRequest {
  shipmentId: number;
  trackingNumber: string;
  format?: 'PDF' | 'ZPL';
}

export interface CarrierLabelResponse {
  labelNumber: string;
  labelUrl?: string;
  format: 'PDF' | 'ZPL';
  carrierCode: string;
  serviceName?: string;
}

export interface CarrierAdapter {
  code: string;
  generateLabel(req: CarrierLabelRequest): Promise<CarrierLabelResponse>;
}
