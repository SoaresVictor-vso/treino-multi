import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiQuery,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { Permission } from '../common/enums/permission.enum';
import { FindExerciseChangesDto } from './dto/find-exercise-changes.dto';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { ExercisesService } from './exercises.service';

@ApiTags('exercises')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('exercises')
export class ExercisesController {
	constructor(private readonly exercisesService: ExercisesService) {}

	@ApiOperation({ summary: 'Cadastra um exercício no catálogo' })
	@ApiResponse({ status: 201, description: 'Exercício cadastrado' })
	@RequirePermissions(Permission.EXERCISES_CREATE)
	@Post()
	create(@Body() dto: CreateExerciseDto, @CurrentUser() actor: JwtPayload) {
		return this.exercisesService.create(dto, actor.tenantId);
	}

	@ApiOperation({ summary: 'Lista todos os exercícios ativos' })
	@ApiResponse({ status: 200, description: 'Lista de exercícios não removidos' })
	@RequirePermissions(Permission.EXERCISES_READ)
	@Get()
	findAll(@CurrentUser() actor?: JwtPayload) {
		return actor
			? this.exercisesService.findAll(actor.tenantId)
			: this.exercisesService.findAll();
	}

	@ApiOperation({ summary: 'Lista alterações de exercícios desde uma data' })
	@ApiQuery({
		name: 'since',
		type: String,
		format: 'date-time',
		required: false,
		nullable: true,
	})
	@RequirePermissions(Permission.EXERCISES_READ)
	@Get('sync')
	findChanges(
		@Query() { since }: FindExerciseChangesDto,
		@CurrentUser() actor?: JwtPayload,
	) {
		const normalizedSince =
			typeof since === 'string' && (since === 'null' || since.trim() === '')
				? null
				: since;
		const date = normalizedSince ? new Date(normalizedSince) : null;
		return actor
			? this.exercisesService.findChangesSince(date, actor.tenantId)
			: this.exercisesService.findChangesSince(date);
	}
}
