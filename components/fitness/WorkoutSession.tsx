'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Minus, Pause, Play, Plus } from 'lucide-react';
import type { Routine } from '@/lib/domain/types';
import { Meter } from './shared';

export interface WorkoutDraft { minutes?: number; evidence: string; completion: 'complete'|'partial'; }
const time=(seconds:number)=>`${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;

// Local set checks are included in the editable submission note; only submission persists them.
export function WorkoutSession({routine,onFinish}:{routine:Routine;onFinish:(draft:WorkoutDraft)=>void}){
 const steps=routine.exercises.flatMap((exercise,index)=>Array.from({length:exercise.sets},(_,set)=>({exercise,index,set:set+1})));
 const [position,setPosition]=useState(0),[phase,setPhase]=useState<'exercise'|'rest'|'result'>('exercise');
 const [elapsed,setElapsed]=useState(0),[paused,setPaused]=useState(false),[count,setCount]=useState(0),[rest,setRest]=useState(0);
 const [results,setResults]=useState<{name:string;set:number;value:string;skipped:boolean;metTarget:boolean}[]>([]);
 const elapsedMs=useRef(0),tickAt=useRef(0),restUntil=useRef(0);
 const step=steps[position];
 const repetition=step ? /회/.test(step.exercise.reps) : false;
 const target=step?Number(step.exercise.reps.match(/\d+/)?.[0]||0):0;
 useEffect(()=>{setCount(0);},[position]);
 useEffect(()=>{
  if(paused||phase==='result')return;
  tickAt.current=Date.now();
  const timer=setInterval(()=>{const now=Date.now();elapsedMs.current+=now-tickAt.current;tickAt.current=now;setElapsed(Math.floor(elapsedMs.current/1000));},500);
  return()=>clearInterval(timer);
 },[paused,phase]);
 useEffect(()=>{
  if(phase!=='rest')return;
  restUntil.current=Date.now()+rest*1000;
  const timer=setInterval(()=>{const remaining=Math.max(0,Math.ceil((restUntil.current-Date.now())/1000));setRest(remaining);if(!remaining)setPhase('exercise');},250);
  return()=>clearInterval(timer);
 },[phase]);
 function finishSet(skipped:boolean){
  if(!step)return;
  setResults(previous=>[...previous,{name:step.exercise.name,set:step.set,value:skipped?'건너뜀':repetition?`${count}회`:`${step.exercise.reps} 체크`,skipped,metTarget:!skipped&&(!repetition||count>=target)}]);
  if(position>=steps.length-1){setPhase('result');return;}
  const restSeconds=Number(step.exercise.rest.match(/\d+/)?.[0]||0);
  setPosition(p=>p+1);setPaused(false);
  if(!skipped&&restSeconds>0){setRest(/분/.test(step.exercise.rest)?restSeconds*60:restSeconds);setPhase('rest');}
 }
 function finish(){
  const complete=results.length===steps.length&&results.every(r=>r.metTarget);
  onFinish({minutes:Math.floor(elapsed/60)||undefined,completion:complete?'complete':'partial',evidence:`운동 화면 기록 (${time(elapsed)}): ${results.map(r=>`${r.name} ${r.set}세트 ${r.value}`).join(', ')}. 실제 수행량과 확인 근거를 확인해 주세요.`.slice(0,950)});
 }
 if(!step)return <p>진행할 운동이 없어요.</p>;
 return <div className="workout-session">
  <div className="session-top"><span>{routine.title}</span><span>{time(elapsed)}</span></div>
  <Meter value={results.length/steps.length*100}/>
  {phase==='result'?<><div className="session-result"><span className="big-check"><Check size={30}/></span><h2>오늘의 운동 기록</h2><strong>{time(elapsed)}</strong><p>{results.filter(r=>!r.skipped).length} / {steps.length}세트 체크</p></div><div className="session-result-list">{results.map((r,i)=><div key={i}><span>{r.name} · {r.set}세트</span><strong>{r.value}</strong></div>)}</div><p className="field-hint">아직 저장되지 않았어요. 실제 수행 시간·난도·컨디션과 확인 근거를 입력한 뒤 인증을 요청해 주세요.</p><button className="primary-button full-width" onClick={finish}>수행 결과 확인 · 인증 요청<ArrowRight size={17}/></button></>:
  phase==='rest'?<><div className="session-rest"><span className="eyebrow lime">REST</span><div className="session-rest-ring"><strong>{time(rest)}</strong></div><span>다음 세트</span><h2>{step.exercise.name}</h2><p>{step.set} / {step.exercise.sets}세트 · {step.exercise.reps}</p></div><button className="primary-button full-width" onClick={()=>setPhase('exercise')}>휴식 종료</button><p className="field-hint center-text">몸 상태에 맞춰 충분히 쉬어 주세요.</p></>:
  <><p className="session-stage">{step.index+1} / {routine.exercises.length} 운동</p><h2 className="session-name">{step.exercise.name}</h2><div className="session-counter"><span className="eyebrow">SET {step.set} / {step.exercise.sets}</span>{repetition?<div className="count-controls"><button className="icon-circle" aria-label="횟수 줄이기" disabled={paused||count===0} onClick={()=>setCount(c=>Math.max(0,c-1))}><Minus size={22}/></button><div><strong>{count}</strong><span>/ {target}회</span></div><button className="icon-circle" aria-label="횟수 늘리기" disabled={paused||count>=200} onClick={()=>setCount(c=>c+1)}><Plus size={22}/></button></div>:<div className="timed-exercise"><strong>{step.exercise.reps}</strong><span>계획 시간 · 전체 진행 {time(elapsed)}</span></div>}</div><div className="session-exercise-note"><span>세트 사이 휴식 <strong>{step.exercise.rest}</strong></span><span>대체 동작 <strong>{step.exercise.alternative}</strong></span></div><div className="session-buttons"><button className="primary-button full-width" disabled={paused||(repetition&&count===0)} onClick={()=>finishSet(false)}>{position===steps.length-1?'운동 마무리':'세트 완료'}<Check size={18}/></button><button className="secondary-button full-width" onClick={()=>setPaused(p=>!p)}>{paused?<Play size={17}/>:<Pause size={17}/>} {paused?'이어서 진행':'일시 정지'}</button><button className="text-link" onClick={()=>finishSet(true)}>이 세트 건너뛰기</button><button className="text-link" onClick={()=>setPhase('result')}>현재 기록으로 마무리</button></div><p className="field-hint center-text">체크는 이 화면에서만 유지돼요. 통증이 있다면 운동을 중단하고 컨디션을 기록해 주세요.</p></>}
 </div>;
}
