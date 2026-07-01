import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS configuration
  app.enableCors({
    origin: 'http://localhost:3000',
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
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT',
    )
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
