import { createHash, randomUUID } from 'node:crypto';

const CHANNELS = ['sms', 'email', 'whatsapp'];
const PAGE_SIZE = 50;
const MAX_IMPORT_ROWS = 200;
const MAX_IMPORT_BYTES = 150_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class TursoContactDepotError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.name = 'TursoContactDepotError';
    this.code = code;
    this.status = status;
  }
}

function fail(code, status = 400) {
  throw new TursoContactDepotError(code, status);
}

function withImmediateTransaction(database, callback) {
  if (typeof database?.transactionAsync !== 'function') {
    throw new Error('CONTACT_TRANSACTION_REQUIRED');
  }
  const transaction = database.transactionAsync(callback);
  if (typeof transaction?.immediate !== 'function') {
    throw new Error('CONTACT_TRANSACTION_REQUIRED');
  }
  return transaction.immediate();
}

function normalizePhone(value) {
  if (typeof value !== 'string' || !/^[+0-9 ()-]*$/.test(value)) return null;
  let phone = value.replace(/[ ()-]/g, '');
  if (phone.startsWith('00')) phone = `+${phone.slice(2)}`;
  if (/^0[1-9]\d{9}$/.test(phone)) phone = `+90${phone.slice(1)}`;
  else if (/^[1-9]\d{9}$/.test(phone)) phone = `+90${phone}`;
  else if (/^90[1-9]\d{9}$/.test(phone)) phone = `+${phone}`;
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}

function normalizeContact(input) {
  const name = typeof input?.p_name === 'string' ? input.p_name.trim() : '';
  const rawEmail = typeof input?.p_email === 'string' ? input.p_email.trim() : '';
  const rawPhone = typeof input?.p_phone === 'string' ? input.p_phone.trim() : '';
  const email = rawEmail ? rawEmail.toLowerCase() : null;
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  if (!name || name.length > 120 ||
      (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) ||
      (!email && !rawPhone) ||
      (rawPhone && (rawPhone.length > 40 || !phone))) {
    fail('CONTACT_INVALID');
  }
  return { name, email, phone, rawPhone: rawPhone || null };
}

function destinationFor(contact, channel) {
  return channel === 'email' ? contact.email : contact.phone;
}

function assertChannel(channel) {
  if (!CHANNELS.includes(channel)) fail('CONTACT_INVALID');
  return channel;
}

async function ensurePermissionRows(database, contactId, contact, now) {
  for (const channel of CHANNELS) {
    const token = randomUUID();
    await database.run(
      `INSERT INTO private__depot_permissions
         (contact_id, channel, status, evidence, updated_at, unsubscribe_token)
       VALUES (?, ?, 'unknown', '', NULL, ?)
       ON CONFLICT(contact_id, channel) DO NOTHING`,
      contactId,
      channel,
      token,
    );
    const permission = await database.get(
      `SELECT unsubscribe_token FROM private__depot_permissions
        WHERE contact_id = ? AND channel = ?`,
      contactId,
      channel,
    );
    const destination = destinationFor(contact, channel);
    if (permission?.unsubscribe_token && destination) {
      await database.run(
        `INSERT INTO private__depot_optout_links(token, channel, destination)
         VALUES (?, ?, ?)
         ON CONFLICT(token) DO UPDATE SET channel = excluded.channel, destination = excluded.destination`,
        permission.unsubscribe_token,
        channel,
        destination,
      );
    }
  }
}

