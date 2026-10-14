// Explicit, in-memory SMS simulation. No provider, credentials, database or queue.
// Deliberately exposes simulate(), not DispatchPort.send(): never use this to
// complete a real delivery as "sent".
export type SmsSimulationInput = {
  from: string;
  to: string;
  body: string;
  idempotencyKey: string;
  scenario?: 'success' | 'rejected';
};

export type SmsSimulationResult = {
  mode: 'mock';
  simulated: true;
  simulationStatus: 'accepted' | 'rejected';
  realMessageSent: false;
  realMessageDelivered: false;
  mockMessageId: string;
  recipientMasked: string;
  notice: string;
};

export function createSmsSimulator() {
  const results = new Map<string, { fingerprint: string; result: SmsSimulationResult }>();
  return {
    async simulate(input: SmsSimulationInput): Promise<SmsSimulationResult> {
      if (!input || typeof input !== 'object') throw Error('SMS simulation input is required.');
      const { from, to, body, idempotencyKey } = input;
      const scenario = input.scenario ?? 'success';
      for (const phone of [from, to]) {
        if (typeof phone !== 'string' || !/^\+[1-9]\d{7,14}$/.test(phone)) {
          throw Error('SMS simulation requires E.164 sender and recipient numbers.');
        }
      }
      if (typeof body !== 'string' || !body.trim() || body.length > 1600) {
        throw Error('SMS simulation body must contain 1–1600 characters.');
      }
      if (typeof idempotencyKey !== 'string' || !/^[\w-]{1,100}$/.test(idempotencyKey)) {
        throw Error('SMS simulation requires a valid idempotency key.');
      }
      if (scenario !== 'success' && scenario !== 'rejected') {
        throw Error('Unsupported SMS simulation scenario.');
      }
      const fingerprint = JSON.stringify([from, to, body, scenario]);
      const previous = results.get(idempotencyKey);
      if (previous) {
        if (previous.fingerprint !== fingerprint) {
          throw Error('SMS simulation idempotency key reused with different input.');
        }
        return { ...previous.result };
      }
      const result: SmsSimulationResult = {
        mode: 'mock',
        simulated: true,
        simulationStatus: scenario === 'success' ? 'accepted' : 'rejected',
        realMessageSent: false,
        realMessageDelivered: false,
        mockMessageId: `mock-sms-${idempotencyKey}`,
        recipientMasked: `+${'*'.repeat(to.length - 3)}${to.slice(-2)}`,
        notice: scenario === 'success'
          ? 'SMS simülasyonu başarılı. Gerçek SMS gönderilmedi.'
          : 'SMS simülasyonu reddedildi. Gerçek SMS gönderilmedi.',
      };
      results.set(idempotencyKey, { fingerprint, result });
      return { ...result };
    },
  };
}
