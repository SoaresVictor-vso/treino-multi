import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class UpdateWorkoutScheduleDto {
	@ApiProperty({ example: '2026-09-21' })
	@IsDateString()
	scheduledDate!: string;
}
