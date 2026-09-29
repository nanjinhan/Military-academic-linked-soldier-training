import type { Goal, Routine, RoutineVersion, Scope, Sport, State, User, Ranking } from './types';
import { protocols } from './types';

export const RULE_VERSION = 'demo-v1-unreviewed';
export function todayISO() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date()); }
export function addDays(date: string, days: number) { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0,10); }
export function weekStart(date: string) { const day = new Date(`${date}T00:00:00Z`).getUTCDay(); return addDays(date, -(day + 6) % 7); }
export function currentGoal(state: State, userId: string) { return state.goals.filter(g=>g.userId===userId).at(-1); }
export function formatRecord(sport: Sport, value: number) { return sport === 'run' ? `${Math.floor(value/60)}:${String(Math.round(value%60)).padStart(2,'0')}` : `${value}회`; }
export function totalXp(state: State, userId: string) { return state.xp.filter(x=>x.userId===userId).reduce((n,x)=>n+x.amount,0); }
export function recalculateXp(state: State) {
  const dayTotals = new Map<string,number>(), weekTotals = new Map<string,number>();
  state.xp = state.submissions.filter(s=>s.kind==='performance' && s.status==='approved')
    .sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id)).map(s=>{
      const dayKey=`${s.userId}:${s.date}`, weekKey=`${s.userId}:${weekStart(s.date)}`;
      const base=s.completion==='complete'?80:s.completion==='partial'?40:0;
      const amount=Math.max(0, Math.min(base,100-(dayTotals.get(dayKey)||0),300-(weekTotals.get(weekKey)||0)));
      dayTotals.set(dayKey,(dayTotals.get(dayKey)||0)+amount); weekTotals.set(weekKey,(weekTotals.get(weekKey)||0)+amount);
      return {id:`xp-${s.id}`,userId:s.userId,submissionId:s.id,amount,date:s.date};
    });
}

function content(goal: Goal, sport: Sport, type: Routine['type'], factor: number): Pick<RoutineVersion,'title'|'minutes'|'intensity'|'exercises'> {
  if(type!=='training') return {title:type==='recovery'?'회복 상태 확인':'계획된 휴식',minutes:0,intensity:'회복',exercises:[]};
  const baselineMinutes=Math.min(goal.minutes,30);
  const minutes=Math.max(10,Math.min(goal.minutes,factor>1?Math.floor(baselineMinutes*factor):Math.round(baselineMinutes*factor)));
  const baselineReps=Math.round((sport==='pushup'?goal.pushup:goal.situp)*.22);
  const reps=Math.max(5,factor>1?Math.floor(baselineReps*factor):Math.round(baselineReps*factor));
  return {
    title:sport==='run'?'기초 지구력 루틴':sport==='pushup'?'상체 근지구력 루틴':'코어 안정화 루틴',minutes,intensity:factor<1?'가볍게':'보통',
    exercises:[
      {name:'가벼운 준비 운동',sets:1,reps:'5분',rest:'편안한 호흡',alternative:'가벼운 제자리 움직임'},
      sport==='run'?{name:goal.location==='indoor'?'실내 걷기 · 가벼운 조깅':'걷기 · 가벼운 조깅',sets:1,reps:`${Math.max(5,minutes-10)}분`,rest:'필요할 때 걷기',alternative:goal.equipment?'실내 자전거':'제자리 걷기'}:
      {name:sport==='pushup'?'팔굽혀펴기':'윗몸일으키기',sets:3,reps:`${reps}회`,rest:'세트 사이 60초',alternative:sport==='pushup'?'무릎 대고 팔굽혀펴기':'누워서 복부 힘주기'},
      {name:'마무리 · 호흡 정리',sets:1,reps:'5분',rest:'충분히 쉬기',alternative:'앉아서 호흡 정리'}
    ]
  };
}

