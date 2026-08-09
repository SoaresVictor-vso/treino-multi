import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	ArrayMinSize,
	IsArray,
	IsDateString,
	IsOptional,
	IsUUID,
} from 'class-validator';

export class GenerateWorkoutsFromTemplateDto {
	@ApiProperty({ type: [String] })
	@IsArray()
	@ArrayMinSize(1)
	@IsUUID('4', { each: true })
	athleteIds!: string[];

	@ApiProperty()
	@IsUUID()
	templateId!: string;

	@ApiPropertyOptional({ example: '2026-08-10' })
	@IsOptional()
	@IsDateString()
	scheduledDate?: string;
}
