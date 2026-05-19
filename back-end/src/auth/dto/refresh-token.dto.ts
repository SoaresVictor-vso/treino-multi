import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token obtido no login', example: 'abc123...' })
  @IsString()
  refreshToken: string;
}
