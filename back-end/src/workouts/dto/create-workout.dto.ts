import { Type } from 'class-transformer';
import {
	IsArray,
	IsBoolean,
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

	/** Cria o treino diretamente em execução; permitido apenas ao próprio atleta. */
	@IsOptional()
	@IsBoolean()
	startImmediately?: boolean;

	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ActivityDto)
	activities?: ActivityDto[];
}
