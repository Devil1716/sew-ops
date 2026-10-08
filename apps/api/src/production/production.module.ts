import { Module } from '@nestjs/common';
import { OperatorController, ProductionController } from './production.controller';
import { ProductionService } from './production.service';
import { StationService } from './station.service';

@Module({
  controllers: [ProductionController, OperatorController],
  providers: [ProductionService, StationService],
  exports: [StationService],
})
export class ProductionModule {}