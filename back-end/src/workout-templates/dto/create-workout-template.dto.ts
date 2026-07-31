import { Type } from 'class-transformer';
import { IsArray, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { ActivityDto } from './activity.dto';

export class CreateWorkoutTemplateDto {
  @IsUUID()
  tenantId!: string;

  @IsString()
  @MaxLength(150)
  name!: string;

  @IsString()
  @MaxLength(5000)
  description!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActivityDto)
  activities!: ActivityDto[];
}