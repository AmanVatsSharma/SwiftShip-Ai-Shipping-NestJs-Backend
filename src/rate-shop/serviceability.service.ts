import { Injectable } from '@nestjs/common';

@Injectable()
export class ServiceabilityService {
  // TODO: Replace with courier zone matrices and ODA logic
  async isServiceable(originPincode: string, destinationPincode: string): Promise<boolean> {
    if (!originPincode || !destinationPincode) return false;
    // Simple stub: disallow same pincode edge-case for demo
    return originPincode !== destinationPincode;
  }
}
