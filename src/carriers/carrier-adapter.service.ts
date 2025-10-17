import { Injectable } from '@nestjs/common';
import { CarrierAdapter } from './adapter.interface';
import { SandboxCarrierAdapter } from './adapters/sandbox.adapter';
import { DelhiveryAdapter } from './adapters/delhivery.adapter';
import { ConfigService } from '@nestjs/config';
import { XpressbeesAdapter } from './adapters/xpressbees.adapter';

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
    const xpressbeesToken = this.config.get<string>('XPRESSBEES_TOKEN');
    const xpressbees = new XpressbeesAdapter(xpressbeesToken);
    this.adapters.set(xpressbees.code, xpressbees);
  }

  getAdapter(code: string): CarrierAdapter | undefined {
    return this.adapters.get(code);
  }
}
