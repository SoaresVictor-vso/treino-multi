import { enums } from '@treino-multi/shared';
const { MetricFieldType } = enums;
type MetricFieldType = enums.MetricFieldType;
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, MaxLength } from 'class-validator';


export class CreateMetricDto {
	@ApiProperty({ example: 'repeticoes' })
	@IsString()
	@MaxLength(10)
	name!: string;

	@ApiProperty({ example: 'rep' })
	@IsString()
	@MaxLength(6)
	symbol!: string;

	@ApiProperty({ example: MetricFieldType.INT, enum: MetricFieldType })
	@IsEnum(MetricFieldType)
	fieldType!: MetricFieldType;
}
