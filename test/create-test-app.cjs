const { Test } = require('@nestjs/testing');
const { AppModule } = require('../dist/app.module.js');
const { configureApplication } = require('../dist/main.js');
const { PROJECTS_REPOSITORY } = require('../dist/projects/projects.repository.js');
const { InMemoryProjectsRepository } = require('../dist/projects/in-memory-projects.repository.js');

async function createTestApp() {
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PROJECTS_REPOSITORY)
    .useClass(InMemoryProjectsRepository)
    .compile();
  const app = module.createNestApplication({ logger: false });
  configureApplication(app);
  return app;
}

module.exports = { createTestApp };
