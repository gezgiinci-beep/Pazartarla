import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTestDatabase} from '../scripts/listing-editor-test-db.mjs';
import {readdir,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

test('browser fixture uses real SQL: preserves data, hides edits, rejects other actors, and reapproves exact content', async () => {
  const db = await createTestDatabase();
  try {
    const get = actor => db.as(actor, async c => (await c.query('SELECT public.get_listing_for_edit(1) result')).rows[0].result);
    const update = (actor, changes, token) => db.as(actor,async c => (await c.query(
      'SELECT public.update_listing_details(1,$1::jsonb,$2) result',[JSON.stringify(changes),token])).rows[0].result);
    const visible = () => db.as('anonymous',async c => (await c.query('SELECT id FROM public.listings')).rowCount);
    const original = await get('owner');
    assert.deepEqual(original.listing,db.baseline);
    assert.equal(await visible(),1);
    const result = await update('owner',{title:'Browser synthetic correction',price:175},original.edit_token);
    assert.equal(result.changed,true);
    assert.equal(result.reapproval_required,true);
    assert.equal(result.listing.status,'pending');
    assert.equal(await visible(),0);
    for (const key of ['id','submitted_by','created_at','expires_at','image','seotags','mode','description','seller','phone'])
      assert.deepEqual(result.listing[key],db.baseline[key]);
    for (const actor of ['other','anonymous']) {
      await assert.rejects(() => get(actor),e => e.code === '42501');
      await assert.rejects(() => update(actor,{title:'Unauthorized overwrite'},original.edit_token),e => e.code === '42501');
    }
    await assert.rejects(() => update('owner',{price:200},original.edit_token),e => e.code === '40001');
    const queue = await db.as('admin',async c => (await c.query('SELECT public.get_listing_moderation_queue() result')).rows[0].result);
    await assert.rejects(() => db.as('owner',c => c.query("SELECT public.moderate_listing_snapshot(1,'approved',$1)",[queue[0].edit_token])),e => e.code === '42501');
    const approved = await db.as('admin',async c => (await c.query("SELECT public.moderate_listing_snapshot(1,'approved',$1) result",[queue[0].edit_token])).rows[0].result);
    assert.equal(approved.listing.status,'approved');
    assert.equal(approved.listing.title,result.listing.title);
    assert.equal(await visible(),1);
    const fresh = await get('admin');
    const adminEdit = await update('admin',{description:'Admin correction'},fresh.edit_token);
    assert.equal(adminEdit.reapproval_required,false);
    assert.equal(adminEdit.listing.status,'approved');
  } finally {
    await db.close();
  }
});

test('cleanup removes its fixture even if a workflow already stopped PostgreSQL', async () => {
  const before = new Set(await readdir(tmpdir()));
  const db = await createTestDatabase();
  const added = (await readdir(tmpdir())).filter(name => name.startsWith('listing-editor-browser-') && !before.has(name));
  assert.equal(added.length,1);
  const dir = join(tmpdir(),added[0]);
  try {
    await promisify(execFile)('pg_ctl',['-D',join(dir,'data'),'-m','fast','-w','stop'],{
      env:{PATH:process.env.PATH,HOME:dir,LANG:'C'},
    });
  } finally {
    await db.close();
  }
  await assert.rejects(() => access(dir),error => error.code === 'ENOENT');
});
