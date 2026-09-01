import { Type } from 'class-transformer';
import {
	IsArray,
	IsEnum,
	IsInt,
	IsNumber,
	IsOptional,
	IsString,
	MaxLength,
	Min,
	ValidateNested,
} from 'class-validator';
import { ExecutionStatus } from '../../common/enums/execution-status.enum';

export class UpdateWorkoutExecutionDto {
	@IsOptional() @IsInt() id?: number;
	@IsInt() exerciseId!: number;
	@IsInt() @Min(1) position!: number;
	@IsOptional() @IsNumber() prescribedMetric1?: number | null;
	@IsOptional() @IsNumber() prescribedMetric2?: number | null;
	@IsOptional() @IsNumber() prescribedPse?: number | null;
	@IsOptional() @IsInt() prescribedRestDuration?: number | null;
	@IsOptional() @IsNumber() performedMetric1?: number | null;
	@IsOptional() @IsNumber() performedMetric2?: number | null;
	@IsOptional() @IsNumber() performedPse?: number | null;
	@IsOptional() @IsInt() performedRestDuration?: number | null;
	@IsOptional() @IsString() performedNote?: string | null;
	@IsOptional() @IsEnum(ExecutionStatus) status?: ExecutionStatus;
}

export class UpdateWorkoutExerciseNoteDto {
	@IsInt()
	@Min(1)
	exerciseId!: number;

	@IsOptional()
	@IsString()
	@MaxLength(2000)
	athleteNote?: string | null;
}

export class UpdateWorkoutExecutionsDto {
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => UpdateWorkoutExecutionDto)
	executions!: UpdateWorkoutExecutionDto[];

	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => UpdateWorkoutExerciseNoteDto)
	exerciseNotes?: UpdateWorkoutExerciseNoteDto[];
}
