import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsString, Length, MaxLength, ValidateIf } from 'class-validator';
import { ProjectStatus } from '../projects.repository';

export class CreateProjectDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(3, 100)
  @ApiProperty({ minLength: 3, maxLength: 100, description: 'Project name after trimming surrounding whitespace.', example: 'StudyFlow' })
  name!: string;

  // Skip only undefined; null must still fail IsString.
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(500)
  @ApiProperty({ maxLength: 500, example: 'Система керування навчальними проєктами', default: '' })
  description?: string;

  @IsEnum(ProjectStatus)
  @ApiProperty({ enum: ProjectStatus, enumName: 'ProjectStatus', example: ProjectStatus.Active })
  status!: ProjectStatus;
}
