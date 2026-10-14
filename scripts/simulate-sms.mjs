import { randomUUID } from 'node:crypto';
import { createSmsSimulator } from '../server/smsSimulation.ts';

// Values are supplied at runtime, never committed recipient configuration.
const args = process.argv.slice(2);
const options = {};
const permitted = new Set(['--from', '--to', '--body', '--scenario', '--key']);
try {
  for (let i = 0; i < args.length; i += 2) {
    if (!permitted.has(args[i]) || args[i + 1] === undefined) {
      throw Error('Usage: simulate:sms --from <E.164> --to <E.164> [--scenario success|rejected] [--body <text>] [--key <id>]');
    }
    options[args[i]] = args[i + 1];
  }
  const result = await createSmsSimulator().simulate({
    from: options['--from'] ?? process.env.SMS_MOCK_FROM,
    to: options['--to'] ?? process.env.SMS_MOCK_TO,
    body: options['--body'] ?? 'PazarTarla SMS simülasyonu.',
    scenario: options['--scenario'] ?? 'success',
    idempotencyKey: options['--key'] ?? randomUUID(),
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.simulationStatus === 'rejected') process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ mode: 'mock', realMessageSent: false, error: error.message }));
  process.exitCode = 1;
}
