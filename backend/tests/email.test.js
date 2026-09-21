const http = require('http');

const { createMailer } = require('../services/mailers/resend');

/**
 * A stand-in for api.resend.com, so the HTTP transport is exercised for real --
 * a genuine request, genuine headers, genuine status codes -- without a key and
 * without sending anything to anybody.
 */
const startStub = () => new Promise((resolve) => {
  const received = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      received.push({
        method: req.method,
        url: req.url,
        authorization: req.headers.authorization,
        contentType: req.headers['content-type'],
        body: body ? JSON.parse(body) : null,
      });

      const json = (code, payload) => {
        res.writeHead(code, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
      };

      if (req.headers.authorization !== 'Bearer re_test_key') {
        return json(401, { name: 'validation_error', message: 'API key is invalid' });
      }
      if (req.method === 'GET' && req.url === '/domains') {
        return json(200, { data: [{ name: 'example.test', status: 'verified' }] });
      }
      if (req.method === 'POST' && req.url === '/emails') {
        if (!body || !JSON.parse(body).from) {
          return json(422, { message: 'Missing `from` field' });
        }
        return json(200, { id: 'msg_test_1' });
      }
      return json(404, { message: 'Not found' });
    });
  });

  server.listen(0, '127.0.0.1', () => {
    resolve({
      received,
      apiBase: `http://127.0.0.1:${server.address().port}`,
      close: () => new Promise((done) => server.close(done)),
    });
  });
});

describe('Resend HTTP transport', () => {
  let stub;
  let mailer;

  beforeEach(async () => {
    stub = await startStub();
    mailer = createMailer({ apiKey: 're_test_key', apiBase: stub.apiBase });
  });

  afterEach(() => stub.close());

  it('authenticates with a bearer token', async () => {
    await mailer.verify();
    expect(stub.received[0].authorization).toBe('Bearer re_test_key');
    expect(stub.received[0].method).toBe('GET');
  });

  it('posts the message as JSON, with recipients as an array', async () => {
    const result = await mailer.sendMail({
      from: 'noreply@example.test',
      to: 'resident@example.test',
      subject: 'Request received',
      html: '<p>Logged.</p>',
    });

    const call = stub.received[0];
    expect(call.method).toBe('POST');
    expect(call.url).toBe('/emails');
    expect(call.contentType).toBe('application/json');
    // A single recipient still goes as an array, so there is one code path.
    expect(call.body.to).toEqual(['resident@example.test']);
    expect(call.body.subject).toBe('Request received');
    expect(result.messageId).toBe('msg_test_1');
  });

  it('passes several recipients through unchanged', async () => {
    await mailer.sendMail({
      from: 'noreply@example.test',
      to: ['a@example.test', 'b@example.test'],
      subject: 'Heads up',
      html: '<p>Hi.</p>',
    });
    expect(stub.received[0].body.to).toEqual(['a@example.test', 'b@example.test']);
  });

  it('rejects a bad key rather than reporting success', async () => {
    const wrong = createMailer({ apiKey: 're_wrong', apiBase: stub.apiBase });
    await expect(wrong.verify()).rejects.toThrow(/401/);
    await expect(wrong.sendMail({
      from: 'a@example.test', to: 'b@example.test', subject: 's', html: '<p>h</p>',
    })).rejects.toThrow(/API key is invalid/);
  });

  it('surfaces the provider status code on the error', async () => {
    const wrong = createMailer({ apiKey: 're_wrong', apiBase: stub.apiBase });
    const err = await wrong.verify().catch((e) => e);
    expect(err.statusCode).toBe(401);
  });

  it('reports a rejected payload instead of silently dropping it', async () => {
    const err = await mailer
      .sendMail({ to: 'b@example.test', subject: 's', html: '<p>h</p>' })
      .catch((e) => e);
    expect(err.statusCode).toBe(422);
  });

  it('gives up on a server that never answers', async () => {
    // A socket that accepts and then says nothing -- the case a connect-level
    // timeout would miss, and the one that would otherwise hang a notification.
    const silent = http.createServer(() => {});
    await new Promise((r) => silent.listen(0, '127.0.0.1', r));
    const stalled = createMailer({
      apiKey: 're_test_key',
      apiBase: `http://127.0.0.1:${silent.address().port}`,
    });

    jest.useFakeTimers();
    const attempt = stalled.verify();
    const assertion = expect(attempt).rejects.toThrow(/did not respond/);
    await jest.advanceTimersByTimeAsync(20000);
    await assertion;
    jest.useRealTimers();

    await new Promise((r) => silent.close(r));
  }, 20000);
});
