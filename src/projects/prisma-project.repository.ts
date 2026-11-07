import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createPrismaClient } from '../database/prisma-client';
import { Prisma, type PrismaClient, type Project as StoredProject } from '../generated/prisma/client';
import { DuplicateProjectNameError, ProjectStatus, type Project, type ProjectFields, type ProjectsRepository } from './projects.repository';

const projectStatuses = {
  draft: ProjectStatus.Draft,
  active: ProjectStatus.Active,
  completed: ProjectStatus.Completed,
} satisfies Record<StoredProject['status'], ProjectStatus>;

function toProject(row: StoredProject): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: projectStatuses[row.status],
    createdAt: row.createdAt.toISOString(),
  };
}

function isPrismaError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

// PostgreSQL INTEGER is narrower than the HTTP safe-integer range.
const MAX_PROJECT_ID = 2_147_483_647;

@Injectable()
export class PrismaProjectRepository implements ProjectsRepository, OnModuleInit, OnModuleDestroy {
  private client?: PrismaClient;

  private get db(): PrismaClient {
    return this.client ??= createPrismaClient();
  }

  async onModuleInit(): Promise<void> {
    await this.db.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.$disconnect();
  }

  async create(fields: ProjectFields): Promise<Project> {
    try {
      return toProject(await this.db.project.create({ data: fields }));
    } catch (error) {
      if (isPrismaError(error, 'P2002')) throw new DuplicateProjectNameError();
      throw error;
    }
  }

  async findAll(): Promise<Project[]> {
    return (await this.db.project.findMany({ orderBy: { id: 'asc' } })).map(toProject);
  }

  async findOne(id: number): Promise<Project | null> {
    if (id > MAX_PROJECT_ID) return null;
    const row = await this.db.project.findUnique({ where: { id } });
    return row ? toProject(row) : null;
  }

  async findByName(name: string): Promise<Project | null> {
    const row = await this.db.project.findUnique({ where: { name } });
    return row ? toProject(row) : null;
  }

  async update(id: number, fields: Partial<ProjectFields>): Promise<Project | null> {
    if (id > MAX_PROJECT_ID) return null;
    try {
      return toProject(await this.db.project.update({ where: { id }, data: fields }));
    } catch (error) {
      if (isPrismaError(error, 'P2025')) return null;
      if (isPrismaError(error, 'P2002')) throw new DuplicateProjectNameError();
      throw error;
    }
  }

  async remove(id: number): Promise<boolean> {
    if (id > MAX_PROJECT_ID) return false;
    return (await this.db.project.deleteMany({ where: { id } })).count > 0;
  }
}
