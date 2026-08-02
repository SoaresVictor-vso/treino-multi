import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	UseGuards,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permission } from '../common/enums/permission.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateWorkoutTemplateDto } from './dto/create-workout-template.dto';
import { UpdateWorkoutTemplateDto } from './dto/update-workout-template.dto';
import { WorkoutTemplatesService } from './workout-templates.service';
import {
	RequirePermissions,
	RequireSomePermissions,
} from '../common/decorators/require-permissions.decorator';

@ApiTags('workout-templates')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('workout-templates')
export class WorkoutTemplatesController {
	constructor(
		private readonly workoutTemplatesService: WorkoutTemplatesService,
	) {}

	@ApiOperation({ summary: 'Cria um template de treino' })
	@ApiResponse({ status: 201, description: 'Template criado com sucesso' })
	@Post()
	@RequirePermissions(Permission.WORKOUT_TEMPLATES_CREATE)
	create(
		@Body() dto: CreateWorkoutTemplateDto,
		@CurrentUser() actor: JwtPayload,
	) {
		return this.workoutTemplatesService.create(dto, actor);
	}

	@ApiOperation({ summary: 'Lista os templates de treino acessíveis' })
	@ApiResponse({ status: 200, description: 'Lista de templates de treino' })
	@RequireSomePermissions(
		[Permission.WORKOUT_TEMPLATES_READ],
		[Permission.WORKOUT_TEMPLATES_READ_TENANT],
		[Permission.WORKOUT_TEMPLATES_READ_ALL],
	)
	@Get()
	findAll(@CurrentUser() actor: JwtPayload) {
		return this.workoutTemplatesService.findAll(actor);
	}

	@ApiOperation({ summary: 'Busca um template de treino por ID' })
	@ApiResponse({ status: 404, description: 'Template não encontrado' })
	@RequireSomePermissions(
		[Permission.WORKOUT_TEMPLATES_READ],
		[Permission.WORKOUT_TEMPLATES_READ_TENANT],
		[Permission.WORKOUT_TEMPLATES_READ_ALL],
	)
	@Get(':id')
	async findOne(
		@Param('id', new ParseUUIDPipe()) id: string,
		@CurrentUser() actor: JwtPayload,
	) {
		return this.workoutTemplatesService.findOne(id, actor);
	}

	@ApiOperation({ summary: 'Atualiza um template de treino' })
	@RequireSomePermissions(
		[Permission.WORKOUT_TEMPLATES_UPDATE],
		[Permission.WORKOUT_TEMPLATES_UPDATE_TENANT],
		[Permission.WORKOUT_TEMPLATES_UPDATE_ALL],
	)
	@Patch(':id')
	async update(
		@Param('id', new ParseUUIDPipe()) id: string,
		@Body() dto: UpdateWorkoutTemplateDto,
		@CurrentUser() actor: JwtPayload,
	) {
		return this.workoutTemplatesService.update(id, dto, actor);
	}

	@ApiOperation({ summary: 'Remove um template de treino' })
	@ApiResponse({ status: 204, description: 'Template removido com sucesso' })
	@RequireSomePermissions(
		[Permission.WORKOUT_TEMPLATES_DELETE],
		[Permission.WORKOUT_TEMPLATES_DELETE_TENANT],
		[Permission.WORKOUT_TEMPLATES_DELETE_ALL],
	)
	@Delete(':id')
	@HttpCode(HttpStatus.NO_CONTENT)
	async remove(
		@Param('id', new ParseUUIDPipe()) id: string,
		@CurrentUser() actor: JwtPayload,
	) {
		await this.workoutTemplatesService.remove(id, actor);
	}
}
