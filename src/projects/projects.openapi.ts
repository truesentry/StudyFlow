import { applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { HttpErrorResponseDto } from '../common/http-error-response.dto';
import { ProjectResponseDto } from './dto/project-response.dto';
import { ProjectStatus } from './projects.repository';

export const createProjectExample = {
  name: 'StudyFlow',
  description: 'Система керування навчальними проєктами',
  status: ProjectStatus.Active,
};

export const updateProjectExample = { status: ProjectStatus.Completed };

const projectExample = {
  id: 10,
  ...createProjectExample,
  createdAt: '2026-09-23T10:00:00.000Z',
};

export function ApiProjectResult(status: 200 | 201, kind: 'created' | 'list' | 'found' | 'updated') {
  const descriptions = {
    created: 'The project was created.',
    list: 'Projects ordered by ascending ID. An empty list is returned when there are no projects.',
    found: 'The requested project.',
    updated: 'The project after applying the supplied changes.',
  };
  const schema = { $ref: getSchemaPath(ProjectResponseDto) };
  const example = kind === 'list' ? [projectExample]
    : kind === 'updated' ? { ...projectExample, ...updateProjectExample }
    : projectExample;

  return applyDecorators(
    ApiExtraModels(ProjectResponseDto),
    ApiResponse({
      status,
      description: descriptions[kind],
      content: { 'application/json': { schema: kind === 'list' ? { type: 'array', items: schema } : schema, example } },
    }),
  );
}

const errorExamples = {
  VALIDATION_ERROR: 'name must be longer than or equal to 3 characters',
  INVALID_PROJECT_ID: 'Project id must be a positive safe integer',
  PROJECT_NOT_FOUND: 'Project with id 10 was not found',
  PROJECT_NAME_CONFLICT: 'Project with this name already exists',
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
              path: errorCode === 'INVALID_PROJECT_ID' ? '/projects/abc' : path,
              timestamp: projectExample.createdAt,
              traceId: '550e8400-e29b-41d4-a716-446655440000',
            },
          }])),
        },
      },
    }),
  );
}
