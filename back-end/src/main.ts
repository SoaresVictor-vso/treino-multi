import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { config as loadEnv } from 'dotenv';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { getTrustedOrigins } from './common/security/trusted-origin';

async function bootstrap() {
	// Load .env before importing modules that consume shared deployment constants.
	loadEnv();
	const { AppModule } = await import('./app.module.js');
	const app = await NestFactory.create(AppModule);
	const trustedOrigins = getTrustedOrigins();

	// Reject browser requests from origins outside the exact credentialed CORS allow-list.
	app.use((req, res, next) => {
		const origin = req.headers.origin;
		if (origin && !trustedOrigins.includes(origin))
			return res.status(403).json({ statusCode: 403, message: 'Origem não autorizada.' });
		if (!origin && req.headers['sec-fetch-site'] === 'cross-site')
			return res.status(403).json({ statusCode: 403, message: 'Origem não autorizada.' });
		next();
	});

	// CORS configuration
	app.enableCors({
		origin: trustedOrigins,
		credentials: true,
	});

	// Validação global de DTOs
	app.useGlobalPipes(
		new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
	);
	app.useGlobalFilters(new HttpExceptionFilter());

	// ── Swagger ──────────────────────────────────────────────────────────────
	const config = new DocumentBuilder()
		.setTitle('Multi-Tenant Auth API')
		.setDescription(
			'Boilerplate de autenticação multi-tenant com suporte a múltiplos ' +
				'contextos (organização, tenant, standalone). ' +
				'Utilize o botão **Authorize** para inserir o Bearer token JWT ' +
				'obtido no endpoint POST /auth/login.',
		)
		.setVersion('1.0')
		.addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT')
		.addTag('auth', 'Autenticação, refresh de token e impersonation')
		.addTag('persons', 'CRUD de pessoas físicas')
		.addTag('users', 'CRUD de usuários (vínculo Person ↔ contexto)')
		.addTag('tenants', 'CRUD de tenants (empresas clientes)')
		.addTag('roles', 'Mapa readonly de roles e permissões')
		.addTag('audit-logs', 'Consulta de logs de auditoria (restrito a org:admin)')
		.build();

	const document = SwaggerModule.createDocument(app, config);
	SwaggerModule.setup('api/docs', app, document, {
		swaggerOptions: { persistAuthorization: true },
	});
	// ─────────────────────────────────────────────────────────────────────────

	await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
