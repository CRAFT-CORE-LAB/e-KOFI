import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from './app.module';

const ENV_KEYS = [
  'JWT_SECRET',
  'CARD_TOKEN_PEPPER',
  'PUBLIC_API_URL',
  'NODE_ENV',
  'INTOUCH_ENV',
  'INTOUCH_USERNAME',
  'INTOUCH_ACCOUNT_NO',
  'INTOUCH_PARTNER_PASSWORD',
  'INTOUCH_CALLBACK_URL',
  'INTOUCH_BASE_URL',
  'PIN_MAX_ATTEMPTS',
  'PIN_LOCK_MINUTES',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_BUSINESS_ACCOUNT_ID',
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_VERIFY_TOKEN',
  'WHATSAPP_APP_SECRET',
  'WHATSAPP_GRAPH_VERSION',
  'WHATSAPP_TEMPLATE_SUCCESS',
  'WHATSAPP_TEMPLATE_FAILED',
  'WHATSAPP_TEMPLATE_LANG',
  'WHATSAPP_SESSION_MINUTES',
  'SHAKA_BRIDGE_URL',
  'SHAKA_BRIDGE_SECRET',
  'OPENAI_API_KEY',
  'OPENAI_MODEL',
] as const;

function applyEnv(env: CloudflareEnv): void {
  (globalThis as { __EKOF_D1?: CloudflareEnv['DB'] }).__EKOF_D1 = env.DB;
  for (const key of ENV_KEYS) {
    const value = env[key];
    if (typeof value === 'string' && value.length > 0) {
      process.env[key] = value;
    }
  }
}

let starting: Promise<void> | undefined;

export async function boot(env: CloudflareEnv): Promise<void> {
  applyEnv(env);
  if (!starting) {
    starting = (async () => {
      const server = express();
      const app = await NestFactory.create(AppModule, new ExpressAdapter(server), { rawBody: true });
      app.setGlobalPrefix('api');
      app.enableCors({ origin: true, credentials: true });
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          transform: true,
          forbidNonWhitelisted: true,
        }),
      );
      await app.listen(3000);
    })().catch((error) => {
      starting = undefined;
      throw error;
    });
  }
  await starting;
}
