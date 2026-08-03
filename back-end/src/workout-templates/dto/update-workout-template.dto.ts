import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { CreateWorkoutTemplateDto } from './create-workout-template.dto';
import { UpdateActivityDto } from './activity.dto';

export class UpdateWorkoutTemplateDto extends PartialType(
	CreateWorkoutTemplateDto,
) {
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => UpdateActivityDto)
	declare activities?: UpdateActivityDto[];
}
