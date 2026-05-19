import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token de redefinição de senha (JWT 30 min)' })
  @IsString()
  token: string;

  @ApiProperty({ example: 'NovaSenha@Segura123', minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
