import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { State, User, Snapshot, Status } from '../domain/types';
import { protocols } from '../domain/types';
import { currentGoal, recalculateXp, regenerate, todayISO, totalXp } from '../domain/rules';

export class AppError extends Error { constructor(public status:number, public code:string, message:string){super(message);} }
const fail=(status:number,code:string,message:string):never=>{throw new AppError(status,code,message)};
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>{const d=new Date(`${s}T00:00:00Z`);return !Number.isNaN(+d)&&d.toISOString().slice(0,10)===s},'유효한 날짜를 입력해 주세요.');
const sport=z.enum(['run','pushup','situp']);
const reason=z.string().trim().min(2,'처리 사유를 2자 이상 입력해 주세요.').max(500);
export const goalSchema=z.object({grade:z.enum(['특급 도전','1급 도전','개인 기록 향상']),targetDate:date.nullable(),run:z.number().int().min(600).max(2400),pushup:z.number().int().min(1).max(200),situp:z.number().int().min(1).max(200),days:z.array(z.number().int().min(0).max(6)).min(1).max(7).refine(d=>new Set(d).size===d.length),minutes:z.number().int().min(10).max(90),location:z.enum(['indoor','outdoor','both']),equipment:z.boolean(),excludedDates:z.array(date).max(60)}).strict();
export const submissionSchema=z.object({kind:z.enum(['performance','measurement','self']),routineId:z.string().max(100).optional(),date,sport,value:z.number().min(0).max(7200),completion:z.enum(['complete','partial','missed']),minutes:z.number().int().min(0).max(180),rpe:z.number().int().min(1).max(10),fatigue:z.number().int().min(1).max(5),pain:z.boolean(),evidence:z.string().trim().min(3).max(1000),idempotencyKey:z.string().min(8).max(100)}).strict();
export const reviewSchema=z.object({ids:z.array(z.string().max(100)).min(1).max(30).refine(ids=>new Set(ids).size===ids.length),action:z.enum(['approved','changes','rejected','revoked']),reason,confirmed:z.literal(true)}).strict();
export const recoverySchema=z.object({fatigue:z.number().int().min(1).max(5),pain:z.boolean()}).strict();
export const preferenceSchema=z.object({shareScope:z.enum(['private','unit','corps','region','national'])}).strict();
function soldier(user:User){if(user.role!=='soldier')fail(403,'ROLE_REQUIRED','장병 계정에서 이용해 주세요.');}
function audit(state:State,user:User,action:string,targetId:string){state.audits.push({id:randomUUID(),actorId:user.id,action,targetId,at:new Date().toISOString()});}

