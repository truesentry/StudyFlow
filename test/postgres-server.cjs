require('reflect-metadata');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module.js');
const { configureApplication } = require('../dist/main.js');

async function start() {
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  configureApplication(app);
  app.enableShutdownHooks();
  await app.listen(0, '127.0.0.1');
  process.on('message', async (message) => {
    if (message === 'stop') {
      await app.close();
      process.disconnect();
    }
  });
  process.send(await app.getUrl());
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
