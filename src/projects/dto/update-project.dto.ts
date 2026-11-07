import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsString, Length, MaxLength, ValidateIf } from 'class-validator';
import { ProjectStatus } from '../projects.repository';

export class UpdateProjectDto {
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(3, 100)
  @ApiPropertyOptional({ minLength: 3, maxLength: 100, description: 'Project name after trimming surrounding whitespace.', example: 'StudyFlow' })
  name?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(500)
  @ApiPropertyOptional({ maxLength: 500, example: 'Система керування навчальними проєктами' })
  description?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(ProjectStatus)
  @ApiPropertyOptional({ enum: ProjectStatus, enumName: 'ProjectStatus', example: ProjectStatus.Active })
  status?: ProjectStatus;
}
