import { applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { HttpErrorResponseDto } from '../common/http-error-response.dto';
import { ProjectResponseDto } from './dto/project-response.dto';
import { ProjectPageDto } from './dto/project-page.dto';
import { ProjectStatus } from './projects.repository';

export const createProjectExample = {
  name: 'StudyFlow',
  description: 'Система керування навчальними проєктами',
  status: ProjectStatus.Active,
  ownerId: 1,
};

export const updateProjectExample = { status: ProjectStatus.Completed };

const projectExample = {
  id: 10,
  name: createProjectExample.name,
  description: createProjectExample.description,
  status: createProjectExample.status,
  createdAt: '2026-09-23T10:00:00.000Z',
};

export function ApiProjectResult(status: 200 | 201, kind: 'created' | 'list' | 'found' | 'updated') {
  const descriptions = {
    created: 'The project was created.',
    list: 'Filtered project page and navigation metadata. Out-of-range pages have empty data.',
    found: 'The requested project.',
    updated: 'The project after applying the supplied changes.',
  };
  const schema = { $ref: getSchemaPath(ProjectResponseDto) };
  const example = kind === 'list' ? {
    data: [projectExample],
    meta: { page: 1, size: 10, total: 1, totalPages: 1, hasNextPage: false, hasPreviousPage: false },
  }
    : kind === 'updated' ? { ...projectExample, ...updateProjectExample }
    : projectExample;

  return applyDecorators(
    ApiExtraModels(ProjectResponseDto, ProjectPageDto),
    ApiResponse({
      status,
      description: descriptions[kind],
      content: { 'application/json': { schema: kind === 'list' ? { $ref: getSchemaPath(ProjectPageDto) } : schema, example } },
    }),
  );
}

const errorExamples = {
  VALIDATION_ERROR: 'name must be longer than or equal to 3 characters',
  INVALID_PROJECT_ID: 'Project id must be a positive safe integer',
  PROJECT_NOT_FOUND: 'Project with id 10 was not found',
  PROJECT_NAME_CONFLICT: 'Project with this name already exists',
  OWNER_NOT_FOUND: 'User with id 999 was not found',
  MEMBERSHIP_ALREADY_EXISTS: 'Користувач уже є учасником проєкту',
  MEMBERSHIP_REFERENCE_NOT_FOUND: 'Project or user was not found',
  INTERNAL_SERVER_ERROR: 'Internal server error',
};

export function ApiProjectError(
  status: 400 | 404 | 409 | 500,
  path: string,
  description: string,
  ...codes: Array<keyof typeof errorExamples>
) {
  return applyDecorators(
    ApiExtraModels(HttpErrorResponseDto),
    ApiResponse({
      status,
      description,
      headers: { 'X-Trace-Id': { description: 'Matches traceId in the response body.', schema: { type: 'string', format: 'uuid' } } },
      content: {
        'application/json': {
          schema: { $ref: getSchemaPath(HttpErrorResponseDto) },
          examples: Object.fromEntries(codes.map((errorCode) => [errorCode, {
            value: {
              statusCode: status, errorCode, message: errorExamples[errorCode],
              path: errorCode === 'INVALID_PROJECT_ID' ? '/api/projects/abc' : path,
              timestamp: projectExample.createdAt,
              traceId: '550e8400-e29b-41d4-a716-446655440000',
            },
          }])),
        },
      },
    }),
  );
}
