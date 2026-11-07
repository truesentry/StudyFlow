import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import { ProjectStatus } from '../projects.repository';

@Exclude()
export class ProjectResponseDto {
  @Expose()
  @ApiProperty({ type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER, example: 10 })
  id!: number;

  @Expose()
  @ApiProperty({ minLength: 3, maxLength: 100, description: 'Project name after trimming surrounding whitespace.', example: 'StudyFlow' })
  name!: string;

  @Expose()
  @ApiProperty({ maxLength: 500, example: 'Система керування навчальними проєктами' })
  description!: string;

  @Expose()
  @ApiProperty({ enum: ProjectStatus, enumName: 'ProjectStatus', example: ProjectStatus.Active })
  status!: ProjectStatus;

  @Expose()
  @ApiProperty({ format: 'date-time', example: '2026-09-23T10:00:00.000Z' })
  createdAt!: string;
}
