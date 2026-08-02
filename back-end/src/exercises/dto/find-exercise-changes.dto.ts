import { IsDateString, IsOptional, ValidateIf } from 'class-validator';

export class FindExerciseChangesDto {
	@IsOptional()
	@ValidateIf(
		({ since }) =>
			typeof since === 'string' && since.trim() !== '' && since !== 'null',
	)
	@IsDateString()
	since?: string | null;
}
