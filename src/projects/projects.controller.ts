import { ApiBody, ApiNoContentResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
  BadRequestException, Body, Controller, Delete, Get, HttpCode,
  HttpStatus, Param, ParseIntPipe, Patch, Post, SerializeOptions,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectResponseDto } from './dto/project-response.dto';

import { ApiProjectError, ApiProjectResult, createProjectExample, updateProjectExample } from './projects.openapi';

const projectIdParameter = {
  name: 'id',
  description: 'Positive safe integer project ID.',
  schema: { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER, example: 10 },
};

const projectIdPipe = new ParseIntPipe({
  exceptionFactory: () => new BadRequestException({
    errorCode: 'INVALID_PROJECT_ID',
    message: 'Project id must be a positive safe integer',
  }),
});

@ApiTags('Projects')
@Controller('projects')
@SerializeOptions({ type: ProjectResponseDto })
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @ApiOperation({ summary: 'Create a project', operationId: 'createProject' })
  @ApiBody({ type: CreateProjectDto, examples: { activeProject: { value: createProjectExample } } })
  @ApiProjectResult(201, 'created')
  @ApiProjectError(400, '/projects', 'Invalid JSON or request fields.', 'VALIDATION_ERROR')
  @ApiProjectError(409, '/projects', 'The name is already in use.', 'PROJECT_NAME_CONFLICT')
  @ApiProjectError(500, '/projects', 'Unexpected server error.', 'INTERNAL_SERVER_ERROR')
  @Post()
  create(@Body() input: CreateProjectDto): Promise<ProjectResponseDto> {
    return this.projects.create(input);
  }

  @ApiOperation({ summary: 'List projects', operationId: 'listProjects' })
  @ApiProjectResult(200, 'list')
  @ApiProjectError(500, '/projects', 'Unexpected server error.', 'INTERNAL_SERVER_ERROR')
  @Get()
  findAll(): Promise<ProjectResponseDto[]> {
    return this.projects.findAll();
  }

  @ApiOperation({ summary: 'Get a project by ID', operationId: 'getProject' })
  @ApiProjectResult(200, 'found')
  @ApiProjectError(400, '/projects/10', 'Invalid project ID.', 'INVALID_PROJECT_ID')
  @ApiParam(projectIdParameter)
  @ApiProjectError(404, '/projects/10', 'Project not found.', 'PROJECT_NOT_FOUND')
  @ApiProjectError(500, '/projects/10', 'Unexpected server error.', 'INTERNAL_SERVER_ERROR')
  @Get(':id')
  findOne(@Param('id', projectIdPipe) id: number): Promise<ProjectResponseDto> {
    return this.projects.findOne(id);
  }

  @ApiOperation({ summary: 'Partially update a project', operationId: 'updateProject' })
  @ApiBody({ type: UpdateProjectDto, examples: { completeProject: { value: updateProjectExample } } })
  @ApiProjectResult(200, 'updated')
  @ApiProjectError(400, '/projects/10', 'Invalid project ID, JSON or request fields.', 'INVALID_PROJECT_ID', 'VALIDATION_ERROR')
  @ApiProjectError(409, '/projects/10', 'The name is already in use by another project.', 'PROJECT_NAME_CONFLICT')
  @ApiParam(projectIdParameter)
  @ApiProjectError(404, '/projects/10', 'Project not found.', 'PROJECT_NOT_FOUND')
  @ApiProjectError(500, '/projects/10', 'Unexpected server error.', 'INTERNAL_SERVER_ERROR')
  @Patch(':id')
  update(@Param('id', projectIdPipe) id: number, @Body() input: UpdateProjectDto): Promise<ProjectResponseDto> {
    return this.projects.update(id, input);
  }

  @ApiOperation({ summary: 'Delete a project', operationId: 'deleteProject' })
  @ApiNoContentResponse({ description: 'Project deleted. No response body.' })
  @ApiProjectError(400, '/projects/10', 'Invalid project ID.', 'INVALID_PROJECT_ID')
  @ApiParam(projectIdParameter)
  @ApiProjectError(404, '/projects/10', 'Project not found.', 'PROJECT_NOT_FOUND')
  @ApiProjectError(500, '/projects/10', 'Unexpected server error.', 'INTERNAL_SERVER_ERROR')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', projectIdPipe) id: number): Promise<void> {
    return this.projects.remove(id);
  }
}
