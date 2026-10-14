// UI access supplements, never replaces, Supabase's server-side admin policies.
export function createAdminAccessGate() {
  let userId = null;
  let generation = 0;
  return {
    clear() { userId = null; return ++generation; },
    grant(id, ticket) {
      if (ticket !== generation || typeof id !== 'string' || !id) return false;
      userId = id;
      generation++;
      return true;
    },
    allows(session) { return userId !== null && session?.user?.id === userId; },
    get granted() { return userId !== null; },
    get generation() { return generation; },
  };
}

export function createListingRefreshGuard(now = () => Date.now()) {
  let generation = 0;
  const writes = new Set();
  const confirmations = new Map();
  return {
    startRead() { return writes.size ? null : ++generation; },
    canApply(ticket) { return ticket !== null && ticket === generation && !writes.size; },
    beginWrite(id) {
      if (writes.has(id)) return false;
      writes.add(id);
      generation++;
      return true;
    },
    endWrite(id) { writes.delete(id); },
    rememberFeatured(id, featured) {
      confirmations.set(id, {featured, until: now() + 60_000});
    },
    reconcile(rows) {
      return rows.map(row => {
        const confirmed = confirmations.get(row.id);
        if (!confirmed) return row;
        if (now() >= confirmed.until || row.is_featured === confirmed.featured) {
          confirmations.delete(row.id);
          return row;
        }
        // A verified save remains visible until a list confirms it. Override
        // ONLY the featured field; expire to avoid hiding other admins' changes.
        return {...row, is_featured: confirmed.featured};
      });
    },
  };
}
