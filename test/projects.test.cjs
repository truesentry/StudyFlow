require('reflect-metadata');
const assert = require('node:assert/strict');
const { beforeEach, afterEach, test } = require('node:test');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module.js');
const { configureApplication } = require('../dist/main.js');
const { PROJECTS_REPOSITORY } = require('../dist/projects/projects.repository.js');
const { ProjectsService } = require('../dist/projects/projects.service.js');
const { CreateProjectDto } = require('../dist/projects/dto/create-project.dto.js');
const { UpdateProjectDto } = require('../dist/projects/dto/update-project.dto.js');

let app;
let base;
const responseKeys = ['createdAt', 'description', 'id', 'name', 'status'];
const errorKeys = ['errorCode', 'message', 'path', 'statusCode', 'timestamp', 'traceId'];

beforeEach(async () => {
  app = await NestFactory.create(AppModule, { logger: false });
  configureApplication(app);
  await app.listen(0, '127.0.0.1');
  base = (await app.getUrl()) + '/projects';
});

afterEach(async () => {
  await app?.close();
});

function send(method = 'GET', path = '', body) {
  const options = body === undefined ? { method } : {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
  return fetch(base + path, options);
}

async function expectError(response, status, errorCode, path) {
  assert.equal(response.status, status);
  const error = await response.json();
  assert.deepEqual(Object.keys(error).sort(), errorKeys);
  assert.equal(error.statusCode, status);
  assert.equal(error.errorCode, errorCode);
  assert.equal(error.path, path);
  assert.equal(typeof error.message, 'string');
  assert.ok(error.message.length > 0);
  assert.equal(new Date(error.timestamp).toISOString(), error.timestamp);
  assert.match(error.traceId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(response.headers.get('x-trace-id'), error.traceId);
  return error;
}

async function create(name = 'StudyFlow', fields = {}) {
  const response = await send('POST', '', { name, status: 'active', ...fields });
  assert.equal(response.status, 201);
  return response.json();
}

test('HTTP CRUD and transformation of DTOs and numeric id', async () => {
  assert.deepEqual(await (await send()).json(), []);
  const service = app.get(ProjectsService);
  const originalCreate = service.create.bind(service);
  service.create = (dto) => {
    assert.ok(dto instanceof CreateProjectDto);
    return originalCreate(dto);
  };
  const project = await create('  StudyFlow  ');
  assert.deepEqual(Object.keys(project).sort(), responseKeys);
  assert.equal(project.name, 'StudyFlow');
  assert.equal(project.description, '');
  assert.equal(project.status, 'active');
  assert.equal(new Date(project.createdAt).toISOString(), project.createdAt);
  const path = '/' + project.id;

  const originalFindOne = service.findOne.bind(service);
  service.findOne = (id) => {
    assert.equal(typeof id, 'number');
    assert.equal(id, project.id);
    return originalFindOne(id);
  };
  assert.deepEqual(await (await send('GET', path)).json(), project);
  assert.deepEqual(await (await send()).json(), [project]);

  const originalUpdate = service.update.bind(service);
  service.update = (id, dto) => {
    assert.ok(dto instanceof UpdateProjectDto);
    return originalUpdate(id, dto);
  };
  const update = await send('PATCH', path, { description: '  Plan  ', status: 'completed' });
  assert.equal(update.status, 200);
  assert.deepEqual(await update.json(), { ...project, description: 'Plan', status: 'completed' });

  const removed = await send('DELETE', path);
  assert.equal(removed.status, 204);
  assert.equal(await removed.text(), '');
  for (const [method, body] of [['GET'], ['PATCH', { name: 'New name' }], ['DELETE']]) {
    const error = await expectError(await send(method, path, body), 404, 'PROJECT_NOT_FOUND', '/projects' + path);
    assert.equal(error.message, `Project with id ${project.id} was not found`);
  }
});

test('POST validates required fields, enum, types and lengths', async () => {
  for (const body of [
    {}, { name: 'Valid' }, { status: 'active' },
    { name: 'ab', status: 'active' }, { name: '   ', status: 'active' },
    { name: 'a'.repeat(101), status: 'active' },
    { name: 123, status: 'active' }, { name: null, status: 'active' },
    { name: 'Valid', status: 'unknown' }, { name: 'Valid', status: null },
    { name: 'Valid', status: 'active', description: null },
    { name: 'Valid', status: 'active', description: 42 },
    { name: 'Valid', status: 'active', description: 'a'.repeat(501) },
    [],
  ]) {
    await expectError(await send('POST', '', body), 400, 'VALIDATION_ERROR', '/projects');
  }
  assert.deepEqual(await (await send()).json(), []);
});

test('POST accepts length boundaries and all statuses', async () => {
  for (const [name, status] of [['abc', 'draft'], ['a'.repeat(100), 'active'], ['Done project', 'completed']]) {
    const project = await create(name, { status, description: 'x'.repeat(500) });
    assert.equal(project.name, name);
    assert.equal(project.status, status);
    assert.equal(project.description.length, 500);
  }
});

test('Unknown and server-managed fields are forbidden in POST and PATCH', async () => {
  const project = await create();
  for (const extra of [{ id: 99 }, { internalNote: 'secret' }, { createdAt: 'today' }, { deletedAt: null }, { unknown: true }]) {
    await expectError(await send('POST', '', { name: 'Another', status: 'draft', ...extra }), 400, 'VALIDATION_ERROR', '/projects');
    await expectError(await send('PATCH', '/' + project.id, extra), 400, 'VALIDATION_ERROR', '/projects/' + project.id);
  }
  assert.deepEqual(await (await send()).json(), [project]);
});

test('PATCH validates supplied values atomically and preserves omitted fields', async () => {
  const project = await create('Original', { description: 'Original description' });
  const path = '/' + project.id;
  for (const body of [
    {}, { name: null }, { name: 'ab' }, { name: 'x'.repeat(101) }, { name: 123 },
    { description: null }, { description: 42 }, { description: 'x'.repeat(501) },
    { status: 'wrong' }, { status: null }, { name: 'Changed', description: null },
  ]) {
    await expectError(await send('PATCH', path, body), 400, 'VALIDATION_ERROR', '/projects' + path);
    assert.deepEqual(await (await send('GET', path)).json(), project);
  }
  const renamed = await send('PATCH', path, { name: 'New name' });
  assert.equal(renamed.status, 200);
  assert.deepEqual(await renamed.json(), { ...project, name: 'New name' });
  const cleared = await send('PATCH', path, { description: '' });
  assert.equal(cleared.status, 200);
  assert.equal((await cleared.json()).description, '');
});

test('Duplicate names return 409 for POST and PATCH but own name is allowed', async () => {
  const first = await create('StudyFlow');
  const second = await create('Second');
  await expectError(await send('POST', '', { name: '  StudyFlow ', status: 'draft' }), 409, 'PROJECT_NAME_CONFLICT', '/projects');
  await expectError(await send('PATCH', '/' + second.id, { name: 'StudyFlow', status: 'completed' }), 409, 'PROJECT_NAME_CONFLICT', '/projects/' + second.id);
  assert.deepEqual(await (await send('GET', '/' + second.id)).json(), second);
  const unchangedName = await send('PATCH', '/' + first.id, { name: first.name });
  assert.equal(unchangedName.status, 200);
  assert.deepEqual(await unchangedName.json(), first);
});

test('Concurrent duplicate POST requests cannot store the same name twice', async () => {
  const responses = await Promise.all([
    send('POST', '', { name: 'Concurrent', status: 'draft' }),
    send('POST', '', { name: 'Concurrent', status: 'active' }),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
  await expectError(responses.find((r) => r.status === 409), 409, 'PROJECT_NAME_CONFLICT', '/projects');
  assert.equal((await (await send()).json()).length, 1);
});

test('Concurrent renames enforce uniqueness at the repository boundary', async () => {
  const first = await create('First');
  const second = await create('Second');
  const responses = await Promise.all([
    send('PATCH', '/' + first.id, { name: 'Shared' }),
    send('PATCH', '/' + second.id, { name: 'Shared' }),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
  const items = await (await send()).json();
  assert.equal(items.filter((item) => item.name === 'Shared').length, 1);
});

test('Invalid IDs give 400 and missing IDs give 404 for all item routes', async () => {
  for (const id of ['abc', '0', '-1', '1.5', '9007199254740992']) {
    for (const [method, body] of [['GET'], ['PATCH', { status: 'draft' }], ['DELETE']]) {
      await expectError(await send(method, '/' + id, body), 400, 'INVALID_PROJECT_ID', '/projects/' + id);
    }
  }
  for (const [method, body] of [['GET'], ['PATCH', { status: 'draft' }], ['DELETE']]) {
    const error = await expectError(await send(method, '/10', body), 404, 'PROJECT_NOT_FOUND', '/projects/10');
    assert.equal(error.message, 'Project with id 10 was not found');
  }
});

test('Serialization excludes internal fields from POST, list, GET and PATCH', async () => {
  const repository = app.get(PROJECTS_REPOSITORY);
  const withSecrets = (record) => record && ({
    ...record, internalNote: 'private', deletedAt: 'private', storageVersion: 7,
  });
  for (const method of ['create', 'findOne', 'update']) {
    const original = repository[method].bind(repository);
    repository[method] = async (...args) => withSecrets(await original(...args));
  }
  const originalFindAll = repository.findAll.bind(repository);
  repository.findAll = async () => (await originalFindAll()).map(withSecrets);
  const project = await create();
  const one = await (await send('GET', '/' + project.id)).json();
  const list = await (await send()).json();
  const update = await send('PATCH', '/' + project.id, { status: 'completed' });
  assert.equal(update.status, 200);
  for (const result of [project, one, ...list, await update.json()]) {
    assert.deepEqual(Object.keys(result).sort(), responseKeys);
  }
});

test('Global filter handles malformed JSON, unknown routes and unexpected errors', async () => {
  const malformed = await fetch(base, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"name":',
  });
  await expectError(malformed, 400, 'VALIDATION_ERROR', '/projects');
  await expectError(await send('GET', '/10/not-a-route'), 404, 'NOT_FOUND', '/projects/10/not-a-route');

  const repository = app.get(PROJECTS_REPOSITORY);
  repository.findAll = async () => { throw new Error('database password secret'); };
  const failure = await expectError(await send(), 500, 'INTERNAL_SERVER_ERROR', '/projects');
  assert.equal(failure.message, 'Internal server error');
  assert.ok(!JSON.stringify(failure).includes('secret'));
  const next = await expectError(await send(), 500, 'INTERNAL_SERVER_ERROR', '/projects');
  assert.notEqual(failure.traceId, next.traceId);
});
