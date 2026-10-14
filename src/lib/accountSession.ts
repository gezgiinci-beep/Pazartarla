import type { Session } from '@supabase/supabase-js';

export type TursoAccountSession = {
  backend: 'turso';
  user: {
    id: string;
    email: string;
    email_confirmed_at: string | null;
    is_anonymous: false;
  };
  expires_at: string | null;
  is_admin: boolean;
  access_token?: never;
};

export type AccountSession = Session | TursoAccountSession;

export function isTursoAccountSession(
  session: AccountSession | null | undefined,
): session is TursoAccountSession {
  return Boolean(session && 'backend' in session && session.backend === 'turso');
}
