import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

const repositoryUrl = 'https://github.com/truesentry/StudyFlow';

export function createOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('StudyFlow Projects API')
    .setVersion('1.0.0')
    .setDescription('Create, read, update and delete study projects. Projects routes are public; the Bearer scheme is declared for future use.')
    .addServer('/', 'The host serving this API')
    .addTag('Projects', 'Manage study projects.')
    .setExternalDoc('Practical assignment source code on GitHub', repositoryUrl)
    .addSecurity('bearerAuth', { type: 'http', scheme: 'bearer', description: 'Reserved for future protected endpoints. Projects routes do not require a token.' })
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Document canonical routes only; the old path remains an alias.
  for (const path of Object.keys(document.paths)) {
    if (path.startsWith('/projects')) delete document.paths[path];
  }

  // Validation forbids extra request fields; serialization exposes only declared response fields.
  for (const name of ['CreateProjectDto', 'UpdateProjectDto', 'ProjectResponseDto', 'HttpErrorResponseDto', 'AddMembershipDto', 'ProjectPageDto', 'ProjectPageMetaDto', 'MembershipResponseDto']) {
    const schema = document.components?.schemas?.[name];
    if (!schema || '$ref' in schema) throw new Error(`Missing OpenAPI schema: ${name}`);
    schema.additionalProperties = false;
    if (name === 'UpdateProjectDto') schema.minProperties = 1;
  }

  // An explicit empty requirement describes the existing public endpoints.
  document.security = [];
  return document;
}

export function setupOpenApi(app: INestApplication): void {
  SwaggerModule.setup('docs', app, () => createOpenApiDocument(app), {
    jsonDocumentUrl: 'openapi.json',
    raw: ['json'],
    customSiteTitle: 'StudyFlow API documentation',
  });
}
