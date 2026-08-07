import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsUUID } from 'class-validator';

export class CreateAthleteTrainerAssociationDto {
	@ApiProperty()
	@IsUUID()
	athleteId!: string;

	@ApiProperty()
	@IsUUID()
	trainerId!: string;

	@ApiPropertyOptional({ example: '2026-08-04' })
	@IsDateString()
	startDate!: string;
}
