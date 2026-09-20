import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class ListWorkoutsCalendarDto {
	@ApiPropertyOptional({ example: '2026-09-01' })
	@IsOptional()
	@IsDateString()
	date?: string;

	@ApiPropertyOptional({ example: 'America/Sao_Paulo' })
	@IsOptional()
	@IsString()
	timeZone?: string;
}
