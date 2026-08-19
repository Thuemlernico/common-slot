import { createApp } from './app.js';

const requestedPort = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(requestedPort) || requestedPort < 1 || requestedPort > 65535) throw new Error('PORT must be a valid TCP port');
const host = process.env.HOST ?? '127.0.0.1';

const server = createApp().listen(requestedPort, host, () => {
  console.log(`Common Slot listening on http://${host}:${requestedPort}`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
