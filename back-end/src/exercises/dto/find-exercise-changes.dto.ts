import { IsDateString } from 'class-validator';

export class FindExerciseChangesDto {
  @IsDateString()
  since!: string;
}