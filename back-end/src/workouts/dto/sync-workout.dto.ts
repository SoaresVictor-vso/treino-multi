import { enums } from '@treino-multi/shared';
import { Type } from 'class-transformer';
import {
  IsArray, IsDateString, IsEnum, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUUID,
  MaxLength, Min, ValidateNested,
} from 'class-validator';

const { ExecutionStatus, ExecutionSetType, WorkoutStatus } = enums;

export class SyncExecutionDto {
  @IsOptional() @IsInt() @Min(1) id?: number;
  @IsInt() @Min(1) exerciseId!: number;
  @IsInt() @Min(1) position!: number;
  @IsOptional() @IsIn(['v', 'p']) metric2Type?: 'v' | 'p' | null;
  @IsOptional() @IsInt() prescribedRestDuration?: number | null;
  @IsOptional() @IsInt() performedRestDuration?: number | null;
  @IsOptional() @IsNumber() prescribedMetric1?: number | null;
  @IsOptional() @IsNumber() prescribedMetric2?: number | null;
  @IsOptional() @IsNumber() prescribedPse?: number | null;
  @IsOptional() @IsNumber() performedMetric1?: number | null;
  @IsOptional() @IsNumber() performedMetric2?: number | null;
  @IsOptional() @IsNumber() performedPse?: number | null;
  @IsOptional() @IsString() performedNote?: string | null;
  @IsOptional() @IsEnum(ExecutionSetType) setType?: enums.ExecutionSetType;
  @IsOptional() @IsObject() adherenceSnapshot?: { prescribedMetric1: number | null; prescribedMetric2: number | null; prescribedPse: number | null; prescribedRestDuration: number | null } | null;
  @IsEnum(ExecutionStatus) status!: enums.ExecutionStatus;
  @IsOptional() @IsDateString() startedAt?: string | null;
  @IsOptional() @IsDateString() finishedAt?: string | null;
}

export class SyncWorkoutNoteDto {
  @IsInt() @Min(1) exerciseId!: number;
  @IsOptional() @IsString() @MaxLength(2000) athleteNote?: string | null;
}

export class SyncWorkoutDto {
  @IsUUID() operationId!: string;
  @IsUUID() id!: string;
  @IsOptional() @IsInt() @Min(0) baseRevision?: number;
  @IsOptional() @IsIn(['force', 'copy']) resolution?: 'force' | 'copy';
  @IsString() @MaxLength(100) templateName!: string;
  @IsOptional() @IsString() @MaxLength(255) templateDescription?: string;
  @IsOptional() @IsDateString() scheduledDate?: string | null;
  @IsOptional() @IsDateString() performedAt?: string | null;
  @IsOptional() @IsDateString() finishedAt?: string | null;
  @IsEnum(WorkoutStatus) status!: enums.WorkoutStatus;
  @IsArray() @ValidateNested({ each: true }) @Type(() => SyncExecutionDto)
  executions!: SyncExecutionDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => SyncWorkoutNoteDto)
  exerciseNotes?: SyncWorkoutNoteDto[];
}
