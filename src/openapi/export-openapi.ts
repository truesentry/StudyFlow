import 'reflect-metadata';
import { writeFile } from 'node:fs/promises';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { createOpenApiDocument } from './openapi';

async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  try {
    await writeFile('openapi.json', JSON.stringify(createOpenApiDocument(app), null, 2) + '\n');
  } finally {
    await app.close();
  }
}

void main();