async function appendPermissionEvent(database, contactId, channel, status, evidence, actor, now) {
  const next = await database.get(
    'SELECT COALESCE(MAX(id), 0) + 1 AS id FROM private__depot_permission_events',
  );
  await database.run(
    `INSERT INTO private__depot_permission_events
       (id, contact_id, channel, status, evidence, actor, recorded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    Number(next?.id || 1),
    contactId,
    channel,
    status,
    evidence,
    actor,
    now.toISOString(),
  );
}

async function cancelQueuedDeliveries(database, channel, destination, now, contactId = null) {
  if (contactId) {
    await database.run(
      `UPDATE private__depot_deliveries SET status = 'cancelled', updated_at = ?
        WHERE contact_id = ? AND status = 'queued'
          AND campaign_id IN (SELECT id FROM private__depot_campaigns WHERE channel = ?)`,
      now.toISOString(),
      contactId,
      channel,
    );
    return;
  }
  await database.run(
    `UPDATE private__depot_deliveries SET status = 'cancelled', updated_at = ?
      WHERE destination = ? AND status = 'queued'
        AND campaign_id IN (SELECT id FROM private__depot_campaigns WHERE channel = ?)`,
    now.toISOString(),
    destination,
    channel,
  );
}

async function revokeDestination(database, contactId, channel, proof, actor, now) {
  const current = await database.get(
    'SELECT id, email, phone FROM private__depot_contacts WHERE id = ?',
    contactId,
  );
  if (!current) fail('CONTACT_STALE', 409);
  const destination = destinationFor(current, channel);
  if (destination && ['admin_revoked', 'self_service_link', 'contact_archived'].includes(proof)) {
    await database.run(
      `INSERT INTO private__depot_suppressions(channel, destination, created_at)
       VALUES (?, ?, ?)
       ON CONFLICT(channel, destination) DO NOTHING`,
      channel,
      destination,
      now.toISOString(),
    );
    const column = channel === 'email' ? 'email' : 'phone';
    const duplicates = await database.all(
      `SELECT id FROM private__depot_contacts WHERE ${column} = ? AND id <> ?`,
      destination,
      contactId,
    );
    await database.run(
      `UPDATE private__depot_permissions SET status = 'revoked',
         evidence = 'destination_optout', updated_at = ?
       WHERE channel = ? AND contact_id IN
         (SELECT id FROM private__depot_contacts WHERE ${column} = ?)`,
      now.toISOString(),
      channel,
      destination,
    );
    for (const duplicate of duplicates) {
      await appendPermissionEvent(
        database, duplicate.id, channel, 'revoked', 'destination_optout', actor, now,
      );
    }
    if (duplicates.length) {
      await database.run(
        `UPDATE private__depot_contacts SET revision = revision + 1, updated_at = ?
          WHERE ${column} = ? AND id <> ?`,
        now.toISOString(),
        destination,
        contactId,
      );
    }
    await cancelQueuedDeliveries(database, channel, destination, now);
  }
  await database.run(
    `UPDATE private__depot_permissions SET status = 'revoked', evidence = ?, updated_at = ?
      WHERE contact_id = ? AND channel = ?`,
    proof,
    now.toISOString(),
    contactId,
    channel,
  );
  await appendPermissionEvent(database, contactId, channel, 'revoked', proof, actor, now);
  await cancelQueuedDeliveries(database, channel, destination, now, contactId);
}

async function initializeContact(database, contactId, contact, now) {
  await ensurePermissionRows(database, contactId, contact, now);
}

export async function captureTursoListingContact(database, {
  listingId,
  userId,
  email,
  emailVerified,
  isAdmin,
  seller,
  rawPhone,
  now = new Date(),
}) {
  const raw = typeof rawPhone === 'string' ? rawPhone.trim().slice(0, 40) : '';
  const phone = normalizePhone(raw);
  const contactEmail = emailVerified && !isAdmin && typeof email === 'string'
    ? email.trim().toLowerCase() : null;
  if (!contactEmail && !raw) return null;
  const identityKey = JSON.stringify([contactEmail, phone || raw]);
  const id = randomUUID();
  await database.run(
    `INSERT INTO private__depot_contacts
       (id, identity_key, name, email, phone, raw_phone, manual, from_listing,
        archived, revision, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, 1, 0, 1, ?, ?)
     ON CONFLICT(identity_key) DO UPDATE SET
       name = CASE WHEN private__depot_contacts.manual = 1
                   THEN private__depot_contacts.name ELSE excluded.name END,
       raw_phone = CASE WHEN private__depot_contacts.manual = 1
                        THEN private__depot_contacts.raw_phone ELSE excluded.raw_phone END,
       from_listing = 1,
       revision = private__depot_contacts.revision + 1,
       updated_at = excluded.updated_at`,
    id,
    identityKey,
    (typeof seller === 'string' && seller.trim() ? seller.trim() : 'İlan veren').slice(0, 120),
    contactEmail,
    phone,
    raw || null,
    now.toISOString(),
    now.toISOString(),
  );
  const contact = await database.get(
    'SELECT id, email, phone, raw_phone FROM private__depot_contacts WHERE identity_key = ?',
    identityKey,
  );
  if (!contact?.id) throw new Error('CONTACT_CAPTURE_READBACK_FAILED');
  await initializeContact(database, contact.id, contact, now);
  await database.run(
    `INSERT INTO private__depot_sources(listing_id, contact_id, captured_at)
     VALUES (?, ?, ?)
     ON CONFLICT(listing_id) DO UPDATE SET
       contact_id = excluded.contact_id, captured_at = excluded.captured_at`,
    Number(listingId),
    contact.id,
    now.toISOString(),
  );
  return contact.id;
}

async function saveContact(database, session, args, now) {
  const contact = normalizeContact(args);
  const id = args?.p_id ?? null;
  const revision = args?.p_revision;
  const identityKey = JSON.stringify([contact.email, contact.phone || '']);
  return withImmediateTransaction(database, async transaction => {
    try {
      if (id == null) {
        const newId = randomUUID();
        await transaction.run(
          `INSERT INTO private__depot_contacts
             (id, identity_key, name, email, phone, raw_phone, manual, from_listing,
              archived, revision, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, 0, 0, 1, ?, ?)`,
          newId,
          identityKey,
          contact.name,
          contact.email,
          contact.phone,
          contact.rawPhone,
          now.toISOString(),
          now.toISOString(),
        );
        await initializeContact(transaction, newId, contact, now);
        return newId;
      }
      if (!UUID.test(String(id)) || !Number.isSafeInteger(revision) || revision < 1) {
        fail('CONTACT_STALE', 409);
      }
      const old = await transaction.get(
        'SELECT * FROM private__depot_contacts WHERE id = ? LIMIT 1',
        id,
      );
      if (!old || Number(old.revision) !== revision) fail('CONTACT_STALE', 409);
      if (old.email !== contact.email) await revokeDestination(transaction, id, 'email', 'destination_changed', session.user.id, now);
      if (old.phone !== contact.phone) {
        await revokeDestination(transaction, id, 'sms', 'destination_changed', session.user.id, now);
        await revokeDestination(transaction, id, 'whatsapp', 'destination_changed', session.user.id, now);
      }
      await transaction.run(
        `UPDATE private__depot_contacts SET identity_key = ?, name = ?, email = ?,
           phone = ?, raw_phone = ?, manual = 1, revision = revision + 1, updated_at = ?
         WHERE id = ? AND revision = ?`,
        identityKey,
        contact.name,
        contact.email,
        contact.phone,
        contact.rawPhone,
        now.toISOString(),
        id,
        revision,
      );
      if (old.email !== contact.email) {
        await transaction.run(
          `UPDATE private__depot_permissions SET unsubscribe_token = ?
            WHERE contact_id = ? AND channel = 'email'`,
          randomUUID(),
          id,
        );
      }
      if (old.phone !== contact.phone) {
        await transaction.run(
          `UPDATE private__depot_permissions SET unsubscribe_token = ?
            WHERE contact_id = ? AND channel IN ('sms', 'whatsapp')`,
          randomUUID(),
          id,
        );
      }
      await initializeContact(transaction, id, contact, now);
      return id;
    } catch (error) {
      if (String(error?.message || '').includes('UNIQUE constraint failed')) {
        fail('CONTACT_CONFLICT', 409);
      }
      throw error;
    }
  });
}

async function setPermission(database, session, args, now) {
  const channel = assertChannel(args?.p_channel);
  const id = args?.p_id;
  const revision = args?.p_revision;
  if (!UUID.test(String(id)) || !Number.isSafeInteger(revision) || revision < 1 ||
      typeof args?.p_grant !== 'boolean') fail('CONTACT_INVALID');
  return withImmediateTransaction(database, async transaction => {
    const contact = await transaction.get(
      'SELECT * FROM private__depot_contacts WHERE id = ? LIMIT 1',
      id,
    );
    if (!contact || Number(contact.revision) !== revision) fail('CONTACT_STALE', 409);
    await initializeContact(transaction, id, contact, now);
    const destination = destinationFor(contact, channel);
    const evidence = typeof args?.p_evidence === 'string' ? args.p_evidence.trim() : '';
    if (args.p_grant && (Number(contact.archived) === 1 || !destination)) {
      fail('CONTACT_DESTINATION_REQUIRED');
    }
    if (args.p_grant && (evidence.length < 3 || evidence.length > 500)) {
      fail('CONTACT_EVIDENCE_REQUIRED');
    }
    if (args.p_grant) {
      await transaction.run(
        'DELETE FROM private__depot_suppressions WHERE channel = ? AND destination = ?',
        channel,
        destination,
      );
      await transaction.run(
        `UPDATE private__depot_permissions SET status = 'granted', evidence = ?, updated_at = ?
          WHERE contact_id = ? AND channel = ?`,
        evidence,
        now.toISOString(),
        id,
        channel,
      );
      await appendPermissionEvent(transaction, id, channel, 'granted', evidence, session.user.id, now);
    } else {
      await revokeDestination(transaction, id, channel, 'admin_revoked', session.user.id, now);
    }
    await transaction.run(
      'UPDATE private__depot_contacts SET revision = revision + 1, updated_at = ? WHERE id = ?',
      now.toISOString(),
      id,
    );
    return true;
  });
}

async function archiveContact(database, session, args, now) {
  const id = args?.p_id;
  const revision = args?.p_revision;
  const archived = args?.p_archived;
  if (!UUID.test(String(id)) || !Number.isSafeInteger(revision) ||
      revision < 1 || typeof archived !== 'boolean') fail('CONTACT_INVALID');
  return withImmediateTransaction(database, async transaction => {
    const contact = await transaction.get(
      'SELECT * FROM private__depot_contacts WHERE id = ? LIMIT 1',
      id,
    );
    if (!contact || Number(contact.revision) !== revision) fail('CONTACT_STALE', 409);
    if (archived) {
      for (const channel of CHANNELS) {
        await revokeDestination(transaction, id, channel, 'contact_archived', session.user.id, now);
      }
    }
    await transaction.run(
      `UPDATE private__depot_contacts SET archived = ?, revision = revision + 1, updated_at = ?
        WHERE id = ?`,
      archived ? 1 : 0,
      now.toISOString(),
      id,
    );
    return true;
  });
}

function importRowError(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row) ||
      !Number.isSafeInteger(row.row) || row.row < 1 || row.row > 9999 ||
      typeof row.name !== 'string' || typeof row.email !== 'string' ||
      typeof row.phone !== 'string') return 'CONTACT_IMPORT_INVALID';
  const name = row.name.trim();
  const email = row.email.trim().toLowerCase();
  const phoneRaw = row.phone.trim();
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
  if (!name || name.length > 120) return 'Ad/soyad boş veya çok uzun.';
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return 'Geçersiz e-posta.';
  if (phoneRaw && (phoneRaw.length > 40 || !phone)) return 'Geçersiz telefon.';
  if (!email && !phone) return 'E-posta ve telefon birlikte boş.';
  return null;
}

async function processImport(database, rows, save, session, requestId, now) {
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > MAX_IMPORT_ROWS ||
      Buffer.byteLength(JSON.stringify(rows), 'utf8') > MAX_IMPORT_BYTES) {
    fail('CONTACT_IMPORT_SIZE');
  }
  if (save && !/^[0-9a-f-]{36}:[0-9]{1,4}$/i.test(String(requestId || ''))) {
    fail('CONTACT_IMPORT_INVALID');
  }
  const apply = async transaction => {
    const inputHash = createHash('sha256').update(JSON.stringify(rows)).digest('hex');
    if (save) {
      const receipt = await transaction.get(
        'SELECT actor, input_hash, result FROM private__depot_import_receipts WHERE request_id = ?',
        requestId,
      );
      if (receipt) {
        if (receipt.actor !== session.user.id || receipt.input_hash !== inputHash) {
          fail('CONTACT_IMPORT_CHANGED', 409);
        }
        return JSON.parse(receipt.result);
      }
    }
    const seenEmails = new Set();
    const seenPhones = new Set();
    const result = [];
    for (const row of rows) {
      if (!row || typeof row !== 'object' || Array.isArray(row) ||
          !Number.isSafeInteger(row.row) || row.row < 1) fail('CONTACT_IMPORT_INVALID');
      const invalid = importRowError(row);
      if (invalid) {
        result.push({ row: row.row, status: 'invalid', reason: invalid === 'CONTACT_IMPORT_INVALID' ? 'Aktarım satırı geçersiz.' : invalid });
        continue;
      }
      const name = row.name.trim();
      const email = row.email.trim().toLowerCase() || null;
      const rawPhone = row.phone.trim();
      const phone = rawPhone ? normalizePhone(rawPhone) : null;
      let status = 'ready';
      let reason = '';
      if ((email && seenEmails.has(email)) || (phone && seenPhones.has(phone))) {
        status = 'duplicate';
        reason = 'Dosyada aynı e-posta veya telefon daha önce var.';
      } else {
        const duplicate = await transaction.get(
          `SELECT id FROM private__depot_contacts
            WHERE (? IS NOT NULL AND email = ?) OR (? IS NOT NULL AND phone = ?)
            LIMIT 1`,
          email, email, phone, phone,
        );
        if (duplicate) {
          status = 'duplicate';
          reason = 'Depoda aynı e-posta veya telefon var (arşiv dahil). Mevcut kayıt değiştirilmedi.';
        }
      }
      if (status === 'ready') {
        if (email) seenEmails.add(email);
        if (phone) seenPhones.add(phone);
        if (save) {
          const id = randomUUID();
          try {
            await transaction.run(
              `INSERT INTO private__depot_contacts
                 (id, identity_key, name, email, phone, raw_phone, manual, from_listing,
                  archived, revision, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, 1, 0, 0, 1, ?, ?)`,
              id,
              JSON.stringify([email, phone || '']),
              name,
              email,
              phone,
              rawPhone || null,
              now.toISOString(),
              now.toISOString(),
            );
            await initializeContact(transaction, id, { email, phone }, now);
            status = 'imported';
          } catch (error) {
            if (String(error?.message || '').includes('UNIQUE constraint failed')) {
              status = 'duplicate';
              reason = 'Kayıt başka bir oturumda eklendi. Mevcut kişi değiştirilmedi.';
            } else throw error;
          }
        }
      }
      result.push({ row: row.row, status, reason });
    }
    if (save) {
      await transaction.run(
        `INSERT INTO private__depot_import_receipts(request_id, actor, input_hash, result, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        requestId,
        session.user.id,
        inputHash,
        JSON.stringify(result),
        now.toISOString(),
      );
    }
    return result;
  };
  return save ? withImmediateTransaction(database, apply) : apply(database);
}

