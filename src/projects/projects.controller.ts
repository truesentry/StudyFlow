import {
  BadRequestException, Body, Controller, Delete, Get, HttpCode,
  HttpStatus, Param, ParseIntPipe, Patch, Post, SerializeOptions,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectResponseDto } from './dto/project-response.dto';

const projectIdPipe = new ParseIntPipe({
  exceptionFactory: () => new BadRequestException({
    errorCode: 'INVALID_PROJECT_ID',
    message: 'Project id must be a positive safe integer',
  }),
});

@Controller('projects')
@SerializeOptions({ type: ProjectResponseDto })
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  create(@Body() input: CreateProjectDto): Promise<ProjectResponseDto> {
    return this.projects.create(input);
  }

  @Get()
  findAll(): Promise<ProjectResponseDto[]> {
    return this.projects.findAll();
  }

  @Get(':id')
  findOne(@Param('id', projectIdPipe) id: number): Promise<ProjectResponseDto> {
    return this.projects.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', projectIdPipe) id: number, @Body() input: UpdateProjectDto): Promise<ProjectResponseDto> {
    return this.projects.update(id, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', projectIdPipe) id: number): Promise<void> {
    return this.projects.remove(id);
  }
}
