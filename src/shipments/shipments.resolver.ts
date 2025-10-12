import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { Shipment, ShipmentStatus } from './shipment.model';
import { ShipmentsService } from './shipments.service';
import { CreateShipmentInput } from './create-shipment.input';
import { UpdateShipmentInput } from './update-shipment.input';
import { ShipmentsGateway } from './shipments.gateway';
import { ShipmentsFilterInput } from './shipments-filter.input';
import { CreateLabelInput } from './create-label.input';
import { TrackingEvent, ShippingLabel } from './shipment.model';
import { IngestTrackingInput } from './ingest-tracking.input';

@Resolver(() => Shipment)
export class ShipmentsResolver {
  constructor(private shipmentsService: ShipmentsService, private shipmentsGateway: ShipmentsGateway) {}

  /**
   * Get all shipments in the system
   * @returns Array of shipment objects
   */
  @Query(() => [Shipment], { 
    name: 'shipments',
    description: 'Get all shipments ordered by creation date (newest first)'
  })
  async getShipments(): Promise<Shipment[]> {
    const shipments = await this.shipmentsService.getShipments();
    return shipments.map(ship => this.mapShipment(ship));
  }

  /**
   * Get a specific shipment by ID
   * @param id - The ID of the shipment to retrieve
   * @returns Shipment object
   */
  @Query(() => Shipment, { 
    name: 'shipment',
    description: 'Get a specific shipment by ID'
  })
  async getShipment(
    @Args('id', { type: () => Int, description: 'The ID of the shipment' }) 
    id: number
  ): Promise<Shipment> {
    const shipment = await this.shipmentsService.getShipment(id);
    return this.mapShipment(shipment);
  }

  /**
   * Create a new shipment
   * @param createShipmentInput - The shipment data to create
   * @returns The newly created shipment
   */
  @Mutation(() => Shipment, {
    description: 'Create a new shipment'
  })
  async createShipment(
    @Args('createShipmentInput', { description: 'Shipment creation data' }) 
    createShipmentInput: CreateShipmentInput
  ): Promise<Shipment> {
    const shipment = await this.shipmentsService.createShipment(createShipmentInput);
    this.shipmentsGateway.notifyShipmentUpdate(shipment);
    return this.mapShipment(shipment);
  }

  /**
   * Update an existing shipment
   * @param updateShipmentInput - The shipment data to update
   * @returns The updated shipment
   */
  @Mutation(() => Shipment, {
    description: 'Update an existing shipment'
  })
  async updateShipment(
    @Args('updateShipmentInput', { description: 'Shipment update data' }) 
    updateShipmentInput: UpdateShipmentInput
  ): Promise<Shipment> {
    const shipment = await this.shipmentsService.updateShipment(updateShipmentInput);
    this.shipmentsGateway.notifyShipmentUpdate(shipment);
    return this.mapShipment(shipment);
  }

  @Mutation(() => ShippingLabel, { description: 'Generate a shipping label for a shipment' })
  async createShippingLabel(
    @Args('createLabelInput') input: CreateLabelInput
  ) {
    const label = await this.shipmentsService.createLabel(input);
    // eslint-disable-next-line no-console
    console.log('[ShipmentsResolver] Label created', label);
    this.shipmentsGateway.server.emit('labelCreated', label);
    return label;
  }

  @Mutation(() => TrackingEvent, { description: 'Ingest a tracking event for a shipment' })
  async ingestTrackingEvent(
    @Args('ingestTrackingInput') input: IngestTrackingInput
  ) {
    const event = await this.shipmentsService.ingestTracking(input);
    // eslint-disable-next-line no-console
    console.log('[ShipmentsResolver] Tracking event ingested', event);
    this.shipmentsGateway.server.emit('trackingEvent', event);
    return event;
  }

  /**
   * Delete a shipment by ID
   * @param id - The ID of the shipment to delete
   * @returns The deleted shipment
   */
  @Mutation(() => Shipment, {
    description: 'Delete a shipment (only allowed for non-delivered shipments)'
  })
  async deleteShipment(
    @Args('id', { type: () => Int, description: 'The ID of the shipment to delete' }) 
    id: number
  ): Promise<Shipment> {
    const shipment = await this.shipmentsService.deleteShipment(id);
    this.shipmentsGateway.notifyShipmentUpdate({ ...shipment, deleted: true });
    return this.mapShipment(shipment);
  }

  /**
   * Filter shipments based on specific criteria
   * @param filter - The filter criteria
   * @returns Array of shipments matching the criteria
   */
  @Query(() => [Shipment], { 
    name: 'filterShipments',
    description: 'Filter shipments based on status, order ID, or carrier ID'
  })
  async filterShipments(
    @Args('shipmentsFilterInput', { description: 'Filter criteria for shipments' }) 
    filter: ShipmentsFilterInput
  ): Promise<Shipment[]> {
    const shipments = await this.shipmentsService.filterShipments(filter);
    return shipments.map(ship => this.mapShipment(ship));
  }

  /**
   * Get shipments by status
   * @param status - The status to filter by
   * @returns Array of shipments with the specified status
   */
  @Query(() => [Shipment], { 
    name: 'shipmentsByStatus',
    description: 'Get shipments by status'
  })
  async getShipmentsByStatus(
    @Args('status', { type: () => ShipmentStatus, description: 'The status to filter by' }) 
    status: ShipmentStatus
  ): Promise<Shipment[]> {
    const shipments = await this.shipmentsService.getShipmentsByStatus(status);
    return shipments.map(ship => this.mapShipment(ship));
  }

  /**
   * Get shipments by order ID
   * @param orderId - The order ID to filter by
   * @returns Array of shipments for the specified order
   */
  @Query(() => [Shipment], { 
    name: 'shipmentsByOrder',
    description: 'Get shipments by order ID'
  })
  async getShipmentsByOrder(
    @Args('orderId', { type: () => Int, description: 'The order ID to filter by' }) 
    orderId: number
  ): Promise<Shipment[]> {
    const shipments = await this.shipmentsService.getShipmentsByOrder(orderId);
    return shipments.map(ship => this.mapShipment(ship));
  }

  /**
   * Get counts of shipments by status
   * @returns Record with counts for each status
   */
  @Query(() => String, { 
    name: 'shipmentCountsByStatus',
    description: 'Get counts of shipments by status'
  })
  async getShipmentCountsByStatus(): Promise<string> {
    const counts = await this.shipmentsService.countShipmentsByStatus();
    return JSON.stringify(counts);
  }

  /**
   * Map a Prisma shipment entity to a GraphQL shipment type
   * @param shipment - The shipment entity from Prisma
   * @returns A GraphQL shipment type
   */
  private mapShipment(shipment: any): Shipment {
    return {
      id: shipment.id,
      trackingNumber: shipment.trackingNumber,
      status: shipment.status,
      orderId: shipment.orderId,
      carrierId: shipment.carrierId,
      shippedAt: shipment.shippedAt,
      deliveredAt: shipment.deliveredAt,
      createdAt: shipment.createdAt,
      updatedAt: shipment.updatedAt,
    };
  }
} 