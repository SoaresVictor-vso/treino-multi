import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permission } from '../common/enums/permission.enum';
import { Role } from '../common/enums/role.enum';
import { resolvePermissions } from '../common/enums/role-permissions.map';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateWorkoutTemplateDto } from './dto/create-workout-template.dto';
import { UpdateWorkoutTemplateDto } from './dto/update-workout-template.dto';
import { WorkoutTemplate } from './entities/workout-template.entity';
import { WorkoutTemplatesService } from './workout-templates.service';
import { RequirePermissions, RequireSomePermissions } from '../common/decorators/require-permissions.decorator';

type TemplateOperation = 'read' | 'update' | 'delete';

const OPERATION_PERMISSIONS: Record<TemplateOperation, [Permission, Permission, Permission]> = {
  read: [
    Permission.WORKOUT_TEMPLATES_READ,
    Permission.WORKOUT_TEMPLATES_READ_TENANT,
    Permission.WORKOUT_TEMPLATES_READ_ALL,
  ],
  update: [
    Permission.WORKOUT_TEMPLATES_UPDATE,
    Permission.WORKOUT_TEMPLATES_UPDATE_TENANT,
    Permission.WORKOUT_TEMPLATES_UPDATE_ALL,
  ],
  delete: [
    Permission.WORKOUT_TEMPLATES_DELETE,
    Permission.WORKOUT_TEMPLATES_DELETE_TENANT,
    Permission.WORKOUT_TEMPLATES_DELETE_ALL,
  ],
};

@ApiTags('workout-templates')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('workout-templates')
export class WorkoutTemplatesController {
  constructor(private readonly workoutTemplatesService: WorkoutTemplatesService) {}

  @ApiOperation({ summary: 'Cria um template de treino' })
  @ApiResponse({ status: 201, description: 'Template criado com sucesso' })
  @Post()
  @RequirePermissions(Permission.WORKOUT_TEMPLATES_CREATE)
  create(
    @Body() dto: CreateWorkoutTemplateDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    this.ensurePermission(actor, Permission.WORKOUT_TEMPLATES_CREATE);
    if (actor.tenantId && dto.tenantId !== actor.tenantId) {
      throw new ForbiddenException('Não é permitido criar templates em outro tenant.');
    }

    return this.workoutTemplatesService.create({
      ...dto,
      createdBy: actor.sub,
      updatedBy: actor.sub,
    });
  }

  @ApiOperation({ summary: 'Lista os templates de treino acessíveis' })
  @ApiResponse({ status: 200, description: 'Lista de templates de treino' })
  @RequireSomePermissions(
    [Permission.WORKOUT_TEMPLATES_READ],
    [Permission.WORKOUT_TEMPLATES_READ_TENANT],
    [Permission.WORKOUT_TEMPLATES_READ_ALL],
  )
  @Get()
  async findAll(@CurrentUser() actor: JwtPayload) {
    this.ensureOperationPermission(actor, 'read');
    const templates = await this.workoutTemplatesService.findAll();
    return templates.filter((template) => this.canAccess(template, actor, 'read'));
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
    const template = await this.workoutTemplatesService.findOne(id);
    this.ensureAccess(template, actor, 'read');
    return template;
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
    const template = await this.workoutTemplatesService.findOne(id);
    this.ensureAccess(template, actor, 'update');
    const { tenantId: _tenantId, createdBy: _createdBy, updatedBy: _updatedBy, ...updateDto } = dto;
    return this.workoutTemplatesService.update(id, {
      ...updateDto,
      updatedBy: actor.sub,
    });
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
    const template = await this.workoutTemplatesService.findOne(id);
    this.ensureAccess(template, actor, 'delete');
    await this.workoutTemplatesService.remove(id);
  }

  private ensureAccess(
    template: WorkoutTemplate,
    actor: JwtPayload,
    operation: TemplateOperation,
  ): void {
    if (!this.canAccess(template, actor, operation)) {
      throw new ForbiddenException('Você não possui permissão para acessar este template de treino.');
    }
  }

  private canAccess(
    template: WorkoutTemplate,
    actor: JwtPayload,
    operation: TemplateOperation,
  ): boolean {
    const [own, tenant, all] = OPERATION_PERMISSIONS[operation];
    const permissions = resolvePermissions(actor.roles as Role[]);
    return (
      permissions.includes(all) ||
      (permissions.includes(tenant) && actor.tenantId === template.tenantId) ||
      (permissions.includes(own) && actor.sub === template.createdBy)
    );
  }

  private ensureOperationPermission(
    actor: JwtPayload,
    operation: TemplateOperation,
  ): void {
    const permissions = resolvePermissions(actor.roles as Role[]);
    if (!OPERATION_PERMISSIONS[operation].some((permission) => permissions.includes(permission))) {
      throw new ForbiddenException('Você não possui permissão para acessar templates de treino.');
    }
  }

  private ensurePermission(actor: JwtPayload, permission: Permission): void {
    if (!resolvePermissions(actor.roles as Role[]).includes(permission)) {
      throw new ForbiddenException(`Acesso negado: permissão ausente: ${permission}`);
    }
  }
}