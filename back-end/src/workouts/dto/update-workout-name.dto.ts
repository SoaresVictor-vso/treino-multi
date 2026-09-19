import { IsString, MaxLength } from 'class-validator';

export class UpdateWorkoutNameDto {
	@IsString()
	@MaxLength(100)
	name!: string;
}
