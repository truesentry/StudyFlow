import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  DuplicateMembershipError,
  DuplicateProjectNameError,
  MembershipReferenceError,
  type ProjectListOptions,
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
      }, input.ownerId);
    } catch (error) {
      if (error instanceof DuplicateProjectNameError) this.nameConflict();
      if (error instanceof MembershipReferenceError) {
        throw new NotFoundException({ errorCode: 'OWNER_NOT_FOUND', message: `User with id ${input.ownerId} was not found` });
      }
      this.handleMembershipError(error);
    }
  }

  async findAll(options: ProjectListOptions) {
    const { data, total } = await this.repository.findAll(options);
    const { page, size } = options;
    const totalPages = Math.ceil(total / size);
    return { data, meta: { page, size, total, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 } };
  }

  async addMember(id: number, userId: number) {
    await this.findOne(id);
    try {
      return await this.repository.addMember(id, userId);
    } catch (error) {
      this.handleMembershipError(error);
    }
  }

  private handleMembershipError(error: unknown): never {
    if (error instanceof DuplicateMembershipError) {
      throw new ConflictException({ errorCode: 'MEMBERSHIP_ALREADY_EXISTS', message: 'Користувач уже є учасником проєкту' });
    }
    if (error instanceof MembershipReferenceError) {
      throw new NotFoundException({ errorCode: 'MEMBERSHIP_REFERENCE_NOT_FOUND', message: 'Project or user was not found' });
    }
    throw error;
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
