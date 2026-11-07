require('reflect-metadata');
const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { test } = require('node:test');
const { createTestApp } = require('./create-test-app.cjs');

test('Swagger UI and live OpenAPI match the checked-in contract and its examples', async () => {
  const app = await createTestApp();
  try {
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();

    const ui = await fetch(base + '/docs');
    assert.equal(ui.status, 200);
    assert.match(await ui.text(), /StudyFlow API documentation/);
    const initializer = await fetch(base + '/docs/swagger-ui-init.js');
    assert.equal(initializer.status, 200);
    assert.match(await initializer.text(), /createProject/);

    const response = await fetch(base + '/openapi.json');
    assert.equal(response.status, 200);
    const document = await response.json();
    assert.deepEqual(document, JSON.parse(await readFile('openapi.json', 'utf8')));
    assert.deepEqual(document.security, []);
    assert.equal(document.components.securitySchemes.bearerAuth.scheme, 'bearer');
    assert.equal(document.externalDocs.url, 'https://github.com/truesentry/StudyFlow');

    const collection = document.paths['/projects'];
    const item = document.paths['/projects/{id}'];
    const operations = [
      [collection.post, [201, 400, 409, 500]],
      [collection.get, [200, 500]],
      [item.get, [200, 400, 404, 500]],
      [item.patch, [200, 400, 404, 409, 500]],
      [item.delete, [204, 400, 404, 500]],
    ];
    for (const [operation, statuses] of operations) {
      assert.deepEqual(Object.keys(operation.responses).map(Number), statuses);
      assert.deepEqual(operation.tags, ['Projects']);
      assert.ok(operation.summary);
      assert.deepEqual(operation.security ?? [], []);
    }
    assert.equal(item.delete.responses[204].content, undefined);
    assert.equal(item.get.parameters[0].schema.type, 'integer');

    const jsonRequest = (method, path, body) => fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const createBody = collection.post.requestBody.content['application/json'].examples.activeProject.value;
    const created = await jsonRequest('POST', '/projects', createBody);
    assert.equal(created.status, 201);
    const project = await created.json();
    const createdExample = collection.post.responses[201].content['application/json'].example;
    const dynamicFields = { id: project.id, createdAt: project.createdAt };
    assert.deepEqual(project, { ...createdExample, ...dynamicFields });

    const list = await fetch(base + '/projects');
    assert.equal(list.status, 200);
    assert.deepEqual(await list.json(), [project]);

    const patchBody = item.patch.requestBody.content['application/json'].examples.completeProject.value;
    const patched = await jsonRequest('PATCH', '/projects/' + project.id, patchBody);
    assert.equal(patched.status, 200);
    const updatedExample = item.patch.responses[200].content['application/json'].example;
    assert.deepEqual(await patched.json(), { ...updatedExample, ...dynamicFields });

    const missing = await fetch(base + '/projects/10');
    const missingExample = item.get.responses[404].content['application/json'].examples.PROJECT_NOT_FOUND.value;
    assert.equal(missing.status, 404);
    const error = await missing.json();
    assert.deepEqual(error, { ...missingExample, traceId: error.traceId, timestamp: error.timestamp });
  } finally {
    await app.close();
  }
});
