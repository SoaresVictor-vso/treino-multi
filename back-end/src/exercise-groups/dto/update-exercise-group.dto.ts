import { OmitType, PartialType } from '@nestjs/mapped-types';
import { ArrayUnique, IsArray, IsInt, IsOptional, Min } from 'class-validator';
import { CreateExerciseGroupDto } from './create-exercise-group.dto';

export class UpdateExerciseGroupDto extends PartialType(
	OmitType(CreateExerciseGroupDto, [
		'tenantId',
		'exerciseIds',
		'metric1Id',
		'metric2Id',
	] as const),
) {
	@IsOptional()
	@IsArray()
	@ArrayUnique()
	@IsInt({ each: true })
	@Min(1, { each: true })
	exerciseIdsToAdd?: number[];

	@IsOptional()
	@IsArray()
	@ArrayUnique()
	@IsInt({ each: true })
	@Min(1, { each: true })
	exerciseIdsToRemove?: number[];
}
