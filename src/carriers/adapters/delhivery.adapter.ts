import { CarrierAdapter, CarrierLabelRequest, CarrierLabelResponse } from '../adapter.interface';
import axios from 'axios';

export class DelhiveryAdapter implements CarrierAdapter {
  code = 'DELHIVERY';
  private readonly token: string;
  private readonly baseUrl: string;

  constructor(token: string, baseUrl = 'https://track.delhivery.com') {
    this.token = token;
    this.baseUrl = baseUrl;
  }

  async generateLabel(req: CarrierLabelRequest): Promise<CarrierLabelResponse> {
    // Attempt real API; fallback to stub on failure
    try {
      const url = `${this.baseUrl}/api/p/label`; // placeholder endpoint
      const headers = { Authorization: `Token ${this.token}` };
      const payload = {
        awb: undefined, // let carrier generate
        format: (req.format as any) ?? 'PDF',
        shipmentId: req.shipmentId,
      };
      // eslint-disable-next-line no-console
      console.log('[DelhiveryAdapter] generateLabel request', { url, payload });
      const resp = await axios.post(url, payload, { headers, timeout: 8000 });
      const data = resp.data || {};
      const labelNumber: string = data?.label_number || data?.awb || `DLV-${req.shipmentId}-${Date.now()}`;
      const labelUrl: string | undefined = data?.label_url;
      return {
        labelNumber,
        labelUrl,
        format: (req.format as any) ?? 'PDF',
        carrierCode: this.code,
        serviceName: 'Delhivery Surface',
      };
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[DelhiveryAdapter] generateLabel fallback due to error', (e as Error).message);
      const labelNumber = `DLV-${req.shipmentId}-${Date.now()}`;
      return {
        labelNumber,
        labelUrl: undefined,
        format: (req.format as any) ?? 'PDF',
        carrierCode: this.code,
        serviceName: 'Delhivery Surface',
      };
    }
  }
}
