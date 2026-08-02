import { Controller, Get, UseGuards } from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Metric } from './entities/metric.entity';
import { MetricsService } from './metrics.service';

@ApiTags('metrics')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('metrics')
export class MetricsController {
	constructor(private readonly metricsService: MetricsService) {}

	@ApiOperation({ summary: 'Lista todas as métricas' })
	@ApiResponse({
		status: 200,
		description: 'Lista de métricas ordenadas por nome',
	})
	@Get()
	findAll(): Promise<Metric[]> {
		return this.metricsService.findAll();
	}
}
