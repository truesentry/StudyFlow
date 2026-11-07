require('dotenv/config');
const assert = require('node:assert/strict');
const { fork } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { once } = require('node:events');
const { createPrismaClient } = require('../dist/database/prisma-client.js');
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
    return await run((method, path = '', body) => fetch(url + '/api/projects' + path, {
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
  const db = createPrismaClient();
  const owner = await db.user.create({ data: { email: randomUUID() + '@example.test', name: 'Restart test' } });
  try {
    const project = await withServer(async (request) => {
      const results = await Promise.all([
        request('POST', '', { name, status: 'active', ownerId: owner.id }),
        request('POST', '', { name, status: 'active', ownerId: owner.id }),
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
      assert.ok((await (await request('GET', '?size=100')).json()).data.some(({ id }) => id === project.id));

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
  } finally {
    await db.project.deleteMany({ where: { name } });
    await db.user.delete({ where: { id: owner.id } });
    await db.$disconnect();
  }
});

test('PostgreSQL filtering, stable pagination, owner rollback and membership uniqueness', async () => {
  const db = createPrismaClient();
  const key = randomUUID();
  const names = ['A', 'B', 'C', 'D', 'rollback'].map((suffix) => `${key} ${suffix}`);
  const users = [];
  try {
    for (const n of [1, 2]) {
      users.push(await db.user.create({ data: { email: `${n}-${key}@example.test`, name: `User ${n}` } }));
    }
    const [owner, other] = users;
    await withServer(async (request) => {
      const ids = [];
      for (const [i, user, status] of [[0, owner, 'active'], [1, owner, 'active'], [2, owner, 'completed'], [3, other, 'active']]) {
        const response = await request('POST', '', { name: names[i], status, ownerId: user.id });
        assert.equal(response.status, 201);
        const { id } = await response.json();
        ids.push(id);
        const membership = await db.membership.findUnique({
          where: { projectId_userId: { projectId: id, userId: user.id } },
        });
        assert.equal(membership.role, 'owner');
      }
      await db.project.updateMany({
        where: { id: { in: ids } },
        data: { createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-02') },
      });

      async function list(query = '') {
        const response = await request('GET', query);
        assert.equal(response.status, 200);
        return response.json();
      }
      const defaults = await list();
      assert.equal(defaults.meta.page, 1);
      assert.equal(defaults.meta.size, 10);
      const owned = '?assigneeId=' + owner.id;
      const active = owned + '&status=active';
      assert.deepEqual((await list(owned)).data.map(({ id }) => id), [ids[2], ids[1], ids[0]]);
      assert.deepEqual((await list(active)).data.map(({ id }) => id), [ids[1], ids[0]]);
      const query = active + '&size=1&page=2&sort=name&order=asc';
      const second = await list(query);
      assert.deepEqual(second.data.map(({ id }) => id), [ids[1]]);
      assert.deepEqual(second.meta, {
        page: 2, size: 1, total: 2, totalPages: 2, hasNextPage: false, hasPreviousPage: true,
      });
      assert.deepEqual(await list(query), second);
      assert.deepEqual((await list(active + '&size=100&sort=updatedAt')).data.map(({ id }) => id), [ids[1], ids[0]]);
      assert.deepEqual((await list(active + '&page=3&size=1')).data, []);
      assert.deepEqual((await list('?status=draft' + '&assigneeId=' + owner.id)).meta,
        { page: 1, size: 10, total: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false });

      for (const query of ['page=0', 'page=abc', 'page=1.5', 'size=101', 'size=-5', 'sort=id', 'order=up', 'status=unknown', 'assigneeId=not-an-id']) {
        const invalid = await request('GET', '?' + query);
        assert.equal(invalid.status, 400, query);
        assert.equal((await invalid.json()).errorCode, 'VALIDATION_ERROR');
      }

      const missingOwnerId = 2147483647;
      assert.equal(await db.user.findUnique({ where: { id: missingOwnerId } }), null);
      const failed = await request('POST', '', { name: names[4], status: 'active', ownerId: missingOwnerId });
      assert.equal(failed.status, 404);
      assert.equal((await failed.json()).errorCode, 'OWNER_NOT_FOUND');
      assert.equal(await db.project.findUnique({ where: { name: names[4] } }), null);

      const membersPath = '/' + ids[0] + '/memberships';
      const added = await request('POST', membersPath, { userId: other.id });
      assert.equal(added.status, 201);
      assert.equal((await added.json()).role, 'member');
      const duplicate = await request('POST', membersPath, { userId: other.id });
      assert.equal(duplicate.status, 409);
      assert.equal((await duplicate.json()).errorCode, 'MEMBERSHIP_ALREADY_EXISTS');
      assert.equal(await db.membership.count({ where: { projectId: ids[0], userId: other.id } }), 1);
      assert.deepEqual((await list('?assigneeId=' + other.id)).data.map(({ id }) => id), [ids[3]]);
    });
  } finally {
    await db.project.deleteMany({ where: { name: { in: names } } });
    await db.user.deleteMany({ where: { id: { in: users.map(({ id }) => id) } } });
    await db.$disconnect();
  }
});
