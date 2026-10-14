import test from 'node:test';
import assert from 'node:assert/strict';
import {integrateMembershipApp,RELEASE_FILES} from '../scripts/prepare-membership-release.mjs';

test('Live App receives only four anchored membership additions; unrelated code stays intact',()=>{
  const anchors=[
    "import MembershipNotice from './components/MembershipNotice';",
    "  const [storeId,setStoreId]=useState(()=>storeIdFromUrl(window.location.href));",
    "<MembershipPage key={submissionAccount.session?.user.id||'public'} state={storeMembership}",
    "            <MembershipNotice plans={storeMembership.data?.plans} onOpen={()=>changeTab('memberships')}/>",
  ];
  const source=anchors.join('\n// live guard remains\n');
  const result=integrateMembershipApp(source);
  assert.equal(result.match(/live guard remains/g).length,3);
  assert.match(result,/initialPlanId=\{membershipPreferredPlan\}/);
  assert.match(result,/setMembershipPreferredPlan\('trial-30-days'\);changeTab\('memberships'\)/);
  assert(!result.includes('offers'));
  assert.throws(()=>integrateMembershipApp(source+'\n'+anchors[0]),/ambiguous/);
  assert.throws(()=>integrateMembershipApp(source.replace(anchors[1],'')),/missing/);
});
test('Release allowlist excludes offers, listings, media, auth and hosting settings',()=>{
  assert(!RELEASE_FILES.some(path=>/offer|Storefront|ListingEditor|vercel|package\.json|lock\.yaml|migrations\//i.test(path)));
  assert(!RELEASE_FILES.includes('src/App.tsx'));
  assert.equal(new Set(RELEASE_FILES).size,RELEASE_FILES.length);
});
