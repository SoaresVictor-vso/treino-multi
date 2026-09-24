import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { Person } from '../persons/entities/person.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.entity';
import { RefreshToken } from '../users/entities/refresh-token.entity';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { UsersModule } from '../users/users.module';
import { SessionFamily } from './entities/session-family.entity';
import { ExternalIdentity } from './entities/external-identity.entity';
import { GoogleIdTokenProvider } from './oauth-providers/google-id-token';

@Module({
	imports: [
		PassportModule,
		AuditLogsModule,
		UsersModule,
		TypeOrmModule.forFeature([Person, User, UserRole, RefreshToken, SessionFamily, ExternalIdentity]),
		JwtModule.registerAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: (config: ConfigService) => ({
				secret: config.get<string>('JWT_SECRET'),
				signOptions: { expiresIn: '15m' },
			}),
		}),
	],
	controllers: [AuthController],
	providers: [AuthService, LocalStrategy, JwtStrategy, GoogleIdTokenProvider],
	exports: [AuthService],
})
export class AuthModule {}
