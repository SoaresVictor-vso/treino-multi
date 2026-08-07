import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsDateString, IsUUID } from 'class-validator';

export class CreateAthleteTrainerAssociationsDto {
	@ApiProperty({ type: [String] })
	@IsArray()
	@ArrayMinSize(1)
	@IsUUID('4', { each: true })
	athleteIds!: string[];

	@ApiProperty()
	@IsUUID()
	trainerId!: string;

	@ApiProperty({ example: '2026-08-04' })
	@IsDateString()
	startDate!: string;
}
