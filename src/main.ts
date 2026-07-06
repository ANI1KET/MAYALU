import 'dotenv/config'; // ← MUST be first — loads .env before any other module runs
import 'reflect-metadata';
import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger, VersioningType, BadRequestException } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { validateConfig } from './config/app.config';
import { AuthGuard } from './common/guards/auth.guard';
import { JwtService } from './common/services/jwt.service';

async function bootstrap(): Promise<void> {
  // ── Validate env first — fail fast with clear errors ──────────────
  const config = validateConfig(process.env as NodeJS.ProcessEnv);
  const logger = new Logger('Bootstrap');
  const isProd = config.NODE_ENV === 'production';

  const app = await NestFactory.create(AppModule, {
    logger: isProd
      ? ['error', 'warn', 'log']
      : ['error', 'warn', 'log', 'debug', 'verbose'],
    bufferLogs: true,
  });

  // ── Global prefix ─────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1', {
    exclude: ['/health'],
  });

  // ── Security middleware ───────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: isProd,
      hsts: isProd
        ? { maxAge: 31_536_000, includeSubDomains: true }
        : false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // ── CORS ──────────────────────────────────────────────────────────
  app.enableCors({
    origin: config.CORS_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Admin-Key',
      'Cookie',
    ],
    exposedHeaders: ['Set-Cookie'],
  });

  // ── Middleware ────────────────────────────────────────────────────
  app.use(cookieParser());
  app.use(compression());

  // ── Global validation pipe ────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,            // strip unknown fields
      forbidNonWhitelisted: true, // 400 on unknown fields
      transform: true,            // auto-transform primitives
      transformOptions: { enableImplicitConversion: true },
      stopAtFirstError: false,    // return ALL errors at once
      // Surface field-level errors so the exception filter can include them
      exceptionFactory: (errors) => {
        const messages = errors.flatMap((e) =>
          Object.values(e.constraints ?? {}).map((msg) => ({
            field: e.property,
            message: msg,
          })),
        );
        const first = messages[0];
        return new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: first
            ? `${first.field}: ${first.message}`
            : 'Validation failed',
          errors: messages,
        });
      },
    }),
  );

  // ── Global auth guard (Public() decorator bypasses it) ────────────
  const reflector = app.get(Reflector);
  const jwtService = app.get(JwtService);
  app.useGlobalGuards(new AuthGuard(jwtService, reflector));

  // ── Health check endpoint ─────────────────────────────────────────
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/health', (_req: unknown, res: { json: (o: object) => void }) => {
    res.json({ status: 'ok', env: config.NODE_ENV, ts: new Date().toISOString() });
  });

  // ── Swagger (development + staging only) ─────────────────────────
  if (!isProd) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Mayalu Wears API')
      .setDescription(
        [
          '**Nepal Fashion Commerce Platform** — Multi-vendor marketplace API.',
          '',
          '## Authentication',
          'Use `POST /auth/otp/send` → `POST /auth/otp/verify` to receive **HttpOnly cookies**.',
          'For Swagger testing, paste the `access_token` cookie value in the BearerAuth field.',
          '',
          '## Admin',
          'Include `X-Admin-Key: <your-key>` header on admin routes.',
        ].join('\n'),
      )
      .setVersion('1.0.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Paste access_token cookie value' },
        'BearerAuth',
      )
      .addCookieAuth('access_token', {
        type: 'apiKey',
        in: 'cookie',
        name: 'access_token',
      })
      .addApiKey(
        { type: 'apiKey', in: 'header', name: 'X-Admin-Key', description: 'Admin secret key' },
        'X-Admin-Key',
      )
      .addServer(`http://localhost:${config.PORT}`, 'Local Development')
      .addServer('https://api.mayaluwears.com', 'Production')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      jsonDocumentUrl: 'api/docs-json',
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
        docExpansion: 'none',
        filter: true,
        showRequestDuration: true,
      },
    });

    logger.log(`📚 Swagger UI   → http://localhost:${config.PORT}/api/docs`);
    logger.log(`📄 OpenAPI JSON → http://localhost:${config.PORT}/api/docs-json`);
  }

  await app.listen(config.PORT, '0.0.0.0');

  logger.log(`🚀 Mayalu Wears API ready on http://0.0.0.0:${config.PORT}/api/v1`);
  logger.log(`🌍 Environment: ${config.NODE_ENV}`);
  logger.log(`❤️  Health: http://localhost:${config.PORT}/health`);
}

void bootstrap();
