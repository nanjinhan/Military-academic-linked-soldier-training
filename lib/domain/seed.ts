import type { State, User, Goal, Submission } from './types';
import { protocols } from './types';
import { addDays, recalculateXp, regenerate, todayISO } from './rules';

export function createSeed(today=todayISO()): State {
  const state:State={schemaVersion:1,users:[],goals:[],routines:[],submissions:[],reviews:[],officials:[],recovery:[],xp:[],audits:[]};
  const nicknames=['꾸준한 도윤','페이스메이커','민트러너','한 걸음 더','새벽의 질주','코어메이트','오늘도 완주','런앤리프트','도전하는 현우','스마일 러너','차근차근','푸른 바람','온유한 챔피언','좋은 페이스','한결같이','태양 러너','힘찬 발걸음','매일 한 세트'];
  for(let i=0;i<18;i++) {
    const user:User={id:`u${String(i+1).padStart(2,'0')}`,name:i===0?'김도윤':`가상 장병 ${String(i+1).padStart(2,'0')}`,nickname:nicknames[i],role:'soldier',unit:i<6?'한빛부대':i<12?'새봄부대':'푸른부대',company:i%2?'2중대':'1중대',platoon:`${i%3+1}소대`,squad:`${i%2+1}분대`,corps:i<12?'가상 1군단':'가상 2군단',region:i<12?'경기':'강원',group:'시범 A군',shareScope:'national'};
    state.users.push(user);
    const goal:Goal={id:`goal-${user.id}-1`,userId:user.id,grade:'특급 도전',targetDate:addDays(today,40),run:810,pushup:72,situp:86,days:[1,2,4,5,6],minutes:35,location:'both',equipment:false,excludedDates:[],createdAt:`${addDays(today,-28)}T09:00:00+09:00`};
    state.goals.push(goal);
    for(let j=3;j>=0;j--) {
      const date=addDays(today,-j*7-1);
      for(const sport of ['run','pushup','situp'] as const) {
        const value=sport==='run'?870+i*7+j*18:sport==='pushup'?62-i+j*-3:74-i+j*-3;
        const row:Submission={id:`m-${user.id}-${sport}-${j}`,userId:user.id,kind:'measurement',date,sport,value,protocol:protocols[sport],group:user.group,completion:'complete',minutes:2,rpe:6,fatigue:2,pain:false,evidence:'가상 측정 · 현장 타이머 및 횟수 확인',status:'approved',createdAt:`${date}T08:00:00+09:00`,updatedAt:`${date}T09:00:00+09:00`,idempotencyKey:`seed-m-${user.id}-${sport}-${j}`};
        state.submissions.push(row); state.reviews.push({id:`review-${row.id}`,submissionId:row.id,adminId:i<6?'a01':'a02',action:'approved',reason:'가상 현장 확인',at:row.updatedAt});
      }
    }
    for(let j=10;j>=1;j--) {
      const date=addDays(today,-j*2); regenerate(state,user.id,'초기 예시 계획',date,`${date}T06:00:00+09:00`);
      const routine=state.routines.find(r=>r.userId===user.id&&r.date===date&&r.type==='training'); if(!routine)continue;
      const row:Submission={id:`p-${user.id}-${j}`,userId:user.id,kind:'performance',routineId:routine.id,date,sport:routine.sport,value:0,protocol:protocols[routine.sport],group:user.group,completion:j%4===0?'partial':'complete',minutes:j%4===0?20:30,rpe:6,fatigue:2,pain:false,evidence:'합동 체력단련 현장 확인',status:'approved',createdAt:`${date}T17:00:00+09:00`,updatedAt:`${date}T18:00:00+09:00`,idempotencyKey:`seed-p-${user.id}-${j}`};
      state.submissions.push(row);state.reviews.push({id:`review-${row.id}`,submissionId:row.id,adminId:i<6?'a01':'a02',action:'approved',reason:'현장 수행 확인',at:row.updatedAt});
    }
    state.officials.push({id:`official-${user.id}`,userId:user.id,date:addDays(today,-14),run:900+i*7,pushup:59-i,situp:71-i,grade:'1급 (예시)',standard:'가상 검정 결과 · 공식 등급표 미적용'});
    regenerate(state,user.id,'목표와 최근 측정값을 반영한 이번 주 계획이에요.',today);
  }
  state.users.push({...state.users[0],id:'a01',name:'박지훈',nickname:'인증 담당자',role:'admin',shareScope:'private'});
  state.users.push({...state.users[7],id:'a02',name:'다른 부대 담당자',nickname:'타 부대 담당자',role:'admin',shareScope:'private'});
  state.users.push({...state.users[13],id:'a03',name:'푸른부대 담당자',nickname:'푸른 담당자',role:'admin',shareScope:'private'});
  state.reviews.forEach(r=>{const submission=state.submissions.find(s=>s.id===r.submissionId);if(submission&&state.users.find(u=>u.id===submission.userId)?.unit==='푸른부대')r.adminId='a03';});
  for(let i=1;i<=4;i++) {
    const user=state.users[i], date=today;
    const row:Submission={id:`pending-${i}`,userId:user.id,kind:'measurement',date,sport:i%2?'run':'pushup',value:i%2?856+i*5:68+i,protocol:protocols[i%2?'run':'pushup'],group:user.group,completion:'complete',minutes:15,rpe:6,fatigue:2,pain:false,evidence:'오늘 합동 측정. 담당자가 타이머와 횟수를 현장에서 확인했습니다.',status:'pending',createdAt:`${date}T08:00:00+09:00`,updatedAt:`${date}T08:00:00+09:00`,idempotencyKey:`seed-pending-${i}`};
    state.submissions.push(row);
  }
  recalculateXp(state); return state;
}
