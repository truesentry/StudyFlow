import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';
import { ProjectResponseDto } from './project-response.dto';

@Exclude()
export class ProjectPageMetaDto {
  @Expose() @ApiProperty({ type: 'integer', minimum: 1 }) page!: number;
  @Expose() @ApiProperty({ type: 'integer', minimum: 1, maximum: 100 }) size!: number;
  @Expose() @ApiProperty({ type: 'integer', minimum: 0 }) total!: number;
  @Expose() @ApiProperty({ type: 'integer', minimum: 0 }) totalPages!: number;
  @Expose() @ApiProperty() hasNextPage!: boolean;
  @Expose() @ApiProperty() hasPreviousPage!: boolean;
}

@Exclude()
export class ProjectPageDto {
  @Expose()
  @Type(() => ProjectResponseDto)
  @ApiProperty({ type: [ProjectResponseDto] })
  data!: ProjectResponseDto[];

  @Expose()
  @Type(() => ProjectPageMetaDto)
  @ApiProperty({ type: ProjectPageMetaDto })
  meta!: ProjectPageMetaDto;
}
