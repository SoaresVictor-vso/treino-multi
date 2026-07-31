import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Metric } from './entities/metric.entity';
import { MetricsService } from './metrics.service';

@Module({
  imports: [TypeOrmModule.forFeature([Metric])],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}