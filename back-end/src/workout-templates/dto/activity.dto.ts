import { Type } from 'class-transformer';
import {
	IsIn,
	IsInt,
	IsNumber,
	IsOptional,
	IsString,
	MaxLength,
	Min,
} from 'class-validator';

export class ActivityDto {
	@IsInt()
	@Min(1)
	exerciseId!: number;

	@IsOptional()
	@IsNumber()
	metric1?: number;

	@IsOptional()
	@IsNumber()
	metric2?: number;

	@IsIn(['v'])
	type1!: 'v';

	@IsOptional()
	@IsIn(['p', 'v'])
	type2?: 'p' | 'v';

	@IsNumber()
	pse!: number;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	restDuration?: number;

	@IsOptional()
	@IsString()
	@MaxLength(2000)
	note?: string;
}
