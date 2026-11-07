export enum ProjectStatus {
  Draft = 'draft',
  Active = 'active',
  Completed = 'completed',
}

export interface Project {
  readonly id: number;
  readonly name: string;
  readonly description: string;
  readonly status: ProjectStatus;
  readonly createdAt: string;
}

export type ProjectFields = Pick<Project, 'name' | 'description' | 'status'>;

export const PROJECTS_REPOSITORY = Symbol('PROJECTS_REPOSITORY');

// Adapters must enforce name uniqueness atomically, including concurrent writes.
export class DuplicateProjectNameError extends Error {
  constructor() {
    super('Project name already exists');
    this.name = 'DuplicateProjectNameError';
  }
}

export interface ProjectsRepository {
  create(fields: ProjectFields): Promise<Project>;
  findAll(): Promise<Project[]>;
  findOne(id: number): Promise<Project | null>;
  findByName(name: string): Promise<Project | null>;
  update(id: number, fields: Partial<ProjectFields>): Promise<Project | null>;
  remove(id: number): Promise<boolean>;
}
