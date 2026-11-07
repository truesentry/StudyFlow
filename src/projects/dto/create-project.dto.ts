import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsString, Length, Max, MaxLength, Min, ValidateIf } from 'class-validator';
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
  @ApiPropertyOptional({ maxLength: 500, example: 'Система керування навчальними проєктами', default: '' })
  description?: string;

  @IsEnum(ProjectStatus)
  @ApiProperty({ enum: ProjectStatus, enumName: 'ProjectStatus', example: ProjectStatus.Active })
  status!: ProjectStatus;

  @ApiProperty({ type: 'integer', minimum: 1, maximum: 2147483647, example: 1 })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  ownerId!: number;
}
