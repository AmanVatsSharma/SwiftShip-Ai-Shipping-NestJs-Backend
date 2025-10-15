import { Injectable } from '@nestjs/common';
import { QueuesService } from '../queues.service';
import { ShipmentsService } from '../../shipments/shipments.service';

@Injectable()
export class LabelGenerator {
  static QUEUE = 'label-generate';
  constructor(private readonly queues: QueuesService, private readonly shipments: ShipmentsService) {
    this.queues.createWorker(LabelGenerator.QUEUE, async (job) => {
      const { shipmentId, format } = job.data as { shipmentId: number; format?: string };
      await this.shipments.createLabel({ shipmentId, format } as any);
    });
  }

  async enqueue(shipmentId: number, format?: string) {
    await this.queues.add(LabelGenerator.QUEUE, { shipmentId, format });
  }
}
