import { Injectable } from '@nestjs/common';
import { CarrierAdapter } from './adapter.interface';
import { SandboxCarrierAdapter } from './adapters/sandbox.adapter';

@Injectable()
export class CarrierAdapterService {
  private readonly adapters: Map<string, CarrierAdapter> = new Map();

  constructor() {
    const sandbox = new SandboxCarrierAdapter();
    this.adapters.set(sandbox.code, sandbox);
  }

  getAdapter(code: string): CarrierAdapter | undefined {
    return this.adapters.get(code);
  }
}
