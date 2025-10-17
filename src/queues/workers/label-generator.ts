import { Injectable } from '@nestjs/common';
import { QueuesService } from '../queues.service';
import { ShipmentsService } from '../../shipments/shipments.service';

@Injectable()
export class LabelGenerator {
  static QUEUE = 'label-generate';
  constructor(private readonly queues: QueuesService, private readonly shipments: ShipmentsService) {
    const worker = this.queues.createWorker(LabelGenerator.QUEUE, async (job) => {
      const { shipmentId, format } = job.data as { shipmentId: number; format?: string };
      const label = await this.shipments.createLabel({ shipmentId, format } as any);
      return { labelId: label.id };
    });
    // Worker events are already logged by QueuesService
  }

  async enqueue(shipmentId: number, format?: string) {
    await this.queues.add(LabelGenerator.QUEUE, { shipmentId, format });
  }
}
