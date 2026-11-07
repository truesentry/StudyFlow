import { Injectable } from '@nestjs/common';
import { DuplicateProjectNameError, Project, ProjectFields, ProjectsRepository } from './projects.repository';

@Injectable()
export class InMemoryProjectsRepository implements ProjectsRepository {
  private readonly projects = new Map<number, Project>();
  private nextId = 1;

  async create(fields: ProjectFields): Promise<Project> {
    this.assertUniqueName(fields.name);
    const project: Project = {
      id: this.nextId++,
      name: fields.name,
      description: fields.description,
      status: fields.status,
      createdAt: new Date().toISOString(),
    };
    this.projects.set(project.id, project);
    return { ...project };
  }

  async findAll(): Promise<Project[]> {
    return Array.from(this.projects.values(), (project) => ({ ...project }));
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
    const project: Project = {
      ...current,
      name: fields.name ?? current.name,
      description: fields.description ?? current.description,
      status: fields.status ?? current.status,
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
