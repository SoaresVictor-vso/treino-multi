import { Type } from 'class-transformer';
import {
	IsArray,
	IsDateString,
	IsOptional,
	IsString,
	MaxLength,
	ValidateNested,
} from 'class-validator';
import { ActivityDto } from '../../workout-templates/dto/activity.dto';

export class CreateWorkoutDto {
	@IsOptional()
	@IsString()
	@MaxLength(100)
	name?: string;

	@IsOptional()
	@IsString()
	@MaxLength(255)
	description?: string;

	@IsOptional()
	@IsDateString()
	scheduledDate?: string;

	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ActivityDto)
	activities?: ActivityDto[];
}
