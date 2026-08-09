import {
	Body,
	Controller,
	Get,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { Permission } from '../common/enums/permission.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { GenerateWorkoutsFromTemplateDto } from './dto/generate-workouts-from-template.dto';
import { UpdateWorkoutExecutionsDto } from './dto/update-workout-executions.dto';
import { WorkoutsService } from './workouts.service';

@ApiTags('workouts')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('workouts')
export class WorkoutsController {
	constructor(private readonly service: WorkoutsService) {}

	@Get('me')
	@ApiOperation({
		summary: 'Lista os treinos pendentes ou agendados do atleta autenticado',
	})
	findMyWorkouts(@CurrentUser() actor: JwtPayload) {
		return this.service.findMyWorkouts(actor);
	}

	@Get(':id')
	@ApiOperation({ summary: 'Exibe o treino e suas séries' })
	findWorkout(
		@Param('id', new ParseUUIDPipe()) id: string,
		@CurrentUser() actor: JwtPayload,
	) {
		return this.service.findWorkout(id, actor);
	}

	@Patch(':id/start')
	@ApiOperation({ summary: 'Inicia o treino do próprio atleta' })
	startWorkout(
		@Param('id', new ParseUUIDPipe()) id: string,
		@CurrentUser() actor: JwtPayload,
	) {
		return this.service.startWorkout(id, actor);
	}

	@Patch(':id/executions')
	@ApiOperation({ summary: 'Atualiza as séries de um treino em andamento' })
	updateExecutions(
		@Param('id', new ParseUUIDPipe()) id: string,
		@Body() dto: UpdateWorkoutExecutionsDto,
		@CurrentUser() actor: JwtPayload,
	) {
		return this.service.updateExecutions(id, dto, actor);
	}

	@Patch(':id/complete')
	@ApiOperation({
		summary: 'Finaliza um treino quando todas as séries foram resolvidas',
	})
	completeWorkout(
		@Param('id', new ParseUUIDPipe()) id: string,
		@CurrentUser() actor: JwtPayload,
	) {
		return this.service.completeWorkout(id, actor);
	}

	@Post('from-template')
	@ApiOperation({ summary: 'Gera treinos de um template para vários atletas' })
	@RequirePermissions(Permission.ATHLETE_MANAGE)
	generateWorkoutsFromTemplate(
		@Body() dto: GenerateWorkoutsFromTemplateDto,
		@CurrentUser() actor: JwtPayload,
	) {
		return this.service.generateWorkoutsFromTemplate(dto, actor);
	}
}
