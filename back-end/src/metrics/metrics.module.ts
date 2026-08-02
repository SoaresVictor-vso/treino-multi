import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Metric } from './entities/metric.entity';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

@Module({
	imports: [TypeOrmModule.forFeature([Metric])],
	controllers: [MetricsController],
	providers: [MetricsService],
	exports: [MetricsService],
})
export class MetricsModule {}
