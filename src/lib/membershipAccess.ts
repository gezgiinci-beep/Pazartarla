import type { StoreData } from './storeMembership';

type MembershipSession = {
  access_token?: string;
  user?: { id?: string; email_confirmed_at?: string | null; is_anonymous?: boolean };
} | null | undefined;

export function membershipAccess(session: MembershipSession) {
  const signedIn = Boolean(session?.access_token && session.user?.id && !session.user.is_anonymous);
  return { signedIn, verified: signedIn && Boolean(session?.user?.email_confirmed_at) };
}

export function membershipContextKey(userId: string | undefined, admin: boolean, storeId: string | null) {
  return JSON.stringify([userId ?? null, admin, storeId]);
}

export type MembershipSnapshot = { context: string; data: StoreData };

export function membershipDataForContext(snapshot: MembershipSnapshot | null, context: string) {
  return snapshot?.context === context ? snapshot.data : null;
}
