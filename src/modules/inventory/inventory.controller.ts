import {
  Controller, Get, Post, Param, Body, Query,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiCookieAuth, ApiBody, ApiParam, ApiQuery,
} from '@nestjs/swagger';
import {
  WarehouseDto, InventoryItemDto, MessageResponseDto,
} from '../../common/swagger/response.dto';
import { InventoryService } from './inventory.service';
import { CreateWarehouseDto, AdjustStockBodyDto } from './dto/inventory.dto';
import { ApiOkEnvelope, ApiCreatedEnvelope, ApiOkEnvelopeSchema, ApiStandardErrors } from '../../common/decorators/api-responses.decorator';

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
