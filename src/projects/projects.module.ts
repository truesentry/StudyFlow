import { Module } from '@nestjs/common';
import { PrismaProjectRepository } from './prisma-project.repository';
import { ProjectsController } from './projects.controller';
import { PROJECTS_REPOSITORY } from './projects.repository';
import { ProjectsService } from './projects.service';

@Module({
  controllers: [ProjectsController],
  providers: [
    ProjectsService,
    { provide: PROJECTS_REPOSITORY, useClass: PrismaProjectRepository },
  ],
})
export class ProjectsModule {}
