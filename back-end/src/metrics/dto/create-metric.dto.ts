import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, MaxLength } from 'class-validator';
import { MetricFieldType } from '../../common/enums/metric-field-type.enum';

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
