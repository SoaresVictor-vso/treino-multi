import { enums } from '@treino-multi/shared';
const { ExecutionSetType } = enums;
type ExecutionSetType = enums.ExecutionSetType;
import { Type } from 'class-transformer';
import {
	IsArray,
	IsBoolean,
	IsDateString,
	IsInt,
	IsEnum,
	IsOptional,
	IsString,
	MaxLength,
	Min,
	ValidateNested,
} from 'class-validator';
import { ActivityDto } from '../../workout-templates/dto/activity.dto';


class WorkoutActivityDto extends ActivityDto {
	@IsEnum(ExecutionSetType)
	setType!: ExecutionSetType;
}

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
	scheduledDate?: string | null;

	/** Cria o treino diretamente em execução; permitido apenas ao próprio atleta. */
	@IsOptional()
	@IsBoolean()
	startImmediately?: boolean;

	/** Registra como concluído um treino realizado em data passada. */
	@IsOptional()
	@IsBoolean()
	recordAsCompleted?: boolean;

	/** Instante local convertido pelo cliente para UTC, para registrar à meia-noite do atleta. */
	@IsOptional()
	@IsDateString()
	performedAt?: string;

	@IsOptional()
	@IsInt()
	@Min(1)
	durationSeconds?: number;

	@IsOptional()
	@IsString()
	clientTimeZone?: string;

	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => WorkoutActivityDto)
	activities?: WorkoutActivityDto[];
}
