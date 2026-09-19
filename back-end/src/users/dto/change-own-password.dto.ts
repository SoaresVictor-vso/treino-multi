import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangeOwnPasswordDto {
	@ApiProperty({ example: 'SenhaAtual@123' })
	@IsString()
	currentPassword!: string;

	@ApiProperty({ example: 'NovaSenha@123' })
	@IsString()
	@MinLength(8)
	newPassword!: string;
}
