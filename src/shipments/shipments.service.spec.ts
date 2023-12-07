import { Test, TestingModule } from '@nestjs/testing';
import { ShipmentsService } from './shipments.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { CreateShipmentInput } from './create-shipment.input';
import { UpdateShipmentInput } from './update-shipment.input';
import { ShipmentStatus } from './shipment.model';

// Mock PrismaService
const mockPrismaService = {
  shipment: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    groupBy: jest.fn(),
  },
  order: {
    findUnique: jest.fn(),
  },
  carrier: {
    findUnique: jest.fn(),
  },
};

describe('ShipmentsService', () => {
  let service: ShipmentsService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShipmentsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ShipmentsService>(ShipmentsService);
    prismaService = module.get<PrismaService>(PrismaService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getShipment', () => {
    it('should return a shipment if it exists', async () => {
      const mockShipment = {
        id: 1,
        trackingNumber: 'TRK123456',
        status: 'PENDING',
        orderId: 1,
        carrierId: 1,
        shippedAt: null,
        deliveredAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrismaService.shipment.findUnique.mockResolvedValue(mockShipment);

      const result = await service.getShipment(1);
      expect(result).toEqual(mockShipment);
      expect(mockPrismaService.shipment.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('should throw NotFoundException if shipment does not exist', async () => {
      mockPrismaService.shipment.findUnique.mockResolvedValue(null);

      await expect(service.getShipment(999)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.shipment.findUnique).toHaveBeenCalledWith({ where: { id: 999 } });
    });
  });

  describe('getShipments', () => {
    it('should return an array of shipments', async () => {
      const mockShipments = [
        {
          id: 1,
          trackingNumber: 'TRK123456',
          status: 'PENDING',
          orderId: 1,
          carrierId: 1,
          shippedAt: null,
          deliveredAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          trackingNumber: 'TRK789012',
          status: 'SHIPPED',
          orderId: 2,
          carrierId: 1,
          shippedAt: new Date(),
          deliveredAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      mockPrismaService.shipment.findMany.mockResolvedValue(mockShipments);

      const result = await service.getShipments();
      expect(result).toEqual(mockShipments);
      expect(mockPrismaService.shipment.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' }
      });
    });
  });

  describe('createShipment', () => {
    it('should create a new shipment', async () => {
      const createShipmentInput: CreateShipmentInput = {
        trackingNumber: 'TRK123456',
        status: ShipmentStatus.PENDING,
        orderId: 1,
        carrierId: 1,
      };
      
      const mockOrder = { id: 1, orderNumber: 'ORD123', total: 100, status: 'PAID', createdAt: new Date(), updatedAt: new Date(), userId: 1 };
      const mockCarrier = { id: 1, name: 'FedEx', apiKey: 'abc123', createdAt: new Date(), updatedAt: new Date() };
      const mockCreatedShipment = {
        id: 1,
        trackingNumber: 'TRK123456',
        status: 'PENDING',
        orderId: 1,
        carrierId: 1,
        shippedAt: null,
        deliveredAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);
      mockPrismaService.carrier.findUnique.mockResolvedValue(mockCarrier);
      mockPrismaService.shipment.create.mockResolvedValue(mockCreatedShipment);

      const result = await service.createShipment(createShipmentInput);
      expect(result).toEqual(mockCreatedShipment);
      expect(mockPrismaService.order.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockPrismaService.carrier.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockPrismaService.shipment.create).toHaveBeenCalledWith({
        data: {
          trackingNumber: 'TRK123456',
          status: 'PENDING',
          orderId: 1,
          carrierId: 1,
          shippedAt: undefined,
          deliveredAt: undefined,
        },
      });
    });

    it('should throw BadRequestException if order does not exist', async () => {
      const createShipmentInput: CreateShipmentInput = {
        trackingNumber: 'TRK123456',
        status: ShipmentStatus.PENDING,
        orderId: 999,
        carrierId: 1,
      };
      
      mockPrismaService.order.findUnique.mockResolvedValue(null);

      await expect(service.createShipment(createShipmentInput)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.order.findUnique).toHaveBeenCalledWith({ where: { id: 999 } });
      expect(mockPrismaService.shipment.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if carrier does not exist', async () => {
      const createShipmentInput: CreateShipmentInput = {
        trackingNumber: 'TRK123456',
        status: ShipmentStatus.PENDING,
        orderId: 1,
        carrierId: 999,
      };
      
      const mockOrder = { id: 1, orderNumber: 'ORD123', total: 100, status: 'PAID', createdAt: new Date(), updatedAt: new Date(), userId: 1 };
      
      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);
      mockPrismaService.carrier.findUnique.mockResolvedValue(null);

      await expect(service.createShipment(createShipmentInput)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.order.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockPrismaService.carrier.findUnique).toHaveBeenCalledWith({ where: { id: 999 } });
      expect(mockPrismaService.shipment.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if status validation fails', async () => {
      const createShipmentInput: CreateShipmentInput = {
        trackingNumber: 'TRK123456',
        status: ShipmentStatus.PENDING,
        orderId: 1,
        carrierId: 1,
        shippedAt: new Date(),
      };
      
      const mockOrder = { id: 1, orderNumber: 'ORD123', total: 100, status: 'PAID', createdAt: new Date(), updatedAt: new Date(), userId: 1 };
      const mockCarrier = { id: 1, name: 'FedEx', apiKey: 'abc123', createdAt: new Date(), updatedAt: new Date() };
      
      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);
      mockPrismaService.carrier.findUnique.mockResolvedValue(mockCarrier);

      await expect(service.createShipment(createShipmentInput)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.order.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockPrismaService.carrier.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockPrismaService.shipment.create).not.toHaveBeenCalled();
    });
  });

  describe('updateShipment', () => {
    it('should update an existing shipment', async () => {
      const updateShipmentInput: UpdateShipmentInput = {
        id: 1,
        status: ShipmentStatus.SHIPPED,
      };
      
      const mockShipment = {
        id: 1,
        trackingNumber: 'TRK123456',
        status: 'PENDING',
        orderId: 1,
        carrierId: 1,
        shippedAt: null,
        deliveredAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      const mockUpdatedShipment = {
        ...mockShipment,
        status: 'SHIPPED',
        shippedAt: expect.any(Date),
        updatedAt: expect.any(Date),
      };
      
      mockPrismaService.shipment.findUnique.mockResolvedValue(mockShipment);
      mockPrismaService.shipment.update.mockResolvedValue(mockUpdatedShipment);

      const result = await service.updateShipment(updateShipmentInput);
      expect(result).toEqual(mockUpdatedShipment);
      expect(mockPrismaService.shipment.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockPrismaService.shipment.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          status: 'SHIPPED',
          shippedAt: expect.any(Date),
        },
      });
    });

    it('should throw NotFoundException if shipment to update does not exist', async () => {
      const updateShipmentInput: UpdateShipmentInput = {
        id: 999,
        status: ShipmentStatus.SHIPPED,
      };
      
      mockPrismaService.shipment.findUnique.mockResolvedValue(null);

      await expect(service.updateShipment(updateShipmentInput)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.shipment.findUnique).toHaveBeenCalledWith({ where: { id: 999 } });
      expect(mockPrismaService.shipment.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if status validation fails', async () => {
      const updateShipmentInput: UpdateShipmentInput = {
        id: 1,
        status: ShipmentStatus.PENDING,
      };
      
      const mockShipment = {
        id: 1,
        trackingNumber: 'TRK123456',
        status: 'SHIPPED',
        orderId: 1,
        carrierId: 1,
        shippedAt: new Date(),
        deliveredAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrismaService.shipment.findUnique.mockResolvedValue(mockShipment);

      await expect(service.updateShipment(updateShipmentInput)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.shipment.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockPrismaService.shipment.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteShipment', () => {
    it('should delete an existing shipment', async () => {
      const mockShipment = {
        id: 1,
        trackingNumber: 'TRK123456',
        status: 'PENDING',
        orderId: 1,
        carrierId: 1,
        shippedAt: null,
        deliveredAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrismaService.shipment.findUnique.mockResolvedValue(mockShipment);
      mockPrismaService.shipment.delete.mockResolvedValue(mockShipment);

      const result = await service.deleteShipment(1);
      expect(result).toEqual(mockShipment);
      expect(mockPrismaService.shipment.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockPrismaService.shipment.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should throw NotFoundException if shipment to delete does not exist', async () => {
      mockPrismaService.shipment.findUnique.mockResolvedValue(null);

      await expect(service.deleteShipment(999)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.shipment.findUnique).toHaveBeenCalledWith({ where: { id: 999 } });
      expect(mockPrismaService.shipment.delete).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if trying to delete a delivered shipment', async () => {
      const mockShipment = {
        id: 1,
        trackingNumber: 'TRK123456',
        status: 'DELIVERED',
        orderId: 1,
        carrierId: 1,
        shippedAt: new Date(),
        deliveredAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrismaService.shipment.findUnique.mockResolvedValue(mockShipment);

      await expect(service.deleteShipment(1)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.shipment.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockPrismaService.shipment.delete).not.toHaveBeenCalled();
    });
  });

  describe('countShipmentsByStatus', () => {
    it('should return counts of shipments by status', async () => {
      const mockStatusCounts = [
        { status: 'PENDING', _count: { status: 5 } },
        { status: 'SHIPPED', _count: { status: 3 } },
        { status: 'IN_TRANSIT', _count: { status: 2 } },
        { status: 'DELIVERED', _count: { status: 10 } },
      ];
      
      mockPrismaService.shipment.groupBy.mockResolvedValue(mockStatusCounts);

      const result = await service.countShipmentsByStatus();
      expect(result).toEqual({
        PENDING: 5,
        SHIPPED: 3,
        IN_TRANSIT: 2,
        DELIVERED: 10,
        CANCELLED: 0,
      });
      expect(mockPrismaService.shipment.groupBy).toHaveBeenCalledWith({
        by: ['status'],
        _count: {
          status: true
        }
      });
    });
  });
}); 