async function queueCampaign(database, session, args, now) {
  const name = typeof args?.p_name === 'string' ? args.p_name.trim() : '';
  const channel = args?.p_channel;
  const subject = typeof args?.p_subject === 'string' ? args.p_subject.trim() : '';
  const body = typeof args?.p_body === 'string' ? args.p_body.trim() : '';
  const scheduledAt = typeof args?.p_scheduled_at === 'string' ? Date.parse(args.p_scheduled_at) : NaN;
  if (!name || name.length > 120 || !CHANNELS.includes(channel) ||
      !body || body.length > 2000 || subject.length > 200 ||
      (channel === 'email' && !subject) || !Number.isFinite(scheduledAt) ||
      scheduledAt < now.getTime() - 5 * 60_000 ||
      scheduledAt > now.getTime() + 90 * 24 * 60 * 60_000) fail('CONTACT_INVALID');
  return withImmediateTransaction(database, async transaction => {
    const column = channel === 'email' ? 'email' : 'phone';
    const contacts = await transaction.all(
      `SELECT c.id, c.${column} AS destination
         FROM private__depot_contacts c
         JOIN private__depot_permissions p ON p.contact_id = c.id AND p.channel = ?
        WHERE c.archived = 0 AND p.status = 'granted' AND c.${column} IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM private__depot_suppressions s
                           WHERE s.channel = ? AND s.destination = c.${column})
        ORDER BY c.${column}, c.id`,
      channel,
      channel,
    );
    const unique = new Map();
    for (const contact of contacts) {
      if (!unique.has(contact.destination)) unique.set(contact.destination, contact.id);
    }
    if (!unique.size) fail('CONTACT_NO_RECIPIENTS');
    if (unique.size > 10_000) fail('CONTACT_CAMPAIGN_TOO_LARGE', 413);
    const campaignId = randomUUID();
    // No provider is connected in Turso production; newly queued campaigns stay blocked.
    await transaction.run(
      `INSERT INTO private__depot_campaigns
         (id, name, channel, subject, body, scheduled_at, status, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 'blocked_provider', ?, ?)`,
      campaignId,
      name,
      channel,
      subject,
      body,
      new Date(scheduledAt).toISOString(),
      now.toISOString(),
      session.user.id,
    );
    for (const [destination, contactId] of unique) {
      await transaction.run(
        `INSERT INTO private__depot_deliveries
           (id, campaign_id, contact_id, destination, status, updated_at)
         VALUES (?, ?, ?, ?, 'queued', ?)
         ON CONFLICT(campaign_id, destination) DO NOTHING`,
        randomUUID(),
        campaignId,
        contactId,
        destination,
        now.toISOString(),
      );
    }
    return campaignId;
  });
}

