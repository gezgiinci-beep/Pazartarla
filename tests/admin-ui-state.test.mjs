import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdminAccessGate,createListingRefreshGuard} from '../src/lib/adminUiState.mjs';
test('restored sessions never grant UI access without a verified explicit login',()=>{
  const gate=createAdminAccessGate(),session={user:{id:'verified-admin'}};
  assert.equal(gate.allows(session),false);
  const ticket=gate.clear();
  assert.equal(gate.grant(session.user.id,ticket),true);
  assert.equal(gate.allows(session),true);
  assert.equal(gate.allows({user:{id:'ordinary-member'}}),false);
  assert.equal(gate.allows(null),false);
  gate.clear();
  assert.equal(gate.allows(session),false);
  assert.equal(gate.grant(session.user.id,ticket),false);
});
test('stale list reads cannot undo a successful first-click featured change',()=>{
  const guard=createListingRefreshGuard(),oldRead=guard.startRead();
  assert.equal(guard.beginWrite(7),true);
  assert.equal(guard.canApply(oldRead),false);
  assert.equal(guard.startRead(),null);
  assert.equal(guard.beginWrite(7),false);
  guard.endWrite(7);
  assert.equal(guard.canApply(oldRead),false);
  const fresh=guard.startRead();
  assert.equal(guard.canApply(fresh),true);
  const newer=guard.startRead();
  assert.equal(guard.canApply(fresh),false);
  assert.equal(guard.canApply(newer),true);
});
test('multiple writes stay isolated and reads resume after failure cleanup',()=>{
  const guard=createListingRefreshGuard();
  assert.equal(guard.beginWrite(7),true);
  assert.equal(guard.beginWrite(8),true);
  guard.endWrite(7);
  assert.equal(guard.startRead(),null);
  guard.endWrite(8);
  assert.equal(guard.canApply(guard.startRead()),true);
  assert.equal(guard.beginWrite(7),true);
});
