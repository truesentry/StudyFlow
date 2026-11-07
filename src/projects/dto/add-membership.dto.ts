import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class AddMembershipDto {
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 2147483647, example: 2 })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  userId!: number;
}

export class MembershipResponseDto {
  @ApiProperty({ type: 'integer' }) id!: number;
  @ApiProperty({ type: 'integer' }) projectId!: number;
  @ApiProperty({ type: 'integer' }) userId!: number;
  @ApiProperty({ enum: ['owner', 'member'] }) role!: 'owner' | 'member';
}
