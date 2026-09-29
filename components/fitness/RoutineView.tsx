'use client';
import { useState } from 'react';
import { ArrowRight, ChevronRight, Heart, Target } from 'lucide-react';
import type { Snapshot } from '@/lib/domain/types';
import { addDays } from '@/lib/domain/rules';
import { Badge, Empty, SectionTitle, shortDate, StatusBadge } from './shared';

export function RoutineView({data,open}:{data:Snapshot;open:(key:string)=>void}){
 const [selected,setSelected]=useState(data.today);
 const routine=data.routines.find(r=>r.date===selected);
 const record=data.submissions.find(s=>s.routineId===routine?.id);
 const week=Array.from({length:7},(_,i)=>addDays(data.today,i));
 const next=data.routines.filter(r=>r.date>selected&&r.type==='training').sort((a,b)=>a.date.localeCompare(b.date))[0];
 return <>
  <div className="page-heading"><div><p className="eyebrow">MY ROUTINE</p><h1>이번 주 루틴</h1><p>목표와 컨디션에 맞춘 나의 운동 계획</p></div><button className="secondary-button" onClick={()=>open('goal')}><Target size={16}/> 목표 · 일정</button></div>
  <div className="week-strip" aria-label="주간 운동 일정">{week.map(date=>{const r=data.routines.find(r=>r.date===date);return <button key={date} aria-pressed={date===selected} className={date===selected?'selected':''} onClick={()=>setSelected(date)}><span>{['일','월','화','수','목','금','토'][new Date(`${date}T00:00:00Z`).getUTCDay()]}</span><strong>{Number(date.slice(8))}</strong><small>{r?.type==='training'?'운동':r?.type==='recovery'?'회복':'휴식'}</small><i className={r?.type==='training'?'training-dot':''}/></button>;})}</div>
  <div className="detail-grid">
   <div className="stack"><section className="panel routine-focus">
    {routine?.type==='training'?<>
     <div className="routine-photo"><img src="/assets/pushup-workout.jpg" alt="운동 공간에서 몸을 낮추며 팔굽혀펴기를 하는 모습"/><span>{routine.minutes}분 · {routine.intensity} 강도</span></div>
     <div className="routine-focus-heading"><span className="eyebrow">{shortDate(selected)} {selected===data.today?'TODAY':'PLAN'}</span><h2>{routine.title}</h2></div>
     <div className="routine-plan-list">{routine.exercises.map((e,i)=><details key={`${routine.id}-${i}`}><summary><span className="exercise-number">{i+1}</span><strong>{e.name}</strong><span>{e.sets} × {e.reps}</span><ChevronRight size={16}/></summary><p>세트 사이 휴식: {e.rest}</p><p>대체 동작: {e.alternative}</p></details>)}</div>
     {record?<div className="recorded-notice"><StatusBadge status={record.status}/><p>이 회차는 제출되었어요. 인증 화면에서 처리 이력을 확인할 수 있어요.</p>{record.status==='changes'&&<button className="primary-button full-width" onClick={()=>open(`resubmit:${record.id}`)}>보완 내용 입력</button>}</div>:<><button className="primary-button full-width" disabled={selected>data.today} onClick={()=>open(`session:${routine.id}`)}>{selected>data.today?'예정된 운동':'운동 시작'}<ArrowRight size={18}/></button>{selected<=data.today&&<button className="text-link manual-result" onClick={()=>open(`workout:${routine.id}`)}>이미 운동했나요? 수행 결과 바로 입력</button>}</>}
    </>:<><div className="rest-symbol"><Heart size={32}/></div><h2 className="rest-title">{routine?.title||'계획이 아직 없어요'}</h2><Empty title={routine?.type==='recovery'?'몸의 신호를 먼저 확인해요':'오늘은 회복에 집중해요'} body={routine?.type==='recovery'?'통증이 보고되어 운동량을 제시하지 않아요. 담당자에게 상태를 확인해 주세요.':'계획된 휴식에는 경험치 불이익이 없어요. 다음 운동을 한꺼번에 몰아서 하지 않아요.'}/><button className="secondary-button full-width" onClick={()=>open('recovery')}>컨디션 기록하기</button></>}
   </section>{next&&<button className="next-routine" onClick={()=>setSelected(next.date)}><div><span className="eyebrow">NEXT</span><h3>{next.title}</h3><p>{shortDate(next.date)} · 약 {next.minutes}분</p></div><ChevronRight size={19}/></button>}</div>
   <aside className="stack">
    <section className="panel"><SectionTitle title="이번 계획의 기준"/><p className="explanation-copy">{routine?.reason}</p><div className="version-label"><Badge>규칙 기반 추천</Badge><span>버전 {routine?.version}</span></div><p className="field-hint">운동 전문가 검토 전인 가상 기준입니다. 실제 운동 처방이나 목표 달성을 보장하지 않습니다.</p></section>
    <section className="panel"><SectionTitle title="오늘의 컨디션"/><div className="condition-summary"><Heart size={22}/><div><strong>{data.recovery?.pain?'통증 확인이 필요해요':data.recovery?.fatigue&&data.recovery.fatigue>=4?'가볍게 회복해 보세요':'나의 몸에 귀 기울이기'}</strong><p>{data.recovery?`최근 피로도 ${data.recovery.fatigue} / 5`:'컨디션을 기록하면 다음 계획에 반영돼요.'}</p></div></div><button className="secondary-button full-width" onClick={()=>open('recovery')}>컨디션 기록하기</button></section>
    <section className="panel"><SectionTitle title="계획 변경 이력"/>{routine?.history.length?<div className="timeline">{routine.history.slice(-4).reverse().map(v=><div key={v.version}><span>v{v.version} · {new Date(v.at).toLocaleDateString('ko-KR')}</span><strong>{v.title} · {v.minutes}분</strong><p>{v.reason}</p></div>)}</div>:<p className="field-hint">첫 번째 계획이에요. 갱신되면 이전 계획과 이유가 이곳에 남아요.</p>}<p className="tiny-note">{routine?.ruleVersion}</p></section>
   </aside>
  </div>
 </>;
}
