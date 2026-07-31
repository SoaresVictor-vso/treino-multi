import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { Exercise } from '../exercises/entities/exercise.entity';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Permission } from '../common/enums/permission.enum';
import { Role } from '../common/enums/role.enum';
import { resolvePermissions } from '../common/enums/role-permissions.map';
import { CreateWorkoutTemplateDto } from './dto/create-workout-template.dto';
import { UpdateWorkoutTemplateDto } from './dto/update-workout-template.dto';
import { Activity } from './entities/activity.entity';
import { WorkoutTemplate } from './entities/workout-template.entity';

type TemplateOperation = 'read' | 'update' | 'delete';

const OPERATION_PERMISSIONS: Record<TemplateOperation, [Permission, Permission, Permission]> = {
  read: [Permission.WORKOUT_TEMPLATES_READ, Permission.WORKOUT_TEMPLATES_READ_TENANT, Permission.WORKOUT_TEMPLATES_READ_ALL],
  update: [Permission.WORKOUT_TEMPLATES_UPDATE, Permission.WORKOUT_TEMPLATES_UPDATE_TENANT, Permission.WORKOUT_TEMPLATES_UPDATE_ALL],
  delete: [Permission.WORKOUT_TEMPLATES_DELETE, Permission.WORKOUT_TEMPLATES_DELETE_TENANT, Permission.WORKOUT_TEMPLATES_DELETE_ALL],
};

@Injectable()
export class WorkoutTemplatesService {
  constructor(
    @InjectRepository(WorkoutTemplate)
    private readonly templateRepo: Repository<WorkoutTemplate>,
    @InjectRepository(Exercise)
    private readonly exerciseRepo: Repository<Exercise>,
    private readonly dataSource: DataSource,
  ) { }

  async create(dto: CreateWorkoutTemplateDto, actor: JwtPayload): Promise<WorkoutTemplate> {
    this.ensurePermission(actor, Permission.WORKOUT_TEMPLATES_CREATE);
    if (actor.tenantId && dto.tenantId !== actor.tenantId) {
      throw new ForbiddenException('Não é permitido criar templates em outro tenant.');
    }
    await this.ensureExercises(dto.activities);
    return this.dataSource.transaction(async (manager) => {
      const template = await manager.save(WorkoutTemplate, manager.create(WorkoutTemplate, {
        ...dto,
        createdBy: actor.sub,
        updatedBy: actor.sub,
      }));
      if (dto.activities.length) {
        await manager.save(Activity, dto.activities.map((activity) => manager.create(Activity, { ...activity, workoutTemplateId: template.id })));
      }
      return this.getOneOrFail(template.id, manager);
    });
  }

  findAll(actor: JwtPayload): Promise<Array<{ id: string; name: string; description: string; exercises: string[] }>> {
    const permissions = resolvePermissions(actor.roles as Role[]);
    const query = this.templateRepo
      .createQueryBuilder('template')
      .leftJoin('template.activities', 'activity')
      .leftJoin('activity.exercise', 'exercise')
      .select('template.id', 'id')
      .addSelect('template.name', 'name')
      .addSelect('template.description', 'description')
      .addSelect("COALESCE(ARRAY_AGG(exercise.name) FILTER (WHERE exercise.name IS NOT NULL), '{}')", 'exercises')
      .groupBy('template.id')
      .addGroupBy('template.name')
      .addGroupBy('template.description')
      .orderBy('template.createdAt', 'DESC');

 
    if (!permissions.includes(Permission.WORKOUT_TEMPLATES_READ_ALL)) {
      if (permissions.includes(Permission.WORKOUT_TEMPLATES_READ_TENANT) && actor.tenantId) {
        if (permissions.includes(Permission.WORKOUT_TEMPLATES_READ)) {
          query.where('template.createdBy = :actorId', { actorId: actor.sub });
        }
      } else if (permissions.includes(Permission.WORKOUT_TEMPLATES_READ)) {
        query.where('template.createdBy = :actorId', { actorId: actor.sub });
      } else {
        throw new ForbiddenException('Você não possui permissão para acessar templates de treino.');
      }
    }

    return query.getRawMany();
  }

  async findOne(id: string, actor: JwtPayload): Promise<WorkoutTemplate> {
    const template = await this.getOneOrFail(id, this.templateRepo.manager);
    this.ensureAccess(template, actor, 'read');
    return template;
  }

  async update(id: string, dto: UpdateWorkoutTemplateDto, actor: JwtPayload): Promise<WorkoutTemplate> {
    const template = await this.getOneOrFail(id, this.templateRepo.manager);
    this.ensureAccess(template, actor, 'update');
    if (dto.activities) await this.ensureExercises(dto.activities);
    return this.dataSource.transaction(async (manager) => {
      const { tenantId: _tenantId, ...updateDto } = dto;
      await manager.save(WorkoutTemplate, Object.assign(template, updateDto, { updatedBy: actor.sub }));
      if (dto.activities) {
        await manager.delete(Activity, { workoutTemplateId: id });
        if (dto.activities.length) {
          await manager.save(Activity, dto.activities.map((activity) => manager.create(Activity, { ...activity, workoutTemplateId: id })));
        }
      }
      return this.getOneOrFail(id, manager);
    });
  }

  async remove(id: string, actor: JwtPayload): Promise<void> {
    const template = await this.getOneOrFail(id, this.templateRepo.manager);
    this.ensureAccess(template, actor, 'delete');
    await this.templateRepo.softRemove(template);
  }

  private ensureAccess(template: WorkoutTemplate, actor: JwtPayload, operation: TemplateOperation): void {
    const [own, tenant, all] = OPERATION_PERMISSIONS[operation];
    const permissions = resolvePermissions(actor.roles as Role[]);
    if (
      !permissions.includes(all) &&
      !(permissions.includes(tenant) && actor.tenantId === template.tenantId) &&
      !(permissions.includes(own) && actor.sub === template.createdBy)
    ) {
      throw new ForbiddenException('Você não possui permissão para acessar este template de treino.');
    }
  }

  private ensurePermission(actor: JwtPayload, permission: Permission): void {
    if (!resolvePermissions(actor.roles as Role[]).includes(permission)) {
      throw new ForbiddenException(`Acesso negado: permissão ausente: ${permission}`);
    }
  }

  private async ensureExercises(activities: { exerciseId: number }[]): Promise<void> {
    const exerciseIds = [...new Set(activities.map((activity) => activity.exerciseId))];
    if (!exerciseIds.length) return;
    const count = await this.exerciseRepo.countBy({ id: In(exerciseIds) });
    if (count !== exerciseIds.length) throw new NotFoundException('Um ou mais exercícios não foram encontrados.');
  }

  private async getOneOrFail(id: string, manager: EntityManager): Promise<WorkoutTemplate> {
    const template = await manager.findOne(WorkoutTemplate, {
      where: { id },
      relations: ['activities', 'activities.exercise'],
    });
    if (!template) throw new NotFoundException(`Template de treino ${id} não encontrado.`);
    return template;
  }
}