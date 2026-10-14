import { connect } from '@tursodatabase/serverless';

const TURSO_PROTOCOLS = new Set(['libsql:', 'turso:']);

export function getTursoConfiguration(env = process.env) {
  const rawUrl = env.TURSO_DATABASE_URL;
  const authToken = env.TURSO_AUTH_TOKEN;

  if (typeof rawUrl !== 'string' || !rawUrl.trim() ||
      typeof authToken !== 'string' || !authToken.trim()) {
    const error = new Error('Turso veritabanı henüz yapılandırılmadı.');
    error.code = 'TURSO_NOT_CONFIGURED';
    throw error;
  }

  let address;
  try {
    address = new URL(rawUrl.trim());
  } catch {
    const error = new Error('Turso veritabanı adresi geçersiz.');
    error.code = 'TURSO_CONFIGURATION_INVALID';
    throw error;
  }

  const localDevelopment = env.NODE_ENV !== 'production' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(address.hostname) &&
    ['http:', 'https:'].includes(address.protocol);
  const hostedTurso = TURSO_PROTOCOLS.has(address.protocol) &&
    address.hostname.endsWith('.turso.io');

  if ((!localDevelopment && !hostedTurso) || address.username || address.password ||
      address.search || address.hash) {
    const error = new Error('Turso veritabanı adresi desteklenmiyor.');
    error.code = 'TURSO_CONFIGURATION_INVALID';
    throw error;
  }

  const isMigrationTestDatabase = address.hostname.toLowerCase().includes('pazartarla-migration-test');
  if (env.VERCEL_ENV === 'production' && isMigrationTestDatabase) {
    const error = new Error('Test veritabanı canlı ortamda kullanılamaz.');
    error.code = 'TURSO_TEST_DATABASE_FORBIDDEN';
    throw error;
  }

  return {
    url: address.toString().replace(/\/$/, ''),
    authToken: authToken.trim(),
    defaultQueryTimeout: 8_000,
  };
}

export function createTursoConnection(env = process.env, connector = connect) {
  return connector(getTursoConfiguration(env));
}
