require('dotenv/config');
const assert = require('node:assert/strict');
const { fork } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { once } = require('node:events');
const { test } = require('node:test');

async function withServer(run) {
  const child = fork(require.resolve('./postgres-server.cjs'));
  const exited = once(child, 'exit');
  const controller = new AbortController();
  const ready = once(child, 'message', { signal: controller.signal });
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const [url] = await Promise.race([
      ready,
      exited.then(([code, signal]) => { throw new Error(`Server stopped before startup (${code ?? signal})`); }),
    ]);
    return await run((method, path = '', body) => fetch(url + '/projects' + path, {
      method,
      ...(body === undefined ? {} : {
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
      signal: AbortSignal.timeout(5000),
    }));
  } finally {
    clearTimeout(timeout);
    controller.abort();
    if (child.connected) {
      const forceStop = setTimeout(() => child.kill('SIGKILL'), 5000);
      try {
        child.send('stop');
        await exited;
      } finally {
        clearTimeout(forceStop);
      }
    }
  }
}

test('PostgreSQL CRUD persists across independent server processes', async () => {
  assert.ok(process.env.DATABASE_URL, 'Set DATABASE_URL to a migrated test database');
  const name = 'Restart test ' + randomUUID();
  const project = await withServer(async (request) => {
    const results = await Promise.all([
      request('POST', '', { name, status: 'active' }),
      request('POST', '', { name, status: 'active' }),
    ]);
    assert.deepEqual(results.map(({ status }) => status).sort(), [201, 409]);
    assert.equal((await results.find((r) => r.status === 409).json()).errorCode, 'PROJECT_NAME_CONFLICT');
    return results.find((r) => r.status === 201).json();
  });
  const path = '/' + project.id;

  await withServer(async (request) => {
    const result = await request('GET', path);
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), project);
    assert.ok((await (await request('GET')).json()).some(({ id }) => id === project.id));

    const largeId = await request('GET', '/9007199254740991');
    assert.equal(largeId.status, 404);
    const updated = await request('PATCH', path, { status: 'completed', description: 'Persisted update' });
    assert.equal(updated.status, 200);
    assert.deepEqual(await updated.json(), { ...project, status: 'completed', description: 'Persisted update' });
  });

  await withServer(async (request) => {
    const result = await request('GET', path);
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), { ...project, status: 'completed', description: 'Persisted update' });

    const deleted = await request('DELETE', path);
    assert.equal(deleted.status, 204);
    assert.equal(await deleted.text(), '');
  });

  await withServer(async (request) => {
    const missing = await request('GET', path);
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).errorCode, 'PROJECT_NOT_FOUND');
  });
});
