import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsInt, Max, Min, ValidateIf } from 'class-validator';
import { ProjectStatus, type ProjectListOptions } from '../projects.repository';

function integer({ value }: { value: unknown }): unknown {
  return typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
}

export class ListProjectsDto implements ProjectListOptions {
  @ApiPropertyOptional({ type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER, default: 1 })
  @Transform(integer)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  page = 1;

  @ApiPropertyOptional({ type: 'integer', minimum: 1, maximum: 100, default: 10 })
  @Transform(integer)
  @IsInt()
  @Min(1)
  @Max(100)
  size = 10;

  @ApiPropertyOptional({ enum: ProjectStatus, enumName: 'ProjectStatus' })
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiPropertyOptional({ type: 'integer', minimum: 1, maximum: 2147483647, description: 'User ID of the owner (responsible user).' })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(integer)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  assigneeId?: number;

  @ApiPropertyOptional({ enum: ['createdAt', 'updatedAt', 'name'], default: 'createdAt' })
  @IsIn(['createdAt', 'updatedAt', 'name'])
  sort: ProjectListOptions['sort'] = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsIn(['asc', 'desc'])
  order: ProjectListOptions['order'] = 'desc';
}
