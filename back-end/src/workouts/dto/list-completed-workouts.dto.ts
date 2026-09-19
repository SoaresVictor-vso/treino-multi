import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export class ListCompletedWorkoutsDto {
	@ApiPropertyOptional({
		description: 'Cursor opaco do último treino retornado na página anterior.',
	})
	@IsOptional()
	@IsString()
	cursor?: string;
}

export class ListAgendaWorkoutsDto {
	@ApiPropertyOptional({
		description: 'Cursor opaco do último treino retornado na página anterior.',
	})
	@IsOptional()
	@IsString()
	cursor?: string;
}

export class ListCompletedWorkoutsCalendarDto {
	@ApiPropertyOptional({ enum: ['week', 'month'], default: 'week' })
	@IsOptional()
	@IsIn(['week', 'month'])
	period?: 'week' | 'month';

	@ApiPropertyOptional({
		example: '2026-09-06',
		description: 'Data que determina a semana ou o mês retornado.',
	})
	@IsOptional()
	@IsDateString()
	date?: string;
}

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
