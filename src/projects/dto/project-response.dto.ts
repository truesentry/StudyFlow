import { Exclude, Expose } from 'class-transformer';
import { ProjectStatus } from '../projects.repository';

@Exclude()
export class ProjectResponseDto {
  @Expose()
  id!: number;

  @Expose()
  name!: string;

  @Expose()
  description!: string;

  @Expose()
  status!: ProjectStatus;

  @Expose()
  createdAt!: string;
}
