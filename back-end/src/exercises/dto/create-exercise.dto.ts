import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUrl, MaxLength, Min } from 'class-validator';

export class CreateExerciseDto {
  @ApiProperty({ example: 'Agachamento livre' })
  @IsString()
  @MaxLength(50)
  name!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  metric1Id!: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  metric2Id?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  @MaxLength(100)
  visualUrl?: string;
}