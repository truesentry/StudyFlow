import { Module } from '@nestjs/common';
import { InMemoryProjectsRepository } from './in-memory-projects.repository';
import { ProjectsController } from './projects.controller';
import { PROJECTS_REPOSITORY } from './projects.repository';
import { ProjectsService } from './projects.service';

@Module({
  controllers: [ProjectsController],
  providers: [
    ProjectsService,
    { provide: PROJECTS_REPOSITORY, useClass: InMemoryProjectsRepository },
  ],
})
export class ProjectsModule {}
