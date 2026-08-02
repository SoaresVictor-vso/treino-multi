import { PartialType } from '@nestjs/mapped-types';
import { CreateWorkoutTemplateDto } from './create-workout-template.dto';

export class UpdateWorkoutTemplateDto extends PartialType(
	CreateWorkoutTemplateDto,
) {}