export function regenerate(state: State, userId: string, reason: string, date=todayISO(), at=new Date().toISOString()) {
  const goal=currentGoal(state,userId); if(!goal) return;
  const recovery=state.recovery.filter(r=>r.userId===userId).at(-1);
  const recent=state.submissions.filter(s=>s.userId===userId && s.kind==='performance' && s.status==='approved').sort((a,b)=>a.date.localeCompare(b.date)).at(-1);
  const pain=!!recovery?.pain, tired=(recovery?.fatigue||0)>=4;
  let factor=1;
  if(tired || recent && (recent.rpe>=8||recent.completion!=='complete')) factor=.8;
  else if(recent?.completion==='complete' && recent.rpe<=5 && !pain) factor=1.05;
  const explanation=pain?'통증이 보고되어 운동량 제시를 멈췄어요. 상태를 확인한 뒤 다시 계획해요.':tired?'피로도가 높아 다음 운동량을 완화했어요.':factor<1?'인증된 부분 수행 또는 높은 체감 난도를 반영해 운동량을 줄였어요.':factor>1?'인증된 수행과 여유 있는 체감 난도를 반영했어요. 증가는 예시 상한 5% 이내예요.':reason;
  const measurements=state.submissions.filter(s=>s.userId===userId&&s.kind==='measurement'&&s.status==='approved').sort((a,b)=>a.date.localeCompare(b.date));
  const sports: Sport[]=['run','pushup','situp'];
  const gaps=sports.map(sport=>{ const m=measurements.filter(m=>m.sport===sport).at(-1); const value=m?.value; return {sport,gap:value?(sport==='run'?value/goal.run:goal[sport]/value):1}; }).sort((a,b)=>b.gap-a.gap);
  const priority=gaps.map(g=>g.sport);
  for(let i=0;i<7;i++) {
    const sessionDate=addDays(date,i), id=`routine-${userId}-${sessionDate}`;
    const old=state.routines.find(r=>r.id===id);
    // A submitted session is immutable, even when its verification is delayed or revoked.
    if(state.submissions.some(s=>s.routineId===id)) continue;
    const day=new Date(`${sessionDate}T00:00:00Z`).getUTCDay();
    const priorTraining=state.routines.filter(r=>r.userId===userId&&r.date<sessionDate&&r.date>=addDays(sessionDate,-2)&&r.type==='training').length;
    const allowed=goal.days.includes(day)&&!goal.excludedDates.includes(sessionDate)&&(!goal.targetDate||sessionDate<=goal.targetDate)&&priorTraining<2;
    const type=allowed?(pain?'recovery':'training'):'rest';
    const sport=priority[i%3];
    const version: RoutineVersion={version:(old?.version||0)+1,at,reason:explanation,ruleVersion:RULE_VERSION,goalId:goal.id,...content(goal,sport,type,factor)};
    if(old) { old.history.push({...old,history:undefined} as unknown as RoutineVersion); Object.assign(old,version,{type,sport}); }
    else state.routines.push({id,userId,date:sessionDate,type,sport,history:[],...version});
  }
}

export function ranking(state: State, viewer: User, sport: Sport, scope: Scope, date=todayISO()): Ranking {
  // Region and corps are independent classifications, not a disclosure hierarchy.
  const visible:Record<Scope|'private',Scope[]>={private:[],unit:['unit'],corps:['unit','corps'],region:['unit','region'],national:['unit','corps','region','national']};
  const start=addDays(date,-29);
  const users=state.users.filter(u=>u.role==='soldier'&&u.group===viewer.group&&visible[u.shareScope].includes(scope)&&
    (scope==='national'||u[scope]===viewer[scope]));
  const best=users.flatMap(u=>{
    const rows=state.submissions.filter(s=>s.userId===u.id&&s.kind==='measurement'&&s.status==='approved'&&s.sport===sport&&s.protocol===protocols[sport]&&s.group===viewer.group&&s.date>=start&&s.date<=date);
    rows.sort((a,b)=>(sport==='run'?a.value-b.value:b.value-a.value)||b.date.localeCompare(a.date));
    return rows.length?[{user:u,record:rows[0]}]:[];
  }).sort((a,b)=>(sport==='run'?a.record.value-b.record.value:b.record.value-a.record.value)||a.user.nickname.localeCompare(b.user.nickname));
  let previous=NaN,rank=0;
  const rows=best.map((entry,i)=>{ if(entry.record.value!==previous)rank=i+1;previous=entry.record.value; return {rank,nickname:entry.user.nickname,userId:entry.user.id===viewer.id?viewer.id:'',value:entry.record.value,date:entry.record.date,mine:entry.user.id===viewer.id,percentile:Math.round(rank/best.length*100)}; });
  return {rows:rows.length>=3?rows:[],participants:rows.length,suppressed:rows.length<3,sport,scope,protocol:protocols[sport],period:`${start} ~ ${date}`,group:viewer.group,minimum:3};
}