export function snapshot(state:State,user:User,demo:boolean):Snapshot {
  const members=user.role==='admin'?state.users.filter(u=>u.role==='soldier'&&u.unit===user.unit):[];
  const allowed=new Set(user.role==='admin'?members.map(u=>u.id):[user.id]);
  const submissions=state.submissions.filter(s=>allowed.has(s.userId)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  const ids=new Set(submissions.map(s=>s.id));
  const xp=state.xp.filter(x=>x.userId===user.id),total=totalXp(state,user.id);
  return {me:user,today:todayISO(),goal:currentGoal(state,user.id),routines:state.routines.filter(r=>r.userId===user.id).sort((a,b)=>a.date.localeCompare(b.date)),submissions,reviews:state.reviews.filter(r=>ids.has(r.submissionId)),officials:state.officials.filter(o=>o.userId===user.id),recovery:state.recovery.filter(r=>r.userId===user.id).at(-1),xp,totalXp:total,level:Math.floor(total/200)+1,demo,members,memberGoals:members.flatMap(m=>{const g=currentGoal(state,m.id);return g?[g]:[]}),memberOfficials:state.officials.filter(o=>members.some(m=>m.id===o.userId)),memberXp:state.xp.filter(x=>members.some(m=>m.id===x.userId)),audits:user.role==='admin'?state.audits.filter(a=>allowed.has(a.actorId)||a.actorId===user.id):[]};
}
export function saveGoal(state:State,user:User,input:unknown) {
  soldier(user); const data=goalSchema.parse(input);
  if(data.targetDate&&data.targetDate<=todayISO()) fail(422,'GOAL_DATE','목표일은 오늘 이후로 설정해 주세요.');
  const goal={...data,id:randomUUID(),userId:user.id,createdAt:new Date().toISOString()};
  state.goals.push(goal);regenerate(state,user.id,'목표와 가능한 일정을 바꾸어 미실행 회차를 다시 구성했어요.');audit(state,user,'goal.updated',goal.id);return goal;
}
export function saveRecovery(state:State,user:User,input:unknown){soldier(user);const data=recoverySchema.parse(input); const row={...data,id:randomUUID(),userId:user.id,at:new Date().toISOString()};state.recovery.push(row);regenerate(state,user.id,'오늘의 회복 상태를 반영했어요.');audit(state,user,'recovery.updated',row.id);return row;}
export function savePreferences(state:State,user:User,input:unknown){soldier(user);const data=preferenceSchema.parse(input);user.shareScope=data.shareScope;audit(state,user,'privacy.updated',user.id);return user;}
export function submit(state:State,user:User,input:unknown){
  soldier(user);const data=submissionSchema.parse(input);
  if(data.date>todayISO())fail(422,'FUTURE_DATE','미래의 수행이나 측정을 제출할 수 없어요.');
  const previous=state.submissions.find(s=>s.userId===user.id&&s.idempotencyKey===data.idempotencyKey);
  if(previous){if(Object.entries(data).some(([key,value])=>previous[key as keyof typeof previous]!==value))fail(409,'IDEMPOTENCY_CONFLICT','이미 다른 내용으로 사용한 요청 번호예요.');return previous;}
  if(data.kind==='performance'){
    const routine=state.routines.find(r=>r.id===data.routineId&&r.userId===user.id);
    if(!routine)fail(404,'ROUTINE_NOT_FOUND','본인의 루틴을 찾을 수 없어요.');
    if(routine!.type!=='training')fail(422,'REST_SESSION','휴식·회복 회차에는 수행 인증을 요청하지 않아요.');
    if(data.date!==routine!.date||data.sport!==routine!.sport)fail(422,'ROUTINE_MISMATCH','루틴 날짜와 종목이 일치하지 않아요.');
    if(state.submissions.some(s=>s.routineId===data.routineId))fail(409,'DUPLICATE_SESSION','이미 제출한 회차예요. 보완 요청은 기존 기록에서 다시 제출해 주세요.');
    if(data.completion!=='missed'&&data.minutes===0)fail(422,'PERFORMANCE_AMOUNT','실제 수행 시간을 입력해 주세요.');
    if(data.completion==='missed'&&data.minutes!==0)fail(422,'MISSED_AMOUNT','미수행의 수행 시간은 0분이에요.');
  } else {
    if(data.routineId)fail(422,'INVALID_ROUTINE_LINK','루틴 수행에만 회차를 연결할 수 있어요.');
    if(data.sport==='run'&&(data.value<300||data.value>3600)||data.sport!=='run'&&(!Number.isInteger(data.value)||data.value<1||data.value>200))fail(422,'MEASUREMENT_RANGE','기록값의 단위와 범위를 확인해 주세요.');
  }
  const at=new Date().toISOString();
  const row={...data,id:randomUUID(),userId:user.id,protocol:protocols[data.sport],group:user.group,status:(data.kind==='self'?'approved':'pending') as Status,createdAt:at,updatedAt:at};
  state.submissions.push(row);
  const currentRecovery=state.recovery.filter(r=>r.userId===user.id).at(-1);
  // Backdated input cannot silently clear a more recent pain signal.
  if(data.pain||data.date===todayISO())state.recovery.push({id:randomUUID(),userId:user.id,fatigue:data.fatigue,pain:data.pain||!!currentRecovery?.pain,at});
  regenerate(state,user.id,'인증 대기 중에는 현재 계획의 강도를 유지해요.');audit(state,user,'submission.created',row.id);return row;
}
export function resubmit(state:State,user:User,id:string,input:unknown){
  soldier(user); const data=z.object({evidence:z.string().trim().min(3).max(1000),value:z.number().min(0).max(3600),minutes:z.number().int().min(0).max(180)}).strict().parse(input);
  const row=state.submissions.find(s=>s.id===id&&s.userId===user.id);if(!row)fail(404,'NOT_FOUND','기록을 찾을 수 없어요.');
  if(row!.status!=='changes')fail(409,'INVALID_TRANSITION','보완 요청된 기록만 다시 제출할 수 있어요.');
  if(row!.kind==='measurement'&&(row!.sport==='run'?data.value<300:!Number.isInteger(data.value)||data.value<1||data.value>200))fail(422,'MEASUREMENT_RANGE','측정값을 확인해 주세요.');
  if(row!.kind==='performance'&&(row!.completion==='missed'?data.minutes!==0:data.minutes===0))fail(422,'PERFORMANCE_AMOUNT','수행 구분에 맞는 시간을 입력해 주세요.');
  // Original submission fields are retained as an immutable revision in the audit action.
  audit(state,user,`submission.revised:${JSON.stringify({evidence:row!.evidence,value:row!.value,minutes:row!.minutes})}`,id);
  Object.assign(row!,data,{status:'pending',updatedAt:new Date().toISOString()});return row;
}
export function review(state:State,user:User,input:unknown){
  if(user.role!=='admin')fail(403,'ADMIN_REQUIRED','관리자 권한이 필요해요.');
  const data=reviewSchema.parse(input);
  // Validate the complete batch before any mutation: all or nothing.
  const rows=data.ids.map(id=>{
    const row=state.submissions.find(s=>s.id===id),owner=state.users.find(u=>u.id===row?.userId);
    if(!row||!owner||owner.unit!==user.unit||owner.id===user.id)fail(403,'SCOPE_DENIED','소속 부대의 기록만 처리할 수 있어요.');
    if(row!.kind==='self')fail(422,'SELF_RECORD','자가 기록은 관리자 인증 대상이 아니에요.');
    const expected=data.action==='revoked'?'approved':'pending';
    if(row!.status!==expected)fail(409,'INVALID_TRANSITION','이미 처리된 기록이 포함되어 있어요. 목록을 새로 확인해 주세요.');
    return row!;
  });
  const at=new Date().toISOString();
  for(const row of rows){row.status=data.action;row.updatedAt=at;state.reviews.push({id:randomUUID(),submissionId:row.id,adminId:user.id,action:data.action,reason:data.reason,at});audit(state,user,`review.${data.action}`,row.id);}
  recalculateXp(state);
  for(const userId of new Set(rows.map(s=>s.userId))) regenerate(state,userId,data.action==='revoked'?'인증 취소를 반영해 다음 계획을 다시 검토했어요.':'새로 확인된 수행·측정 기록을 다음 계획에 반영했어요.');
  return rows;
}
