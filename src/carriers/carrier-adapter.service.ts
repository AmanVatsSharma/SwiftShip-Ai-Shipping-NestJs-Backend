import { Injectable } from '@nestjs/common';
import { CarrierAdapter } from './adapter.interface';
import { SandboxCarrierAdapter } from './adapters/sandbox.adapter';
import { DelhiveryAdapter } from './adapters/delhivery.adapter';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CarrierAdapterService {
  private readonly adapters: Map<string, CarrierAdapter> = new Map();

  constructor(private readonly config: ConfigService) {
    const sandbox = new SandboxCarrierAdapter();
    this.adapters.set(sandbox.code, sandbox);
    const delhiveryToken = this.config.get<string>('DELHIVERY_TOKEN');
    if (delhiveryToken) {
      const delhivery = new DelhiveryAdapter(delhiveryToken);
      this.adapters.set(delhivery.code, delhivery);
    }
  }

  getAdapter(code: string): CarrierAdapter | undefined {
    return this.adapters.get(code);
  }
}
