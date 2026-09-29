import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeed } from '../lib/domain/seed';
import { addDays, currentGoal, ranking, recalculateXp, regenerate, todayISO, totalXp } from '../lib/domain/rules';
import { AppError, saveGoal, saveRecovery, savePreferences, snapshot, submit, review, resubmit, goalSchema } from '../lib/server/service';
import type { State, User } from '../lib/domain/types';

const setup=()=>{const state=createSeed();return {state,user:state.users.find(u=>u.id==='u01')!,admin:state.users.find(u=>u.id==='a01')!};};
function goalInput(state:State,user:User){const {id,userId,createdAt,...input}=currentGoal(state,user.id)!;return input;}
function performance(state:State,user:User,key='test-request-123'){
 const goal=currentGoal(state,user.id)!;goal.days=[0,1,2,3,4,5,6];
 // Ensure a controlled available session today without mutating submitted history.
 state.routines=state.routines.filter(r=>r.userId!==user.id||r.date!==addDays(todayISO(),-1));
 regenerate(state,user.id,'test');const routine=state.routines.find(r=>r.userId===user.id&&r.date===todayISO())!;
 return {kind:'performance' as const,routineId:routine.id,date:routine.date,sport:routine.sport,value:0,completion:'complete' as const,minutes:25,rpe:5,fatigue:2,pain:false,evidence:'현장 확인 완료',idempotencyKey:key};
}
const expectError=(fn:()=>unknown,code:string)=>assert.throws(fn,e=>e instanceof AppError&&e.code===code);

