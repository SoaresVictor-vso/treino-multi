import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class EndAthleteTrainerAssociationDto {
	@ApiPropertyOptional({ example: '2026-08-04' })
	@IsOptional()
	@IsDateString()
	endDate?: string;
}
