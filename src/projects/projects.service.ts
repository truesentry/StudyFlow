import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  DuplicateProjectNameError,
  PROJECTS_REPOSITORY,
  type ProjectsRepository,
} from './projects.repository';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(PROJECTS_REPOSITORY)
    private readonly repository: ProjectsRepository,
  ) {}

  async create(input: CreateProjectDto) {
    await this.assertUniqueName(input.name);
    try {
      return await this.repository.create({
        name: input.name,
        description: input.description ?? '',
        status: input.status,
      });
    } catch (error) {
      if (error instanceof DuplicateProjectNameError) this.nameConflict();
      throw error;
    }
  }

  findAll() {
    return this.repository.findAll();
  }

  async findOne(id: number) {
    this.checkId(id);
    return (await this.repository.findOne(id)) ?? this.notFound(id);
  }

  async update(id: number, input: UpdateProjectDto) {
    await this.findOne(id);
    if (input.name === undefined && input.description === undefined && input.status === undefined) {
      throw new BadRequestException({
        errorCode: 'VALIDATION_ERROR',
        message: 'Provide at least one field to update',
      });
    }
    if (input.name !== undefined) await this.assertUniqueName(input.name, id);
    try {
      return (await this.repository.update(id, input)) ?? this.notFound(id);
    } catch (error) {
      if (error instanceof DuplicateProjectNameError) this.nameConflict();
      throw error;
    }
  }

  async remove(id: number): Promise<void> {
    this.checkId(id);
    if (!(await this.repository.remove(id))) this.notFound(id);
  }

  private async assertUniqueName(name: string, exceptId?: number): Promise<void> {
    const existing = await this.repository.findByName(name);
    if (existing && existing.id !== exceptId) this.nameConflict();
  }

  private nameConflict(): never {
    throw new ConflictException({
      errorCode: 'PROJECT_NAME_CONFLICT',
      message: 'Project with this name already exists',
    });
  }

  private notFound(id: number): never {
    throw new NotFoundException({
      errorCode: 'PROJECT_NOT_FOUND',
      message: `Project with id ${id} was not found`,
    });
  }

  private checkId(id: number): void {
    if (!Number.isSafeInteger(id) || id < 1) {
      throw new BadRequestException({
        errorCode: 'INVALID_PROJECT_ID',
        message: 'Project id must be a positive safe integer',
      });
    }
  }
}
