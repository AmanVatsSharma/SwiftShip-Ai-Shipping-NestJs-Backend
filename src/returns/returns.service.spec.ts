import { Test, TestingModule } from '@nestjs/testing';
import { ReturnsService } from './returns.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { CreateReturnInput } from './create-return.input';
import { UpdateReturnInput } from './update-return.input';
import { ReturnStatus } from './return.model';

// Mock PrismaService
const mockPrismaService = {
  return: {
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
};

describe('ReturnsService', () => {
  let service: ReturnsService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReturnsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ReturnsService>(ReturnsService);
    prismaService = module.get<PrismaService>(PrismaService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getReturn', () => {
    it('should return a return if it exists', async () => {
      const mockReturn = {
        id: 1,
        returnNumber: 'RET123456',
        status: ReturnStatus.REQUESTED,
        reason: 'Item damaged',
        pickupScheduledAt: null,
        orderId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrismaService.return.findUnique.mockResolvedValue(mockReturn);

      const result = await service.getReturn(1);
      expect(result).toEqual(mockReturn);
      expect(mockPrismaService.return.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('should throw NotFoundException if return does not exist', async () => {
      mockPrismaService.return.findUnique.mockResolvedValue(null);

      await expect(service.getReturn(999)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.return.findUnique).toHaveBeenCalledWith({ where: { id: 999 } });
    });
  });

  describe('getReturns', () => {
    it('should return an array of returns', async () => {
      const mockReturns = [
        {
          id: 1,
          returnNumber: 'RET123456',
          status: ReturnStatus.REQUESTED,
          reason: 'Item damaged',
          pickupScheduledAt: null,
          orderId: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          returnNumber: 'RET789012',
          status: ReturnStatus.APPROVED,
          reason: 'Wrong item',
          pickupScheduledAt: new Date(),
          orderId: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      mockPrismaService.return.findMany.mockResolvedValue(mockReturns);

      const result = await service.getReturns();
      expect(result).toEqual(mockReturns);
      expect(mockPrismaService.return.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' }
      });
    });
  });

  describe('createReturn', () => {
    it('should create a new return', async () => {
      const createReturnInput: CreateReturnInput = {
        returnNumber: 'RET123456',
        status: ReturnStatus.REQUESTED,
        reason: 'Item damaged',
        orderId: 1,
      };
      
      const mockOrder = { id: 1, orderNumber: 'ORD123', total: 100, status: 'PAID', createdAt: new Date(), updatedAt: new Date(), userId: 1 };
      const mockCreatedReturn = {
        id: 1,
        ...createReturnInput,
        pickupScheduledAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);
      mockPrismaService.return.create.mockResolvedValue(mockCreatedReturn);

      const result = await service.createReturn(createReturnInput);
      expect(result).toEqual(mockCreatedReturn);
      expect(mockPrismaService.order.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockPrismaService.return.create).toHaveBeenCalledWith({
        data: createReturnInput,
      });
    });

    it('should throw BadRequestException if order does not exist', async () => {
      const createReturnInput: CreateReturnInput = {
        returnNumber: 'RET123456',
        status: ReturnStatus.REQUESTED,
        reason: 'Item damaged',
        orderId: 999,
      };
      
      mockPrismaService.order.findUnique.mockResolvedValue(null);

      await expect(service.createReturn(createReturnInput)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.order.findUnique).toHaveBeenCalledWith({ where: { id: 999 } });
      expect(mockPrismaService.return.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if status is not REQUESTED', async () => {
      const createReturnInput: CreateReturnInput = {
        returnNumber: 'RET123456',
        status: ReturnStatus.APPROVED,
        reason: 'Item damaged',
        orderId: 1,
      };
      
      const mockOrder = { id: 1, orderNumber: 'ORD123', total: 100, status: 'PAID', createdAt: new Date(), updatedAt: new Date(), userId: 1 };
      
      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);

      await expect(service.createReturn(createReturnInput)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.order.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockPrismaService.return.create).not.toHaveBeenCalled();
    });
  });

  describe('updateReturn', () => {
    it('should update an existing return', async () => {
      const updateReturnInput: UpdateReturnInput = {
        id: 1,
        status: ReturnStatus.APPROVED,
      };
      
      const mockReturn = {
        id: 1,
        returnNumber: 'RET123456',
        status: ReturnStatus.REQUESTED,
        reason: 'Item damaged',
        pickupScheduledAt: null,
        orderId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      const mockUpdatedReturn = {
        ...mockReturn,
        status: ReturnStatus.APPROVED,
        updatedAt: new Date(),
      };
      
      mockPrismaService.return.findUnique.mockResolvedValue(mockReturn);
      mockPrismaService.return.update.mockResolvedValue(mockUpdatedReturn);

      const result = await service.updateReturn(updateReturnInput);
      expect(result).toEqual(mockUpdatedReturn);
      expect(mockPrismaService.return.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockPrismaService.return.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: ReturnStatus.APPROVED },
      });
    });

    it('should throw NotFoundException if return to update does not exist', async () => {
      const updateReturnInput: UpdateReturnInput = {
        id: 999,
        status: ReturnStatus.APPROVED,
      };
      
      mockPrismaService.return.findUnique.mockResolvedValue(null);

      await expect(service.updateReturn(updateReturnInput)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.return.findUnique).toHaveBeenCalledWith({ where: { id: 999 } });
      expect(mockPrismaService.return.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if invalid status transition', async () => {
      const updateReturnInput: UpdateReturnInput = {
        id: 1,
        status: ReturnStatus.COMPLETED,
      };
      
      const mockReturn = {
        id: 1,
        returnNumber: 'RET123456',
        status: ReturnStatus.REQUESTED,
        reason: 'Item damaged',
        pickupScheduledAt: null,
        orderId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrismaService.return.findUnique.mockResolvedValue(mockReturn);

      await expect(service.updateReturn(updateReturnInput)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.return.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockPrismaService.return.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteReturn', () => {
    it('should delete an existing return with REQUESTED status', async () => {
      const mockReturn = {
        id: 1,
        returnNumber: 'RET123456',
        status: ReturnStatus.REQUESTED,
        reason: 'Item damaged',
        pickupScheduledAt: null,
        orderId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrismaService.return.findUnique.mockResolvedValue(mockReturn);
      mockPrismaService.return.delete.mockResolvedValue(mockReturn);

      const result = await service.deleteReturn(1);
      expect(result).toEqual(mockReturn);
      expect(mockPrismaService.return.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockPrismaService.return.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should throw NotFoundException if return to delete does not exist', async () => {
      mockPrismaService.return.findUnique.mockResolvedValue(null);

      await expect(service.deleteReturn(999)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.return.findUnique).toHaveBeenCalledWith({ where: { id: 999 } });
      expect(mockPrismaService.return.delete).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if trying to delete a return with COMPLETED status', async () => {
      const mockReturn = {
        id: 1,
        returnNumber: 'RET123456',
        status: ReturnStatus.COMPLETED,
        reason: 'Item damaged',
        pickupScheduledAt: null,
        orderId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrismaService.return.findUnique.mockResolvedValue(mockReturn);

      await expect(service.deleteReturn(1)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.return.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockPrismaService.return.delete).not.toHaveBeenCalled();
    });
  });

  describe('countReturnsByStatus', () => {
    it('should return counts of returns by status', async () => {
      const mockStatusCounts = [
        { status: 'REQUESTED', _count: { status: 5 } },
        { status: 'APPROVED', _count: { status: 3 } },
        { status: 'REJECTED', _count: { status: 2 } },
        { status: 'COMPLETED', _count: { status: 10 } },
      ];
      
      mockPrismaService.return.groupBy.mockResolvedValue(mockStatusCounts);

      const result = await service.countReturnsByStatus();
      expect(result).toEqual({
        REQUESTED: 5,
        APPROVED: 3,
        REJECTED: 2,
        COMPLETED: 10,
        CANCELLED: 0,
      });
      expect(mockPrismaService.return.groupBy).toHaveBeenCalledWith({
        by: ['status'],
        _count: {
          status: true
        }
      });
    });
  });
}); 