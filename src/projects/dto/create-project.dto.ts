import { Transform } from 'class-transformer';
import { IsEnum, IsString, Length, MaxLength, ValidateIf } from 'class-validator';
import { ProjectStatus } from '../projects.repository';

export class CreateProjectDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(3, 100)
  name!: string;

  // Skip only undefined; null must still fail IsString.
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsEnum(ProjectStatus)
  status!: ProjectStatus;
}
