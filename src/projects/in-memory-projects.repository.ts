import { Injectable } from '@nestjs/common';
import { DuplicateMembershipError, DuplicateProjectNameError, Membership, Project, ProjectFields, ProjectListOptions, ProjectsRepository } from './projects.repository';

@Injectable()
export class InMemoryProjectsRepository implements ProjectsRepository {
  private readonly projects = new Map<number, Project & { updatedAt: string }>();
  private readonly memberships: Membership[] = [];
  private nextMembershipId = 1;
  private nextId = 1;

  async create(fields: ProjectFields, ownerId: number): Promise<Project> {
    this.assertUniqueName(fields.name);
    const project = {
      id: this.nextId++,
      name: fields.name,
      description: fields.description,
      status: fields.status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.projects.set(project.id, project);
    this.memberships.push({ id: this.nextMembershipId++, projectId: project.id, userId: ownerId, role: 'owner' });
    return { ...project };
  }

  async findAll({ page, size, status, assigneeId, sort, order }: ProjectListOptions) {
    const direction = order === 'asc' ? 1 : -1;
    const filtered = [...this.projects.values()].filter((row) =>
      (status === undefined || row.status === status) &&
      (assigneeId === undefined || this.memberships.some((m) => m.projectId === row.id && m.userId === assigneeId && m.role === 'owner')),
    ).sort((a, b) => direction * (a[sort].localeCompare(b[sort]) || a.id - b.id));
    const offset = (page - 1) * size;
    return { data: filtered.slice(offset, offset + size).map((row) => ({ ...row })), total: filtered.length };
  }

  async addMember(projectId: number, userId: number): Promise<Membership> {
    if (this.memberships.some((m) => m.projectId === projectId && m.userId === userId)) {
      throw new DuplicateMembershipError();
    }
    const row = { id: this.nextMembershipId++, projectId, userId, role: 'member' as const };
    this.memberships.push(row);
    return { ...row };
  }

  async findOne(id: number): Promise<Project | null> {
    const project = this.projects.get(id);
    return project ? { ...project } : null;
  }

  async findByName(name: string): Promise<Project | null> {
    const project = Array.from(this.projects.values()).find((item) => item.name === name);
    return project ? { ...project } : null;
  }

  async update(id: number, fields: Partial<ProjectFields>): Promise<Project | null> {
    const current = this.projects.get(id);
    if (!current) return null;
    if (fields.name !== undefined) this.assertUniqueName(fields.name, id);
    const project = {
      ...current,
      name: fields.name ?? current.name,
      description: fields.description ?? current.description,
      status: fields.status ?? current.status,
      updatedAt: new Date().toISOString(),
    };
    this.projects.set(id, project);
    return { ...project };
  }

  async remove(id: number): Promise<boolean> {
    return this.projects.delete(id);
  }

  private assertUniqueName(name: string, exceptId?: number): void {
    for (const project of this.projects.values()) {
      if (project.name === name && project.id !== exceptId) {
        throw new DuplicateProjectNameError();
      }
    }
  }
}
