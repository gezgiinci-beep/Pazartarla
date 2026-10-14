# SMS simulation

This is an explicit, standalone development test, not a Twilio transport.
It needs no balance, provider credentials, network access or database.
It never claims queued deliveries, marks a real delivery sent, enables a channel,
or changes the live website. Existing real sending code remains unchanged.

Run from the standalone app directory with Node 22+:

```sh
pnpm run simulate:sms --from <sender-in-E.164> --to <recipient-in-E.164>
pnpm run simulate:sms --from <sender-in-E.164> --to <recipient-in-E.164> --scenario rejected
pnpm run test:sms-mock
```

Alternatively supply server-only `SMS_MOCK_FROM` and `SMS_MOCK_TO` environment
variables. Never use VITE-prefixed variables or commit private recipient details.
Output masks the recipient and labels the result `mode: mock`, with
`realMessageSent: false` and `realMessageDelivered: false`. A simulated rejection
and invalid input return a nonzero CLI exit status.

For application tests, instantiate `createSmsSimulator()` and call `simulate()`.
It deliberately does not implement the real dispatch worker's `send()` interface.
Its idempotency cache is in-memory for the lifetime of that simulator only.
Production provider acceptance, delivery and durable retries must still be
verified with the real, configured provider; this test does not establish them.
