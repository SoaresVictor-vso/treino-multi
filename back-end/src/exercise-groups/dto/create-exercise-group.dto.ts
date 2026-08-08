import { ApiProperty } from '@nestjs/swagger';
import {
	ArrayNotEmpty,
	ArrayUnique,
	IsArray,
	IsInt,
	IsOptional,
	IsString,
	IsUUID,
	Length,
	Min,
} from 'class-validator';

export class CreateExerciseGroupDto {
	@ApiProperty({ example: 'Supino' })
	@IsString()
	@Length(1, 80)
	name!: string;

	@ApiProperty({ format: 'uuid', required: false })
	@IsOptional()
	@IsUUID()
	tenantId?: string;

	@ApiProperty({ example: 1 })
	@IsInt()
	@Min(1)
	metric1Id!: number;

	@ApiProperty({ example: 2, required: false, nullable: true })
	@IsOptional()
	@IsInt()
	@Min(1)
	metric2Id?: number | null;

	@ApiProperty({ example: [1, 2, 3], type: [Number] })
	@IsArray()
	@ArrayNotEmpty()
	@ArrayUnique()
	@IsInt({ each: true })
	@Min(1, { each: true })
	exerciseIds!: number[];
}
