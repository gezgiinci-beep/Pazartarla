// Offline candidate assembler. Never fetches credentials, applies SQL or publishes.
import {readFile,writeFile,copyFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const LIVE_BASE='858f0f161da3c782410a0249687632c6fd556afd';
export const RELEASE_FILES=[
  'src/components/TrialPromotion.tsx','src/components/trial-promotion.css',
  'src/components/MembershipPage.tsx','src/components/MembershipNotice.tsx',
  'src/components/MembershipAdmin.tsx','src/components/SubmissionAccountPanel.tsx',
  'src/components/membership.css','src/lib/storeMembership.ts',
  'src/hooks/useStoreMembership.ts','src/hooks/useSubmissionAccount.ts',
  'supabase/reviewed_changes/20261005_annual_unlimited_store_plan.sql',
  'supabase/reviewed_changes/20261005_annual_unlimited_store_plan.md',
  'supabase/reviewed_changes/20261005_free_store_trial.sql',
  'supabase/reviewed_changes/20261005_free_store_trial.md',
  'supabase/MEMBERSHIP_TRIAL_RELEASE.md',
  'tests/free-store-trial.test.mjs','tests/annual-store-plan.test.mjs',
  'tests/membership-release.test.mjs',
  'scripts/check-annual-store-plan-local.mjs','scripts/prepare-membership-release.mjs',
];
export function integrateMembershipApp(source){
  const edits=[
    ["import MembershipNotice from './components/MembershipNotice';",
      "import MembershipNotice from './components/MembershipNotice';\nimport TrialPromotion from './components/TrialPromotion';"],
    ["  const [storeId,setStoreId]=useState(()=>storeIdFromUrl(window.location.href));",
      "  const [storeId,setStoreId]=useState(()=>storeIdFromUrl(window.location.href));\n  const [membershipPreferredPlan,setMembershipPreferredPlan]=useState('');"],
    ["<MembershipPage key={submissionAccount.session?.user.id||'public'} state={storeMembership}",
      "<MembershipPage key={submissionAccount.session?.user.id||'public'} initialPlanId={membershipPreferredPlan} state={storeMembership}"],
    ["            <MembershipNotice plans={storeMembership.data?.plans} onOpen={()=>changeTab('memberships')}/>",
      "            <TrialPromotion ready={!!storeMembership.data?.plans.some(plan=>plan.id==='trial-30-days')}\n"+
      "              used={!!storeMembership.data?.mine?.trial_used}\n"+
      "              onOpenTrial={()=>{setMembershipPreferredPlan('trial-30-days');changeTab('memberships');}}/>\n"+
      "            <MembershipNotice plans={storeMembership.data?.plans} onOpen={()=>changeTab('memberships')}/>"],
  ];
  let result=source;
  for(const [before,after] of edits){
    if(result.split(before).length!==2)throw Error('Live App anchor missing or ambiguous. Reinspect the current www release.');
    result=result.replace(before,after);
  }
  return result;
}

async function main(){
  const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
  const candidate=resolve(process.argv[2]||'');
  if(!process.argv[2]||candidate===root)throw Error('Pass a separate clean checkout of the verified www commit.');
  const git=(...args)=>execFileSync('git',['-C',candidate,...args],{encoding:'utf8'}).trim();
  if(resolve(git('rev-parse','--show-toplevel'))!==candidate)throw Error('Candidate must be its own repository.');
  if(git('rev-parse','HEAD')!==LIVE_BASE||git('status','--porcelain'))throw Error('Candidate base is stale or dirty. Refusing to replace files.');
  const liveApp=await readFile(resolve(candidate,'src/App.tsx'),'utf8');
  // Unrelated listing/auth guards, dependencies, storefront, SQL prerequisites
  // and all existing release changes stay byte-for-byte on the live tree.
  await writeFile(resolve(candidate,'src/App.tsx'),integrateMembershipApp(liveApp));
  for(const path of RELEASE_FILES){
    await mkdir(dirname(resolve(candidate,path)),{recursive:true});
    await copyFile(resolve(root,path),resolve(candidate,path));
  }
  const changed=git('diff','--name-only','HEAD').split(/\r?\n/).filter(Boolean);
  const added=git('ls-files','--others','--exclude-standard').split(/\r?\n/).filter(Boolean);
  const allowed=new Set(['src/App.tsx',...RELEASE_FILES]);
  if([...changed,...added].some(path=>!allowed.has(path)))throw Error('Unexpected candidate change.');
  console.log('Prepared offline www-only candidate on '+LIVE_BASE);
  console.log([...changed,...added].sort().join('\n'));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(error=>{console.error(error.message);process.exitCode=1;});
}
