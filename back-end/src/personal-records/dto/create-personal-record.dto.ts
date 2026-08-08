import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	IsDateString,
	IsInt,
	IsNumber,
	IsOptional,
	IsUUID,
	Min,
} from 'class-validator';

export class CreatePersonalRecordDto {
	@ApiProperty({ format: 'uuid' })
	@IsUUID()
	athleteId!: string;

	@ApiProperty({ example: 1, required: false, nullable: true })
	@IsOptional()
	@IsInt()
	@Min(1)
	exerciseGroupId?: number | null;

	@ApiProperty({ example: 1, required: false, nullable: true })
	@IsOptional()
	@IsInt()
	@Min(1)
	exerciseId?: number | null;

	@ApiProperty({ example: 100 })
	@Type(() => Number)
	@IsNumber({ maxDecimalPlaces: 3 })
	@Min(0.001)
	value!: number;

	@ApiProperty({ example: '2026-08-08' })
	@IsDateString()
	measuredAt!: string;
}
