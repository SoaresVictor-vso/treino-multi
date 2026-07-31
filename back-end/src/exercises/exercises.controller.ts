import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { Permission } from '../common/enums/permission.enum';
import { FindExerciseChangesDto } from './dto/find-exercise-changes.dto';
import { ExercisesService } from './exercises.service';

@ApiTags('exercises')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('exercises')
export class ExercisesController {
  constructor(private readonly exercisesService: ExercisesService) {}

  @ApiOperation({ summary: 'Lista todos os exercícios ativos' })
  @ApiResponse({ status: 200, description: 'Lista de exercícios não removidos' })
  @RequirePermissions(Permission.EXERCISES_READ)
  @Get()
  findAll() {
    return this.exercisesService.findAll();
  }

  @ApiOperation({ summary: 'Lista alterações de exercícios desde uma data' })
  @ApiQuery({ name: 'since', type: String, format: 'date-time', required: true })
  @RequirePermissions(Permission.EXERCISES_READ)
  @Get('sync')
  findChanges(@Query() { since }: FindExerciseChangesDto) {
    return this.exercisesService.findChangesSince(new Date(since));
  }
}