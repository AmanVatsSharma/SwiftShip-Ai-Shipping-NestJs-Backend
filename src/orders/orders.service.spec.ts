import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { CreateOrderInput } from './create-order.input';
import { UpdateOrderInput } from './update-order.input';
import { OrderStatus } from './order.model';

// Mock PrismaService
const mockPrismaService = {
  order: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    groupBy: jest.fn(),
    aggregate: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  carrier: {
    findUnique: jest.fn(),
  },
};

describe('OrdersService', () => {
  let service: OrdersService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    prismaService = module.get<PrismaService>(PrismaService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOrder', () => {
    it('should return an order if it exists', async () => {
      const mockOrder = {
        id: 1,
        orderNumber: 'ORD123456',
        total: 99.99,
        status: OrderStatus.PENDING,
        userId: 1,
        carrierId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        shipments: [],
        returns: [],
      };
      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);

      const result = await service.getOrder(1);
      expect(result).toEqual(mockOrder);
      expect(mockPrismaService.order.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: {
          shipments: true,
          returns: true
        }
      });
    });

    it('should throw NotFoundException if order does not exist', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(null);

      await expect(service.getOrder(999)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.order.findUnique).toHaveBeenCalledWith({
        where: { id: 999 },
        include: {
          shipments: true,
          returns: true
        }
      });
    });
  });

  describe('getOrders', () => {
    it('should return an array of orders', async () => {
      const mockOrders = [
        {
          id: 1,
          orderNumber: 'ORD123456',
          total: 99.99,
          status: OrderStatus.PENDING,
          userId: 1,
          carrierId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          shipments: [],
          returns: [],
        },
        {
          id: 2,
          orderNumber: 'ORD789012',
          total: 149.99,
          status: OrderStatus.PAID,
          userId: 2,
          carrierId: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          shipments: [],
          returns: [],
        },
      ];
      mockPrismaService.order.findMany.mockResolvedValue(mockOrders);

      const result = await service.getOrders();
      expect(result).toEqual(mockOrders);
      expect(mockPrismaService.order.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        include: {
          shipments: true,
          returns: true
        }
      });
    });
  });

  describe('createOrder', () => {
    it('should create a new order', async () => {
      const createOrderInput: CreateOrderInput = {
        orderNumber: 'ORD123456',
        total: 99.99,
        userId: 1,
        status: OrderStatus.PENDING,
      };
      
      const mockUser = { id: 1, email: 'user@example.com', name: 'Test User', createdAt: new Date(), updatedAt: new Date() };
      const mockCreatedOrder = {
        id: 1,
        ...createOrderInput,
        carrierId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        shipments: [],
        returns: [],
      };
      
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.order.create.mockResolvedValue(mockCreatedOrder);

      const result = await service.createOrder(createOrderInput);
      expect(result).toEqual(mockCreatedOrder);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockPrismaService.order.create).toHaveBeenCalledWith({
        data: {
          orderNumber: 'ORD123456',
          total: 99.99,
          userId: 1,
          carrierId: undefined,
          status: OrderStatus.PENDING,
        },
        include: {
          shipments: true,
          returns: true
        }
      });
    });

    it('should throw BadRequestException if user does not exist', async () => {
      const createOrderInput: CreateOrderInput = {
        orderNumber: 'ORD123456',
        total: 99.99,
        userId: 999,
      };
      
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.createOrder(createOrderInput)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({ where: { id: 999 } });
      expect(mockPrismaService.order.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if carrier does not exist', async () => {
      const createOrderInput: CreateOrderInput = {
        orderNumber: 'ORD123456',
        total: 99.99,
        userId: 1,
        carrierId: 999,
      };
      
      const mockUser = { id: 1, email: 'user@example.com', name: 'Test User', createdAt: new Date(), updatedAt: new Date() };
      
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.carrier.findUnique.mockResolvedValue(null);

      await expect(service.createOrder(createOrderInput)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockPrismaService.carrier.findUnique).toHaveBeenCalledWith({ where: { id: 999 } });
      expect(mockPrismaService.order.create).not.toHaveBeenCalled();
    });
  });

  describe('updateOrder', () => {
    it('should update an existing order', async () => {
      const updateOrderInput: UpdateOrderInput = {
        id: 1,
        status: OrderStatus.PAID,
      };
      
      const mockOrder = {
        id: 1,
        orderNumber: 'ORD123456',
        total: 99.99,
        status: OrderStatus.PENDING,
        userId: 1,
        carrierId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        shipments: [],
        returns: [],
      };
      
      const mockUpdatedOrder = {
        ...mockOrder,
        status: OrderStatus.PAID,
        updatedAt: new Date(),
      };
      
      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);
      mockPrismaService.order.update.mockResolvedValue(mockUpdatedOrder);

      const result = await service.updateOrder(updateOrderInput);
      expect(result).toEqual(mockUpdatedOrder);
      expect(mockPrismaService.order.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: {
          shipments: true,
          returns: true
        }
      });
      expect(mockPrismaService.order.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: OrderStatus.PAID },
        include: {
          shipments: true,
          returns: true
        }
      });
    });

    it('should throw NotFoundException if order to update does not exist', async () => {
      const updateOrderInput: UpdateOrderInput = {
        id: 999,
        status: OrderStatus.PAID,
      };
      
      mockPrismaService.order.findUnique.mockResolvedValue(null);

      await expect(service.updateOrder(updateOrderInput)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.order.findUnique).toHaveBeenCalledWith({
        where: { id: 999 },
        include: {
          shipments: true,
          returns: true
        }
      });
      expect(mockPrismaService.order.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if trying to update a CANCELLED order', async () => {
      const updateOrderInput: UpdateOrderInput = {
        id: 1,
        status: OrderStatus.PAID,
      };
      
      const mockOrder = {
        id: 1,
        orderNumber: 'ORD123456',
        total: 99.99,
        status: OrderStatus.CANCELLED,
        userId: 1,
        carrierId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        shipments: [],
        returns: [],
      };
      
      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);

      await expect(service.updateOrder(updateOrderInput)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.order.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: {
          shipments: true,
          returns: true
        }
      });
      expect(mockPrismaService.order.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteOrder', () => {
    it('should delete an existing order', async () => {
      const mockOrder = {
        id: 1,
        orderNumber: 'ORD123456',
        total: 99.99,
        status: OrderStatus.PENDING,
        userId: 1,
        carrierId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        shipments: [],
        returns: [],
      };
      
      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);
      mockPrismaService.order.delete.mockResolvedValue(mockOrder);

      const result = await service.deleteOrder(1);
      expect(result).toEqual(mockOrder);
      expect(mockPrismaService.order.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: {
          shipments: true,
          returns: true
        }
      });
      expect(mockPrismaService.order.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should throw NotFoundException if order to delete does not exist', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(null);

      await expect(service.deleteOrder(999)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.order.findUnique).toHaveBeenCalledWith({
        where: { id: 999 },
        include: {
          shipments: true,
          returns: true
        }
      });
      expect(mockPrismaService.order.delete).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if trying to delete a PAID order', async () => {
      const mockOrder = {
        id: 1,
        orderNumber: 'ORD123456',
        total: 99.99,
        status: OrderStatus.PAID,
        userId: 1,
        carrierId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        shipments: [],
        returns: [],
      };
      
      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);

      await expect(service.deleteOrder(1)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.order.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: {
          shipments: true,
          returns: true
        }
      });
      expect(mockPrismaService.order.delete).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if order has shipments', async () => {
      const mockOrder = {
        id: 1,
        orderNumber: 'ORD123456',
        total: 99.99,
        status: OrderStatus.PENDING,
        userId: 1,
        carrierId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        shipments: [{ id: 1 }],
        returns: [],
      };
      
      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);

      await expect(service.deleteOrder(1)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.order.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: {
          shipments: true,
          returns: true
        }
      });
      expect(mockPrismaService.order.delete).not.toHaveBeenCalled();
    });
  });

  describe('getTotalSales', () => {
    it('should return total sales for PAID orders', async () => {
      mockPrismaService.order.aggregate.mockResolvedValue({
        _sum: {
          total: 499.95
        }
      });

      const result = await service.getTotalSales();
      expect(result).toEqual(499.95);
      expect(mockPrismaService.order.aggregate).toHaveBeenCalledWith({
        _sum: {
          total: true
        },
        where: {
          status: OrderStatus.PAID
        }
      });
    });

    it('should return 0 if no PAID orders exist', async () => {
      mockPrismaService.order.aggregate.mockResolvedValue({
        _sum: {
          total: null
        }
      });

      const result = await service.getTotalSales();
      expect(result).toEqual(0);
      expect(mockPrismaService.order.aggregate).toHaveBeenCalledWith({
        _sum: {
          total: true
        },
        where: {
          status: OrderStatus.PAID
        }
      });
    });
  });
}); 