async function cancelCampaign(database, args, now) {
  const id = args?.p_id;
  if (!UUID.test(String(id))) fail('CONTACT_INVALID');
  return withImmediateTransaction(database, async transaction => {
    const result = await transaction.run(
      `UPDATE private__depot_campaigns SET status = 'cancelled'
        WHERE id = ? AND status IN ('queued', 'blocked_provider')`,
      id,
    );
    if (Number(result?.rowsAffected ?? result?.changes) !== 1) fail('CONTACT_INVALID');
    await transaction.run(
      `UPDATE private__depot_deliveries SET status = 'cancelled', updated_at = ?
        WHERE campaign_id = ? AND status = 'queued'`,
      now.toISOString(),
      id,
    );
    return true;
  });
}

export async function readTursoContactDepot(database, { search = '', page = 0, archived = false } = {}) {
  if (typeof search !== 'string' || search.length > 120 ||
      !Number.isSafeInteger(Number(page)) || Number(page) < 0 || Number(page) > 100_000 ||
      typeof archived !== 'boolean') fail('CONTACT_INVALID');
  const offset = Number(page) * PAGE_SIZE;
  const query = search.toLocaleLowerCase('tr-TR');
  const filter = `archived = ? AND (? = '' OR instr(lower(name), lower(?)) > 0
    OR instr(lower(coalesce(email, '')), lower(?)) > 0
    OR instr(coalesce(phone, raw_phone, ''), ?) > 0)`;
  const count = await database.get(
    `SELECT COUNT(*) AS total FROM private__depot_contacts WHERE ${filter}`,
    archived ? 1 : 0,
    query, query, query, search,
  );
  const rows = await database.all(
    `SELECT * FROM private__depot_contacts WHERE ${filter}
      ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    archived ? 1 : 0,
    query, query, query, search,
    PAGE_SIZE,
    offset,
  );
  const ids = rows.map(row => row.id);
  const inClause = ids.map(() => '?').join(', ');
  const permissions = ids.length
    ? await database.all(
      `SELECT contact_id, channel, status, evidence, updated_at
         FROM private__depot_permissions WHERE contact_id IN (${inClause})`,
      ...ids,
    )
    : [];
  const sources = ids.length
    ? await database.all(
      `SELECT contact_id, COUNT(*) AS listing_count
         FROM private__depot_sources WHERE contact_id IN (${inClause}) GROUP BY contact_id`,
      ...ids,
    )
    : [];
  const permissionMap = new Map();
  for (const row of permissions) {
    const map = permissionMap.get(row.contact_id) || {};
    map[row.channel] = {
      status: row.status,
      evidence: row.evidence,
      updated_at: row.updated_at ?? null,
    };
    permissionMap.set(row.contact_id, map);
  }
  const sourceMap = new Map(sources.map(row => [row.contact_id, Number(row.listing_count)]));
  // Provider configuration from the previous backend is never considered an
  // active Turso transport. The worker remains fail-closed until explicitly built.
  const channels = CHANNELS.map(channel => ({ channel, provider: null, enabled: false }));
  const campaigns = await database.all(
    `SELECT c.id, c.name, c.channel, c.subject, c.body, c.scheduled_at,
            c.status, c.created_at,
            COUNT(d.id) AS recipients,
            SUM(CASE WHEN d.status = 'sent' THEN 1 ELSE 0 END) AS sent,
            SUM(CASE WHEN d.status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
            SUM(CASE WHEN d.status = 'failed' THEN 1 ELSE 0 END) AS failed,
            SUM(CASE WHEN d.status = 'unknown' THEN 1 ELSE 0 END) AS unknown
       FROM private__depot_campaigns c
       LEFT JOIN private__depot_deliveries d ON d.campaign_id = c.id
      GROUP BY c.id ORDER BY c.created_at DESC, c.id DESC LIMIT 20`,
  );
  return {
    total: Number(count?.total || 0),
    page: Number(page),
    page_size: PAGE_SIZE,
    contacts: rows.map(row => ({
      id: row.id,
      name: row.name,
      email: row.email ?? null,
      phone: row.phone ?? null,
      raw_phone: row.raw_phone ?? null,
      from_listing: Number(row.from_listing) === 1,
      manual: Number(row.manual) === 1,
      listing_count: sourceMap.get(row.id) || 0,
      archived: Number(row.archived) === 1,
      revision: Number(row.revision),
      created_at: row.created_at,
      updated_at: row.updated_at,
      permissions: Object.fromEntries(CHANNELS.map(channel => [
        channel,
        permissionMap.get(row.id)?.[channel] || {
          status: 'unknown', evidence: '', updated_at: null,
        },
      ])),
    })),
    campaigns: campaigns.map(row => ({
      id: row.id,
      name: row.name,
      channel: row.channel,
      subject: row.subject,
      body: row.body,
      scheduled_at: row.scheduled_at,
      status: row.status,
      created_at: row.created_at,
      recipients: Number(row.recipients || 0),
      sent: Number(row.sent || 0),
      cancelled: Number(row.cancelled || 0),
      failed: Number(row.failed || 0),
      unknown: Number(row.unknown || 0),
    })),
    channels,
  };
}

export async function mutateTursoContactDepot(database, session, operation, args, now = new Date()) {
  switch (operation) {
    case 'save_depot_contact':
      return saveContact(database, session, args, now);
    case 'set_depot_permission':
      return setPermission(database, session, args, now);
    case 'archive_depot_contact':
      return archiveContact(database, session, args, now);
    case 'preview_depot_import':
      return processImport(database, args?.p_rows, false, session, null, now);
    case 'import_depot_contacts':
      return processImport(database, args?.p_rows, true, session, args?.p_request_id, now);
    case 'queue_depot_campaign':
      return queueCampaign(database, session, args, now);
    case 'cancel_depot_campaign':
      return cancelCampaign(database, args, now);
    default:
      fail('CONTACT_INVALID', 400);
  }
}

export async function unsubscribeTursoContact(database, token, now = new Date()) {
  if (!UUID.test(String(token))) fail('CONTACT_INVALID_UNSUBSCRIBE');
  return withImmediateTransaction(database, async transaction => {
    const link = await transaction.get(
      'SELECT channel, destination FROM private__depot_optout_links WHERE token = ?',
      token,
    );
    if (!link || !CHANNELS.includes(link.channel) || !link.destination) {
      fail('CONTACT_INVALID_UNSUBSCRIBE');
    }
    const column = link.channel === 'email' ? 'email' : 'phone';
    const contact = await transaction.get(
      `SELECT id FROM private__depot_contacts WHERE ${column} = ? ORDER BY id LIMIT 1`,
      link.destination,
    );
    if (contact) {
      await revokeDestination(
        transaction, contact.id, link.channel, 'self_service_link', null, now,
      );
      await transaction.run(
        'UPDATE private__depot_contacts SET revision = revision + 1, updated_at = ? WHERE id = ?',
        now.toISOString(),
        contact.id,
      );
    } else {
      await transaction.run(
        `INSERT INTO private__depot_suppressions(channel, destination, created_at)
         VALUES (?, ?, ?) ON CONFLICT(channel, destination) DO NOTHING`,
        link.channel,
        link.destination,
        now.toISOString(),
      );
      await cancelQueuedDeliveries(transaction, link.channel, link.destination, now);
    }
    return true;
  });
}
