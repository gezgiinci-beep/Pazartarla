import test from 'node:test';
import assert from 'node:assert/strict';
import { createSmsSimulator } from '../server/smsSimulation.ts';

const input = () => ({
  from: '+12025550123',
  to: '+905550000001',
  body: 'Synthetic SMS test',
  idempotencyKey: 'test-only',
});

test('mock succeeds without network access or provider credentials', async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => { requests++; throw Error('Network forbidden'); };
  try {
    const simulator = createSmsSimulator();
    assert.equal(simulator.send, undefined);
    const result = await simulator.simulate(input());
    assert.equal(result.mode, 'mock');
    assert.equal(result.simulated, true);
    assert.equal(result.simulationStatus, 'accepted');
    assert.equal(result.realMessageSent, false);
    assert.equal(result.realMessageDelivered, false);
    assert.match(result.notice, /Gerçek SMS gönderilmedi/);
    assert.match(result.mockMessageId, /^mock-sms-/);
    assert.equal(result.accepted, undefined);
    assert.equal(result.providerId, undefined);
    assert.ok(!JSON.stringify(result).includes(input().to));
    assert.equal(requests, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('mock rejection stays separate from actual provider delivery', async () => {
  const result = await createSmsSimulator().simulate({ ...input(), scenario: 'rejected' });
  assert.equal(result.simulationStatus, 'rejected');
  assert.equal(result.realMessageSent, false);
});

test('same key is repeatable, changed input conflicts, result mutation cannot corrupt cache', async () => {
  const simulator = createSmsSimulator();
  const first = await simulator.simulate(input());
  const expected = { ...first };
  first.simulationStatus = 'rejected';
  assert.deepEqual(await simulator.simulate(input()), expected);
  await assert.rejects(simulator.simulate({ ...input(), body: 'Changed' }), /different input/);
});

test('invalid recipients, bodies, keys and scenarios fail explicitly', async () => {
  for (const patch of [
    { to: 'invalid' }, { from: '' }, { body: ' ' }, { body: 'x'.repeat(1601) },
    { idempotencyKey: '' }, { scenario: 'live' },
  ]) {
    await assert.rejects(createSmsSimulator().simulate({ ...input(), ...patch }));
  }
});
