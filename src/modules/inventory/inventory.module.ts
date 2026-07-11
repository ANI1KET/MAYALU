import {
  Controller, Get, Post, Param, Body, Query, Module,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiCookieAuth, ApiBody, ApiParam, ApiQuery,
  ApiProperty, ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  WarehouseDto, InventoryItemDto, MessageResponseDto,
} from '../../common/swagger/response.dto';
import { IsString, IsNumber, IsEnum, IsOptional } from 'class-validator';
import { InventoryService } from './inventory.service';
import { JwtService } from '../../common/services/jwt.service';
import { ApiOkEnvelope, ApiCreatedEnvelope, ApiOkEnvelopeSchema, ApiStandardErrors } from '../../common/decorators/api-responses.decorator';

class CreateWarehouseDto {
  @ApiProperty({ example: 'Main Warehouse - Thamel' })
  @IsString() name!: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Address UUID — used to resolve origin delivery zone' })
  @IsOptional() @IsString() addressId?: string;
}

class AdjustStockBodyDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'ProductVariant UUID' })
  @IsString() variantId!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Warehouse UUID' })
  @IsString() warehouseId!: string;

  @ApiProperty({ example: 50, description: 'Positive = add stock. Negative = deduct. Absolute for opening count.' })
  @IsNumber() delta!: number;

  @ApiProperty({ enum: ['restock', 'adjustment', 'damage', 'return', 'opening'], example: 'restock',
    description: 'restock=new stock arrived, damage=write-off, return=customer return, opening=initial count' })
  @IsEnum(['restock', 'adjustment', 'damage', 'return', 'opening'])
  type!: 'restock' | 'adjustment' | 'damage' | 'return' | 'opening';

  @ApiPropertyOptional({ example: 'Received 50 units from Bhaktapur supplier' })
  @IsOptional() @IsString() notes?: string;
}

@ApiTags('Inventory')
@ApiCookieAuth('access_token')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('warehouses')
  @ApiBody({ type: CreateWarehouseDto })
  @ApiOperation({ summary: 'Create warehouse', description: 'Creates a named warehouse for the shop. First warehouse becomes the default.' })
  @ApiQuery({ name: 'shopId', required: true })
  @ApiCreatedEnvelope(WarehouseDto, 'Warehouse created')
  @ApiStandardErrors({ badRequest: true })
  createWarehouse(@Query('shopId') shopId: string, @Body() dto: CreateWarehouseDto) {
    return this.inventoryService.createWarehouse(shopId, dto.name, dto.addressId);
  }

  @Get('warehouses')
  @ApiOperation({ summary: 'List warehouses for a shop' })
  @ApiQuery({ name: 'shopId', required: true })
  @ApiOkEnvelope([WarehouseDto], 'Shop warehouses')
  @ApiStandardErrors()
  getWarehouses(@Query('shopId') shopId: string) {
    return this.inventoryService.getWarehouses(shopId);
  }

  @Get()
  @ApiOperation({
    summary: 'Full inventory list',
    description: 'Returns stock levels for all variants across all warehouses. Quantity available = onHand - reserved (computed inline).',
  })
  @ApiQuery({ name: 'shopId', required: true })
  @ApiOkEnvelope([InventoryItemDto], 'Inventory rows with computed quantity_available')
  @ApiStandardErrors()
  getInventory(@Query('shopId') shopId: string) {
    return this.inventoryService.getInventory(shopId);
  }

  @Get('low-stock')
  @ApiOperation({ summary: 'Low stock alerts', description: 'Items where (quantityOnHand - quantityReserved) ≤ lowStockThreshold. Uses expression index for fast lookup.' })
  @ApiQuery({ name: 'shopId', required: true })
  @ApiOkEnvelope([InventoryItemDto], 'Low stock items')
  @ApiStandardErrors()
  getLowStock(@Query('shopId') shopId: string) {
    return this.inventoryService.getLowStock(shopId);
  }

  @Post('adjust')
  @ApiBody({ type: AdjustStockBodyDto })
  @ApiOperation({
    summary: 'Adjust stock level',
    description: 'Append-only adjustment. Type determines delta direction (restock = positive, damage = negative). Creates an immutable transaction log entry.',
  })
  @ApiQuery({ name: 'shopId', required: true })
  @ApiOkEnvelope(MessageResponseDto, 'Stock adjusted')
  @ApiStandardErrors({
    badRequest: 'INSUFFICIENT_STOCK | NO_INVENTORY_RECORD',
    notFound: 'Warehouse',
  })
  adjustStock(@Query('shopId') shopId: string, @Body() dto: AdjustStockBodyDto) {
    return this.inventoryService.adjustStock(shopId, dto);
  }

  @Get(':inventoryId/transactions')
  @ApiOperation({ summary: 'Get transaction log for an inventory row', description: 'Returns last 100 stock movements (sales, restocks, adjustments) sorted by newest.' })
  @ApiParam({ name: 'inventoryId', description: 'Inventory row UUID' })
  @ApiOkEnvelopeSchema(
    { type: 'array', items: { type: 'object', properties: {
      id: { type: 'string' }, type: { type: 'string', example: 'sale' },
      quantityDelta: { type: 'number', example: -2 },
      quantityAfter: { type: 'number', example: 48 },
      createdAt: { type: 'string', format: 'date-time' },
    } } },
    'Last 100 inventory transactions',
  )
  @ApiStandardErrors()
  getTransactions(@Param('inventoryId') inventoryId: string) {
    return this.inventoryService.getTransactions(inventoryId);
  }
}

@Module({
  controllers: [InventoryController],
  providers: [InventoryService, JwtService],
  exports: [InventoryService],
})
export class InventoryModule {}