test('goal → submission → approval updates XP without changing official results',()=>{
 const {state,user,admin}=setup();const officials=JSON.stringify(state.officials);const before=totalXp(state,user.id);
 saveGoal(state,user,{...goalInput(state,user),grade:'개인 기록 향상',targetDate:null});
 const input=performance(state,user);const original=structuredClone(state.routines.find(r=>r.id===input.routineId));const row=submit(state,user,input);
 assert.equal(row.status,'pending');assert.equal(totalXp(state,user.id),before);
 review(state,admin,{ids:[row.id],action:'approved',reason:'현장 수행 확인',confirmed:true});
 assert.equal(row.status,'approved');assert.equal(totalXp(state,user.id),before+80);assert.equal(state.reviews.at(-1)?.adminId,admin.id);
 assert.deepEqual(state.routines.find(r=>r.id===input.routineId),original);assert.equal(JSON.stringify(state.officials),officials);
 assert.ok(state.routines.some(r=>r.userId===user.id&&r.date>todayISO()&&r.reason.includes('인증된 수행')));
});
test('idempotent retries do not create duplicate submissions, conflicting payloads fail',()=>{
 const{state,user}=setup();const input=performance(state,user),row=submit(state,user,input),length=state.submissions.length;
 assert.equal(submit(state,user,input).id,row.id);assert.equal(state.submissions.length,length);
 expectError(()=>submit(state,user,{...input,minutes:26}),'IDEMPOTENCY_CONFLICT');
 expectError(()=>submit(state,user,{...input,idempotencyKey:'second-key-123'}),'DUPLICATE_SESSION');
});
test('role and unit checks deny soldier approvals and cross-unit certification',()=>{
 const{state,user,admin}=setup();const row=state.submissions.find(s=>s.userId==='u08'&&s.status==='approved')!;
 expectError(()=>review(state,user,{ids:[row.id],action:'revoked',reason:'테스트',confirmed:true}),'ADMIN_REQUIRED');
 expectError(()=>review(state,admin,{ids:[row.id],action:'revoked',reason:'테스트',confirmed:true}),'SCOPE_DENIED');
 const soldierSnapshot=snapshot(state,user,true);assert.ok(soldierSnapshot.submissions.every(s=>s.userId===user.id));assert.equal(soldierSnapshot.members.length,0);
 const adminSnapshot=snapshot(state,admin,true);assert.ok(adminSnapshot.members.every(m=>m.unit===admin.unit));assert.equal(adminSnapshot.members.length,6);
});
test('batch approval validates every row before any mutation',()=>{
 const{state,admin}=setup();const own=state.submissions.find(s=>s.id==='pending-1')!,foreign=state.submissions.find(s=>s.userId==='u08')!;const count=state.reviews.length;
 expectError(()=>review(state,admin,{ids:[own.id,foreign.id],action:'approved',reason:'현장 확인',confirmed:true}),'SCOPE_DENIED');
 assert.equal(own.status,'pending');assert.equal(state.reviews.length,count);
 assert.throws(()=>review(state,admin,{ids:[own.id],action:'approved',reason:'확인',confirmed:false}));
});
test('changes can be supplemented and resubmitted; approved records cannot be silently edited',()=>{
 const{state,user,admin}=setup();const row=submit(state,user,performance(state,user));
 review(state,admin,{ids:[row.id],action:'changes',reason:'실제 수행량 확인 필요',confirmed:true});
 resubmit(state,user,row.id,{evidence:'수행 현장과 실제 20분 확인',value:0,minutes:20});assert.equal(row.status,'pending');assert.ok(state.audits.some(a=>a.action.startsWith('submission.revised:')));
 review(state,admin,{ids:[row.id],action:'approved',reason:'보완 자료 확인',confirmed:true});
 expectError(()=>resubmit(state,user,row.id,{evidence:'변경 시도',value:0,minutes:30}),'INVALID_TRANSITION');
});
test('revocation recalculates XP, retains reviews, and disallows repeated approval',()=>{
 const{state,user,admin}=setup();const baseline=totalXp(state,user.id),row=submit(state,user,performance(state,user));
 review(state,admin,{ids:[row.id],action:'approved',reason:'직접 확인',confirmed:true});
 expectError(()=>review(state,admin,{ids:[row.id],action:'approved',reason:'중복 확인',confirmed:true}),'INVALID_TRANSITION');
 review(state,admin,{ids:[row.id],action:'revoked',reason:'대상 오류 정정',confirmed:true});
 assert.equal(totalXp(state,user.id),baseline);assert.equal(state.reviews.filter(r=>r.submissionId===row.id).length,2);
});
test('pain protects future sessions before certification, high fatigue reduces volume',()=>{
 const{state,user}=setup();const input=performance(state,user);const row=submit(state,user,{...input,pain:true});
 assert.equal(row.status,'pending');assert.ok(state.routines.some(r=>r.userId===user.id&&r.date>todayISO()&&r.type==='recovery'));
 assert.ok(state.routines.filter(r=>r.userId===user.id&&r.date>todayISO()).every(r=>r.type!=='training'));
 saveRecovery(state,user,{pain:false,fatigue:5});
 assert.ok(state.routines.filter(r=>r.userId===user.id&&r.date>todayISO()&&r.type==='training').every(r=>r.minutes<=24));
});
test('pending easy performance never raises workload based on unverified input',()=>{
 const{state,user}=setup();const row=submit(state,user,{...performance(state,user),rpe:1});
 assert.equal(row.status,'pending');assert.ok(state.routines.filter(r=>r.userId===user.id&&r.date>todayISO()&&r.type==='training').every(r=>r.minutes<=30));
});
test('goal changes preserve submitted versions, honor excluded days and recovery spacing',()=>{
 const{state,user}=setup();const row=submit(state,user,performance(state,user));const original=structuredClone(state.routines.find(r=>r.id===row.routineId));
 const excluded=addDays(todayISO(),1);saveGoal(state,user,{...goalInput(state,user),days:[0,1,2,3,4,5,6],excludedDates:[excluded],targetDate:addDays(todayISO(),5),minutes:15});
 assert.deepEqual(state.routines.find(r=>r.id===row.routineId),original);assert.equal(state.routines.find(r=>r.userId===user.id&&r.date===excluded)?.type,'rest');
 assert.ok(state.routines.filter(r=>r.userId===user.id&&r.date>todayISO()&&r.type==='training').every(r=>r.minutes<=15));
 const upcoming=state.routines.filter(r=>r.userId===user.id&&r.date>=todayISO()).sort((a,b)=>a.date.localeCompare(b.date));
 for(let i=2;i<upcoming.length;i++)assert.ok(!upcoming.slice(i-2,i+1).every(r=>r.type==='training'));
});
test('input validation rejects impossible dates, future results, invalid RPE and empty schedules',()=>{
 const{state,user}=setup();assert.throws(()=>goalSchema.parse({...goalInput(state,user),days:[]}));assert.throws(()=>goalSchema.parse({...goalInput(state,user),targetDate:'2026-02-30'}));
 const input=performance(state,user);expectError(()=>submit(state,user,{...input,date:addDays(todayISO(),1)}),'FUTURE_DATE');assert.throws(()=>submit(state,user,{...input,rpe:0}));
 expectError(()=>submit(state,user,{...input,completion:'missed',minutes:20}),'MISSED_AMOUNT');
});
test('self-recording is never XP, measurement ranking, or an approval candidate',()=>{
 const{state,user,admin}=setup(),before=totalXp(state,user.id);const count=ranking(state,user,'run','unit').participants;
 const row=submit(state,user,{kind:'self',date:todayISO(),sport:'run',value:700,minutes:20,completion:'complete',rpe:5,fatigue:2,pain:false,evidence:'자율 운동 기록',idempotencyKey:'self-record-123'});
 recalculateXp(state);assert.equal(totalXp(state,user.id),before);assert.equal(ranking(state,user,'run','unit').participants,count);
 expectError(()=>review(state,admin,{ids:[row.id],action:'revoked',reason:'직접 확인',confirmed:true}),'SELF_RECORD');
});
test('ranking uses verified measurement protocol, assessment group, time window and privacy',()=>{
 const{state,user}=setup();assert.equal(ranking(state,user,'run','unit').participants,6);
 state.submissions.filter(s=>s.userId==='u02'&&s.sport==='run').forEach(s=>s.protocol='different');
 state.submissions.filter(s=>s.userId==='u03'&&s.sport==='run').forEach(s=>s.group='other-group');
 state.submissions.filter(s=>s.userId==='u04'&&s.sport==='run').forEach(s=>s.date=addDays(todayISO(),-40));
 assert.equal(ranking(state,user,'run','unit').participants,3);
 savePreferences(state,user,{shareScope:'private'});const hidden=ranking(state,user,'run','unit');assert.equal(hidden.participants,2);assert.equal(hidden.suppressed,true);assert.equal(hidden.rows.length,0);
});
test('same value has competition rank and revoking a measurement recomputes best record',()=>{
 const{state,user,admin}=setup();const m1=state.submissions.filter(s=>s.userId==='u01'&&s.kind==='measurement'&&s.sport==='run'&&s.status==='approved').at(-1)!;const m2=state.submissions.filter(s=>s.userId==='u02'&&s.kind==='measurement'&&s.sport==='run'&&s.status==='approved').at(-1)!;
 m2.value=m1.value;const board=ranking(state,user,'run','unit');assert.deepEqual(board.rows.slice(0,3).map(r=>r.rank),[1,1,3]);
 review(state,admin,{ids:[m1.id],action:'revoked',reason:'측정 정정 필요',confirmed:true});assert.ok(ranking(state,user,'run','unit').rows.find(r=>r.mine)!.value>m1.value);
 assert.ok(board.rows.filter(r=>!r.mine).every(r=>r.userId===''));
});
test('national region corps and unit remain distinct scopes',()=>{
 const{state,user}=setup();assert.equal(ranking(state,user,'run','national').participants,18);assert.equal(ranking(state,user,'run','region').participants,12);assert.equal(ranking(state,user,'run','corps').participants,12);assert.equal(ranking(state,user,'run','unit').participants,6);
});
test('region-only consent does not imply corps consent and intensity rounding respects five percent',()=>{
 const{state,user,admin}=setup();savePreferences(state,user,{shareScope:'region'});
 assert.equal(ranking(state,user,'run','corps').participants,11);assert.equal(ranking(state,user,'run','region').participants,12);
 const row=submit(state,user,performance(state,user));review(state,admin,{ids:[row.id],action:'approved',reason:'가상 현장 확인',confirmed:true});
 const future=state.routines.filter(r=>r.userId===user.id&&r.date>todayISO()&&r.type==='training');
 assert.ok(future.every(r=>r.minutes<=30*1.05));
});
test('old records cannot clear a current pain signal',()=>{
 const{state,user}=setup();saveRecovery(state,user,{pain:true,fatigue:4});
 submit(state,user,{kind:'measurement',date:addDays(todayISO(),-2),sport:'run',value:860,minutes:15,completion:'complete',rpe:5,fatigue:2,pain:false,evidence:'과거 측정 기록 입력',idempotencyKey:'old-measurement-123'});
 assert.equal(state.recovery.filter(r=>r.userId===user.id).at(-1)?.pain,true);
});
test('XP daily and weekly caps withstand recalculation and oversized activity',()=>{
 const{state,user}=setup();state.submissions=state.submissions.filter(s=>s.userId!==user.id||s.kind!=='performance');
 const base=state.submissions[0];for(let i=0;i<10;i++)state.submissions.push({...base,id:`cap-${i}`,userId:user.id,kind:'performance',minutes:180,completion:'complete',status:'approved',date:addDays('2026-09-21',Math.floor(i/2)),idempotencyKey:`cap-request-${i}`});
 recalculateXp(state);assert.equal(totalXp(state,user.id),300);const once=JSON.stringify(state.xp);recalculateXp(state);assert.equal(JSON.stringify(state.xp),once);
 const daily=new Map<string,number>();for(const x of state.xp.filter(x=>x.userId===user.id))daily.set(x.date,(daily.get(x.date)||0)+x.amount);assert.ok([...daily.values()].every(v=>v<=100));
});
