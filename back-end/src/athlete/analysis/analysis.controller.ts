import {
	Controller,
	Get,
	Param,
	ParseUUIDPipe,
	Query,
	UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsIn } from 'class-validator';
import type { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AnalysisService } from './analysis.service';

export class AnalysisPeriodDto {
	@Type(() => Number) @IsInt() @IsIn([7, 15, 30]) days = 7;
}

export class ExerciseAnalysisPeriodDto {
	@IsIn(['7', '15', '30', '3m']) period: '7' | '15' | '30' | '3m' = '3m';
}

@UseGuards(JwtAuthGuard)
@Controller('athlete/:athleteId/analysis')
export class AnalysisController {
	constructor(private readonly service: AnalysisService) {}
	@Get()
	get(
		@Param('athleteId', new ParseUUIDPipe()) athleteId: string,
		@Query() query: AnalysisPeriodDto,
		@CurrentUser() actor: JwtPayload,
	) {
		return this.service.athlete(athleteId, query.days, actor);
	}
}
