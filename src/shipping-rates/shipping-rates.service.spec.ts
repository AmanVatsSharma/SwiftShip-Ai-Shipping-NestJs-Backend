import { Test, TestingModule } from '@nestjs/testing';
import { ShippingRatesService } from './shipping-rates.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { CreateShippingRateInput } from './create-shipping-rate.input';
import { UpdateShippingRateInput } from './update-shipping-rate.input';

// Mock PrismaService
const mockPrismaService = {
  shippingRate: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  carrier: {
    findUnique: jest.fn(),
  },
};

describe('ShippingRatesService', () => {
  let service: ShippingRatesService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShippingRatesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ShippingRatesService>(ShippingRatesService);
    prismaService = module.get<PrismaService>(PrismaService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getShippingRate', () => {
    it('should return a shipping rate if it exists', async () => {
      const mockShippingRate = {
        id: 1,
        carrierId: 1,
        serviceName: 'Express',
        rate: 15.99,
        estimatedDeliveryDays: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrismaService.shippingRate.findUnique.mockResolvedValue(mockShippingRate);

      const result = await service.getShippingRate(1);
      expect(result).toEqual(mockShippingRate);
      expect(mockPrismaService.shippingRate.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('should throw NotFoundException if shipping rate does not exist', async () => {
      mockPrismaService.shippingRate.findUnique.mockResolvedValue(null);

      await expect(service.getShippingRate(999)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.shippingRate.findUnique).toHaveBeenCalledWith({ where: { id: 999 } });
    });
  });

  describe('getShippingRates', () => {
    it('should return an array of shipping rates', async () => {
      const mockShippingRates = [
        {
          id: 1,
          carrierId: 1,
          serviceName: 'Express',
          rate: 15.99,
          estimatedDeliveryDays: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          carrierId: 2,
          serviceName: 'Standard',
          rate: 9.99,
          estimatedDeliveryDays: 5,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      mockPrismaService.shippingRate.findMany.mockResolvedValue(mockShippingRates);

      const result = await service.getShippingRates();
      expect(result).toEqual(mockShippingRates);
      expect(mockPrismaService.shippingRate.findMany).toHaveBeenCalledWith({
        orderBy: [
          { carrierId: 'asc' },
          { rate: 'asc' }
        ]
      });
    });
  });

  describe('getShippingRatesByCarrier', () => {
    it('should return shipping rates for a specific carrier', async () => {
      const carrierId = 1;
      const mockCarrier = { id: carrierId, name: 'FedEx', apiKey: 'abc123', createdAt: new Date(), updatedAt: new Date() };
      const mockShippingRates = [
        {
          id: 1,
          carrierId,
          serviceName: 'Express',
          rate: 15.99,
          estimatedDeliveryDays: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 3,
          carrierId,
          serviceName: 'Ground',
          rate: 8.99,
          estimatedDeliveryDays: 5,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      
      mockPrismaService.carrier.findUnique.mockResolvedValue(mockCarrier);
      mockPrismaService.shippingRate.findMany.mockResolvedValue(mockShippingRates);

      const result = await service.getShippingRatesByCarrier(carrierId);
      expect(result).toEqual(mockShippingRates);
      expect(mockPrismaService.carrier.findUnique).toHaveBeenCalledWith({ where: { id: carrierId } });
      expect(mockPrismaService.shippingRate.findMany).toHaveBeenCalledWith({
        where: { carrierId },
        orderBy: { rate: 'asc' }
      });
    });

    it('should throw NotFoundException if carrier does not exist', async () => {
      mockPrismaService.carrier.findUnique.mockResolvedValue(null);

      await expect(service.getShippingRatesByCarrier(999)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.carrier.findUnique).toHaveBeenCalledWith({ where: { id: 999 } });
      expect(mockPrismaService.shippingRate.findMany).not.toHaveBeenCalled();
    });
  });

  describe('createShippingRate', () => {
    it('should create a new shipping rate', async () => {
      const createShippingRateInput: CreateShippingRateInput = {
        carrierId: 1,
        serviceName: 'Express',
        rate: 15.99,
        estimatedDeliveryDays: 2,
      };
      
      const mockCarrier = { id: 1, name: 'FedEx', apiKey: 'abc123', createdAt: new Date(), updatedAt: new Date() };
      const mockCreatedShippingRate = {
        id: 1,
        ...createShippingRateInput,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrismaService.carrier.findUnique.mockResolvedValue(mockCarrier);
      mockPrismaService.shippingRate.create.mockResolvedValue(mockCreatedShippingRate);

      const result = await service.createShippingRate(createShippingRateInput);
      expect(result).toEqual(mockCreatedShippingRate);
      expect(mockPrismaService.carrier.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockPrismaService.shippingRate.create).toHaveBeenCalledWith({
        data: createShippingRateInput,
      });
    });

    it('should throw BadRequestException if carrier does not exist', async () => {
      const createShippingRateInput: CreateShippingRateInput = {
        carrierId: 999,
        serviceName: 'Express',
        rate: 15.99,
        estimatedDeliveryDays: 2,
      };
      
      mockPrismaService.carrier.findUnique.mockResolvedValue(null);

      await expect(service.createShippingRate(createShippingRateInput)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.carrier.findUnique).toHaveBeenCalledWith({ where: { id: 999 } });
      expect(mockPrismaService.shippingRate.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if shipping rate already exists', async () => {
      const createShippingRateInput: CreateShippingRateInput = {
        carrierId: 1,
        serviceName: 'Express',
        rate: 15.99,
        estimatedDeliveryDays: 2,
      };
      
      const mockCarrier = { id: 1, name: 'FedEx', apiKey: 'abc123', createdAt: new Date(), updatedAt: new Date() };
      
      mockPrismaService.carrier.findUnique.mockResolvedValue(mockCarrier);
      
      const mockError = new PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '4.0.0',
      });
      
      mockPrismaService.shippingRate.create.mockRejectedValue(mockError);

      await expect(service.createShippingRate(createShippingRateInput)).rejects.toThrow(ConflictException);
      expect(mockPrismaService.carrier.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockPrismaService.shippingRate.create).toHaveBeenCalledWith({
        data: createShippingRateInput,
      });
    });
  });

  describe('updateShippingRate', () => {
    it('should update an existing shipping rate', async () => {
      const updateShippingRateInput: UpdateShippingRateInput = {
        id: 1,
        rate: 19.99,
        estimatedDeliveryDays: 1,
      };
      
      const mockShippingRate = {
        id: 1,
        carrierId: 1,
        serviceName: 'Express',
        rate: 15.99,
        estimatedDeliveryDays: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      const mockUpdatedShippingRate = {
        ...mockShippingRate,
        rate: 19.99,
        estimatedDeliveryDays: 1,
        updatedAt: new Date(),
      };
      
      mockPrismaService.shippingRate.findUnique.mockResolvedValue(mockShippingRate);
      mockPrismaService.shippingRate.update.mockResolvedValue(mockUpdatedShippingRate);

      const result = await service.updateShippingRate(updateShippingRateInput);
      expect(result).toEqual(mockUpdatedShippingRate);
      expect(mockPrismaService.shippingRate.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockPrismaService.shippingRate.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          rate: 19.99,
          estimatedDeliveryDays: 1,
        },
      });
    });

    it('should throw NotFoundException if shipping rate to update does not exist', async () => {
      const updateShippingRateInput: UpdateShippingRateInput = {
        id: 999,
        rate: 19.99,
      };
      
      mockPrismaService.shippingRate.findUnique.mockResolvedValue(null);

      await expect(service.updateShippingRate(updateShippingRateInput)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.shippingRate.findUnique).toHaveBeenCalledWith({ where: { id: 999 } });
      expect(mockPrismaService.shippingRate.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if new carrier does not exist', async () => {
      const updateShippingRateInput: UpdateShippingRateInput = {
        id: 1,
        carrierId: 999,
      };
      
      const mockShippingRate = {
        id: 1,
        carrierId: 1,
        serviceName: 'Express',
        rate: 15.99,
        estimatedDeliveryDays: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrismaService.shippingRate.findUnique.mockResolvedValue(mockShippingRate);
      mockPrismaService.carrier.findUnique.mockResolvedValue(null);

      await expect(service.updateShippingRate(updateShippingRateInput)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.shippingRate.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockPrismaService.carrier.findUnique).toHaveBeenCalledWith({ where: { id: 999 } });
      expect(mockPrismaService.shippingRate.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteShippingRate', () => {
    it('should delete an existing shipping rate', async () => {
      const mockShippingRate = {
        id: 1,
        carrierId: 1,
        serviceName: 'Express',
        rate: 15.99,
        estimatedDeliveryDays: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrismaService.shippingRate.findUnique.mockResolvedValue(mockShippingRate);
      mockPrismaService.shippingRate.delete.mockResolvedValue(mockShippingRate);

      const result = await service.deleteShippingRate(1);
      expect(result).toEqual(mockShippingRate);
      expect(mockPrismaService.shippingRate.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockPrismaService.shippingRate.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should throw NotFoundException if shipping rate to delete does not exist', async () => {
      mockPrismaService.shippingRate.findUnique.mockResolvedValue(null);

      await expect(service.deleteShippingRate(999)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.shippingRate.findUnique).toHaveBeenCalledWith({ where: { id: 999 } });
      expect(mockPrismaService.shippingRate.delete).not.toHaveBeenCalled();
    });
  });

  describe('getCheapestRate', () => {
    it('should return the cheapest rate', async () => {
      const mockCheapestRate = {
        id: 3,
        carrierId: 2,
        serviceName: 'Economy',
        rate: 5.99,
        estimatedDeliveryDays: 7,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrismaService.shippingRate.findMany.mockResolvedValue([mockCheapestRate]);

      const result = await service.getCheapestRate();
      expect(result).toEqual(mockCheapestRate);
      expect(mockPrismaService.shippingRate.findMany).toHaveBeenCalledWith({
        orderBy: { rate: 'asc' },
        take: 1
      });
    });

    it('should return null if no rates exist', async () => {
      mockPrismaService.shippingRate.findMany.mockResolvedValue([]);

      const result = await service.getCheapestRate();
      expect(result).toBeNull();
      expect(mockPrismaService.shippingRate.findMany).toHaveBeenCalledWith({
        orderBy: { rate: 'asc' },
        take: 1
      });
    });
  });
}); 