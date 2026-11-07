import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createPrismaClient } from '../database/prisma-client';
import { Prisma, type PrismaClient, type Project as StoredProject } from '../generated/prisma/client';
import { DuplicateMembershipError, DuplicateProjectNameError, MembershipReferenceError, ProjectStatus, type Project, type ProjectFields, type ProjectListOptions, type ProjectsRepository } from './projects.repository';

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

  async create(fields: ProjectFields, ownerId: number): Promise<Project> {
    return this.db.$transaction(async (tx) => {
      let row: StoredProject;
      try {
        row = await tx.project.create({ data: fields });
      } catch (error) {
        if (isPrismaError(error, 'P2002')) throw new DuplicateProjectNameError();
        throw error;
      }
      await this.insertMembership(tx, row.id, ownerId, 'owner');
      return toProject(row);
    });
  }

  async findAll(options: ProjectListOptions) {
    const { page, size, status, assigneeId, sort, order } = options;
    const where: Prisma.ProjectWhereInput = {
      status,
      ...(assigneeId === undefined ? {} : { memberships: { some: { userId: assigneeId, role: 'owner' } } }),
    };
    return this.db.$transaction(async (tx) => {
      const total = await tx.project.count({ where });
      const skip = (page - 1) * size;
      if (skip >= total) return { data: [], total };
      const rows = await tx.project.findMany({
        where, skip, take: size, orderBy: [{ [sort]: order }, { id: order }],
      });
      return { data: rows.map(toProject), total };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  addMember(projectId: number, userId: number) {
    return this.insertMembership(this.db, projectId, userId, 'member');
  }

  private async insertMembership(db: Prisma.TransactionClient, projectId: number, userId: number, role: 'owner' | 'member') {
    try {
      return await db.membership.create({ data: { projectId, userId, role } });
    } catch (error) {
      if (isPrismaError(error, 'P2002')) throw new DuplicateMembershipError();
      if (isPrismaError(error, 'P2003')) throw new MembershipReferenceError();
      throw error;
    }
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
