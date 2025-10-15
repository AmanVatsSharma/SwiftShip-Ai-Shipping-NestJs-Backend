import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ServiceabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async isServiceable(originPincode: string, destinationPincode: string): Promise<boolean> {
    if (!originPincode || !destinationPincode) return false;
    const [orig, dest] = await Promise.all([
      this.prisma.pincodeZone.findUnique({ where: { pincode: originPincode } }),
      this.prisma.pincodeZone.findUnique({ where: { pincode: destinationPincode } }),
    ]);
    if (!orig || !dest) return false;
    // Basic rule: zones must exist; allow ODA delivery for now
    return true;
  }
}
