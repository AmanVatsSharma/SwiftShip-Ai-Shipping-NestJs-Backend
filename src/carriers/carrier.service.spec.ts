import { Test, TestingModule } from '@nestjs/testing';
import { CarrierService } from './carrier.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { CreateCarrierInput } from './create-carrier.input';
import { UpdateCarrierInput } from './update-carrier.input';

// Mock PrismaService
const mockPrismaService = {
  carrier: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('CarrierService', () => {
  let service: CarrierService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CarrierService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CarrierService>(CarrierService);
    prismaService = module.get<PrismaService>(PrismaService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCarrier', () => {
    it('should return a carrier if it exists', async () => {
      const mockCarrier = { id: 1, name: 'FedEx', apiKey: 'abc123', createdAt: new Date(), updatedAt: new Date() };
      mockPrismaService.carrier.findUnique.mockResolvedValue(mockCarrier);

      const result = await service.getCarrier(1);
      expect(result).toEqual(mockCarrier);
      expect(mockPrismaService.carrier.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('should throw NotFoundException if carrier does not exist', async () => {
      mockPrismaService.carrier.findUnique.mockResolvedValue(null);

      await expect(service.getCarrier(999)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.carrier.findUnique).toHaveBeenCalledWith({ where: { id: 999 } });
    });
  });

  describe('getCarriers', () => {
    it('should return an array of carriers', async () => {
      const mockCarriers = [
        { id: 1, name: 'FedEx', apiKey: 'abc123', createdAt: new Date(), updatedAt: new Date() },
        { id: 2, name: 'UPS', apiKey: 'def456', createdAt: new Date(), updatedAt: new Date() },
      ];
      mockPrismaService.carrier.findMany.mockResolvedValue(mockCarriers);

      const result = await service.getCarriers();
      expect(result).toEqual(mockCarriers);
      expect(mockPrismaService.carrier.findMany).toHaveBeenCalledWith({ orderBy: { name: 'asc' } });
    });
  });

  describe('createCarrier', () => {
    it('should create a new carrier', async () => {
      const createCarrierInput: CreateCarrierInput = { name: 'DHL', apiKey: 'ghi789' };
      const mockCreatedCarrier = { 
        id: 3, 
        ...createCarrierInput, 
        createdAt: new Date(), 
        updatedAt: new Date() 
      };
      
      mockPrismaService.carrier.create.mockResolvedValue(mockCreatedCarrier);

      const result = await service.createCarrier(createCarrierInput);
      expect(result).toEqual(mockCreatedCarrier);
      expect(mockPrismaService.carrier.create).toHaveBeenCalledWith({
        data: createCarrierInput,
      });
    });

    it('should throw ConflictException if carrier name already exists', async () => {
      const createCarrierInput: CreateCarrierInput = { name: 'FedEx', apiKey: 'abc123' };
      
      const mockError = new PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '4.0.0',
      });
      
      mockPrismaService.carrier.create.mockRejectedValue(mockError);

      await expect(service.createCarrier(createCarrierInput)).rejects.toThrow(ConflictException);
      expect(mockPrismaService.carrier.create).toHaveBeenCalledWith({
        data: createCarrierInput,
      });
    });
  });

  describe('updateCarrier', () => {
    it('should update an existing carrier', async () => {
      const updateCarrierInput: UpdateCarrierInput = { id: 1, name: 'FedEx Express' };
      const mockCarrier = { id: 1, name: 'FedEx', apiKey: 'abc123', createdAt: new Date(), updatedAt: new Date() };
      const mockUpdatedCarrier = { ...mockCarrier, name: 'FedEx Express' };
      
      mockPrismaService.carrier.findUnique.mockResolvedValue(mockCarrier);
      mockPrismaService.carrier.update.mockResolvedValue(mockUpdatedCarrier);

      const result = await service.updateCarrier(updateCarrierInput);
      expect(result).toEqual(mockUpdatedCarrier);
      expect(mockPrismaService.carrier.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockPrismaService.carrier.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { name: 'FedEx Express' },
      });
    });

    it('should throw NotFoundException if carrier to update does not exist', async () => {
      const updateCarrierInput: UpdateCarrierInput = { id: 999, name: 'FedEx Express' };
      
      mockPrismaService.carrier.findUnique.mockResolvedValue(null);

      await expect(service.updateCarrier(updateCarrierInput)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.carrier.findUnique).toHaveBeenCalledWith({ where: { id: 999 } });
      expect(mockPrismaService.carrier.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteCarrier', () => {
    it('should delete an existing carrier', async () => {
      const mockCarrier = { id: 1, name: 'FedEx', apiKey: 'abc123', createdAt: new Date(), updatedAt: new Date() };
      
      mockPrismaService.carrier.findUnique.mockResolvedValue(mockCarrier);
      mockPrismaService.carrier.delete.mockResolvedValue(mockCarrier);

      const result = await service.deleteCarrier(1);
      expect(result).toEqual(mockCarrier);
      expect(mockPrismaService.carrier.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockPrismaService.carrier.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should throw NotFoundException if carrier to delete does not exist', async () => {
      mockPrismaService.carrier.findUnique.mockResolvedValue(null);

      await expect(service.deleteCarrier(999)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.carrier.findUnique).toHaveBeenCalledWith({ where: { id: 999 } });
      expect(mockPrismaService.carrier.delete).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if carrier is referenced by other records', async () => {
      const mockCarrier = { id: 1, name: 'FedEx', apiKey: 'abc123', createdAt: new Date(), updatedAt: new Date() };
      
      mockPrismaService.carrier.findUnique.mockResolvedValue(mockCarrier);
      
      const mockError = new PrismaClientKnownRequestError('Foreign key constraint failed', {
        code: 'P2003',
        clientVersion: '4.0.0',
      });
      
      mockPrismaService.carrier.delete.mockRejectedValue(mockError);

      await expect(service.deleteCarrier(1)).rejects.toThrow(ConflictException);
      expect(mockPrismaService.carrier.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockPrismaService.carrier.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });
  });
}); 