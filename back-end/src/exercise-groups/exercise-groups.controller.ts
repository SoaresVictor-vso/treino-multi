import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseIntPipe,
	Patch,
	Post,
	UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AddExerciseToGroupDto } from './dto/add-exercise-to-group.dto';
import { CreateExerciseGroupDto } from './dto/create-exercise-group.dto';
import { UpdateExerciseGroupDto } from './dto/update-exercise-group.dto';
import { ExerciseGroupsService } from './exercise-groups.service';

const MANAGE_ROLES = [Role.ORG_ADMIN, Role.ORG_SUPPORT, Role.TENANT_ADMIN];

@ApiTags('exercise-groups')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('exercise-groups')
export class ExerciseGroupsController {
	constructor(private readonly service: ExerciseGroupsService) {}

	@Get()
	@ApiOperation({ summary: 'Lista os grupos de exercícios visíveis' })
	findAll(@CurrentUser() actor: JwtPayload) {
		return this.service.findAll(actor);
	}

	@Get(':id')
	@ApiOperation({ summary: 'Busca um grupo de exercícios' })
	findOne(
		@Param('id', ParseIntPipe) id: number,
		@CurrentUser() actor: JwtPayload,
	) {
		return this.service.findOne(id, actor);
	}

	@Get(':id/exercises')
	@ApiOperation({ summary: 'Lista os exercícios de um grupo' })
	findExercises(
		@Param('id', ParseIntPipe) id: number,
		@CurrentUser() actor: JwtPayload,
	) {
		return this.service.findExercises(id, actor);
	}

	@Post()
	@UseGuards(RolesGuard)
	@Roles(...MANAGE_ROLES)
	@ApiOperation({ summary: 'Cria um grupo de exercícios' })
	create(@Body() dto: CreateExerciseGroupDto, @CurrentUser() actor: JwtPayload) {
		return this.service.create(dto, actor);
	}

	@Patch(':id')
	@UseGuards(RolesGuard)
	@Roles(...MANAGE_ROLES)
	@ApiOperation({ summary: 'Atualiza um grupo de exercícios' })
	update(
		@Param('id', ParseIntPipe) id: number,
		@Body() dto: UpdateExerciseGroupDto,
		@CurrentUser() actor: JwtPayload,
	) {
		return this.service.update(id, dto, actor);
	}

	@Delete(':id')
	@HttpCode(HttpStatus.NO_CONTENT)
	@UseGuards(RolesGuard)
	@Roles(...MANAGE_ROLES)
	@ApiOperation({ summary: 'Remove um grupo de exercícios' })
	async remove(
		@Param('id', ParseIntPipe) id: number,
		@CurrentUser() actor: JwtPayload,
	) {
		await this.service.remove(id, actor);
	}

	@Post(':id/exercises')
	@UseGuards(RolesGuard)
	@Roles(...MANAGE_ROLES)
	@ApiOperation({ summary: 'Inclui um exercício no grupo' })
	addExercise(
		@Param('id', ParseIntPipe) id: number,
		@Body() dto: AddExerciseToGroupDto,
		@CurrentUser() actor: JwtPayload,
	) {
		return this.service.addExercise(id, dto, actor);
	}

	@Delete(':id/exercises/:exerciseId')
	@HttpCode(HttpStatus.NO_CONTENT)
	@UseGuards(RolesGuard)
	@Roles(...MANAGE_ROLES)
	@ApiOperation({ summary: 'Remove um exercício do grupo' })
	async removeExercise(
		@Param('id', ParseIntPipe) id: number,
		@Param('exerciseId', ParseIntPipe) exerciseId: number,
		@CurrentUser() actor: JwtPayload,
	) {
		await this.service.removeExercise(id, exerciseId, actor);
	}
}
