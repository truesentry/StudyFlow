import { ApiBody, ApiCreatedResponse, ApiNoContentResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
  BadRequestException, Body, Controller, Delete, Get, HttpCode,
  HttpStatus, Param, ParseIntPipe, Patch, Post, Query, SerializeOptions,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddMembershipDto, MembershipResponseDto } from './dto/add-membership.dto';
import { ListProjectsDto } from './dto/list-projects.dto';
import { ProjectPageDto } from './dto/project-page.dto';
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
@Controller(['api/projects', 'projects'])
@SerializeOptions({ type: ProjectResponseDto })
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @ApiOperation({ summary: 'Create a project', operationId: 'createProject' })
  @ApiBody({ type: CreateProjectDto, examples: { activeProject: { value: createProjectExample } } })
  @ApiProjectResult(201, 'created')
  @ApiProjectError(400, '/api/projects', 'Invalid JSON or request fields.', 'VALIDATION_ERROR')
  @ApiProjectError(404, '/api/projects', 'Owner does not exist.', 'OWNER_NOT_FOUND')
  @ApiProjectError(409, '/api/projects', 'Project name or membership conflict.', 'PROJECT_NAME_CONFLICT', 'MEMBERSHIP_ALREADY_EXISTS')
  @ApiProjectError(500, '/api/projects', 'Unexpected server error.', 'INTERNAL_SERVER_ERROR')
  @Post()
  create(@Body() input: CreateProjectDto): Promise<ProjectResponseDto> {
    return this.projects.create(input);
  }

  @ApiOperation({ summary: 'List projects', operationId: 'listProjects' })
  @ApiProjectResult(200, 'list')
  @ApiProjectError(400, '/api/projects?page=0', 'Invalid query parameters.', 'VALIDATION_ERROR')
  @SerializeOptions({ type: ProjectPageDto })
  @ApiProjectError(500, '/api/projects', 'Unexpected server error.', 'INTERNAL_SERVER_ERROR')
  @Get()
  findAll(@Query() query: ListProjectsDto): Promise<ProjectPageDto> {
    return this.projects.findAll(query);
  }

  @ApiOperation({ summary: 'Add a project member', operationId: 'addProjectMember' })
  @ApiCreatedResponse({ description: 'Member added.', type: MembershipResponseDto })
  @ApiParam(projectIdParameter)
  @ApiProjectError(400, '/api/projects/10/memberships', 'Invalid IDs or body.', 'INVALID_PROJECT_ID', 'VALIDATION_ERROR')
  @ApiProjectError(404, '/api/projects/10/memberships', 'Project or user does not exist.', 'PROJECT_NOT_FOUND', 'MEMBERSHIP_REFERENCE_NOT_FOUND')
  @ApiProjectError(409, '/api/projects/10/memberships', 'User already belongs to this project.', 'MEMBERSHIP_ALREADY_EXISTS')
  @ApiProjectError(500, '/api/projects/10/memberships', 'Unexpected server error.', 'INTERNAL_SERVER_ERROR')
  @SerializeOptions({ type: MembershipResponseDto })
  @Post(':id/memberships')
  addMember(@Param('id', projectIdPipe) id: number, @Body() input: AddMembershipDto) {
    return this.projects.addMember(id, input.userId);
  }

  @ApiOperation({ summary: 'Get a project by ID', operationId: 'getProject' })
  @ApiProjectResult(200, 'found')
  @ApiProjectError(400, '/api/projects/10', 'Invalid project ID.', 'INVALID_PROJECT_ID')
  @ApiParam(projectIdParameter)
  @ApiProjectError(404, '/api/projects/10', 'Project not found.', 'PROJECT_NOT_FOUND')
  @ApiProjectError(500, '/api/projects/10', 'Unexpected server error.', 'INTERNAL_SERVER_ERROR')
  @Get(':id')
  findOne(@Param('id', projectIdPipe) id: number): Promise<ProjectResponseDto> {
    return this.projects.findOne(id);
  }

  @ApiOperation({ summary: 'Partially update a project', operationId: 'updateProject' })
  @ApiBody({ type: UpdateProjectDto, examples: { completeProject: { value: updateProjectExample } } })
  @ApiProjectResult(200, 'updated')
  @ApiProjectError(400, '/api/projects/10', 'Invalid project ID, JSON or request fields.', 'INVALID_PROJECT_ID', 'VALIDATION_ERROR')
  @ApiProjectError(409, '/api/projects/10', 'The name is already in use by another project.', 'PROJECT_NAME_CONFLICT')
  @ApiParam(projectIdParameter)
  @ApiProjectError(404, '/api/projects/10', 'Project not found.', 'PROJECT_NOT_FOUND')
  @ApiProjectError(500, '/api/projects/10', 'Unexpected server error.', 'INTERNAL_SERVER_ERROR')
  @Patch(':id')
  update(@Param('id', projectIdPipe) id: number, @Body() input: UpdateProjectDto): Promise<ProjectResponseDto> {
    return this.projects.update(id, input);
  }

  @ApiOperation({ summary: 'Delete a project', operationId: 'deleteProject' })
  @ApiNoContentResponse({ description: 'Project deleted. No response body.' })
  @ApiProjectError(400, '/api/projects/10', 'Invalid project ID.', 'INVALID_PROJECT_ID')
  @ApiParam(projectIdParameter)
  @ApiProjectError(404, '/api/projects/10', 'Project not found.', 'PROJECT_NOT_FOUND')
  @ApiProjectError(500, '/api/projects/10', 'Unexpected server error.', 'INTERNAL_SERVER_ERROR')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', projectIdPipe) id: number): Promise<void> {
    return this.projects.remove(id);
  }
}
