import {
	Controller,
	Get,
	Param,
	ParseIntPipe,
	ParseUUIDPipe,
	Query,
	UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { ExerciseReviewQueryDto } from './exercise-reviews.dto';
import { ExerciseAnalysisPeriodDto } from '../athlete/analysis/analysis.controller';
import { ExerciseReviewsService } from './exercise-reviews.service';

@ApiTags('exercise-reviews')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('exercise-reviews/athletes/:athleteId/exercises/:exerciseId')
export class ExerciseReviewsController {
	constructor(private readonly service: ExerciseReviewsService) {}
	@Get('analysis') analysis(
		@Param('athleteId', new ParseUUIDPipe()) athleteId: string,
		@Param('exerciseId', ParseIntPipe) exerciseId: number,
		@Query() query: ExerciseAnalysisPeriodDto,
		@CurrentUser() actor: JwtPayload,
	) {
		return this.service.analysis(athleteId, exerciseId, query.period, actor);
	}
	@Get('summary') summary(
		@Param('athleteId', new ParseUUIDPipe()) athleteId: string,
		@Param('exerciseId', ParseIntPipe) exerciseId: number,
		@Query() query: ExerciseReviewQueryDto,
		@CurrentUser() actor: JwtPayload,
	) {
		return this.service.summary(athleteId, exerciseId, query, actor);
	}
	@Get('workouts') workouts(
		@Param('athleteId', new ParseUUIDPipe()) athleteId: string,
		@Param('exerciseId', ParseIntPipe) exerciseId: number,
		@Query() query: ExerciseReviewQueryDto,
		@CurrentUser() actor: JwtPayload,
	) {
		return this.service.workouts(athleteId, exerciseId, query, actor);
	}
	@Get('latest') latest(
		@Param('athleteId', new ParseUUIDPipe()) athleteId: string,
		@Param('exerciseId', ParseIntPipe) exerciseId: number,
		@CurrentUser() actor: JwtPayload,
	) {
		return this.service.latest(athleteId, exerciseId, actor);
	}
}
