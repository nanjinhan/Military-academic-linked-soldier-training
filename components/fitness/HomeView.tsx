'use client';

import { ArrowRight, Bell, Check, ChevronRight, Clock3, Heart, Shield, Target, Trophy } from 'lucide-react';
import type { Snapshot, Sport } from '@/lib/domain/types';
import { sportLabels } from '@/lib/domain/types';
import { addDays, formatRecord } from '@/lib/domain/rules';
import { Meter, NumberValue, SectionTitle, shortDate, StatusBadge } from './shared';
import type { View } from './FitnessApp';

export function HomeView({ data, navigate, open, switchRole, busy }: {
  data: Snapshot; navigate: (view: View) => void; open: (key: string) => void;
  switchRole: () => void; busy: boolean;
}) {
  const mine = data.submissions.filter(s => s.userId === data.me.id);
  const routine = data.routines.find(r => r.date === data.today);
  const goal = data.goal;
  const dday = goal?.targetDate ? Math.max(0, Math.ceil((+new Date(goal.targetDate) - +new Date(data.today)) / 86400000)) : null;
  const latest = (sport: Sport) => mine.filter(s => s.kind === 'measurement' && s.sport === sport && s.status === 'approved').sort((a,b) => b.date.localeCompare(a.date))[0];
  const readiness = goal ? Math.round((['run','pushup','situp'] as Sport[]).reduce((sum, sport) => {
    const record = latest(sport);
    return sum + (record ? Math.min(100, (sport === 'run' ? goal[sport] / record.value : record.value / goal[sport]) * 100) : 0);
  }, 0) / 3) : 0;
  const monday = addDays(data.today, -((new Date(`${data.today}T00:00:00Z`).getUTCDay() + 6) % 7));
  const week = Array.from({length:7}, (_,i) => addDays(monday, i));
  const performed = mine.filter(s => s.kind === 'performance' && s.completion !== 'missed' && week.includes(s.date));
  const planned = data.routines.filter(r => r.type === 'training' && week.includes(r.date));
  const recent = mine.filter(s => s.kind !== 'self').sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0,3);
  const savedToday = mine.find(s => s.kind === 'performance' && s.routineId === routine?.id);

  return <div className="reference-home">
    <header className="home-greeting">
      <button className="profile-greeting" onClick={() => open('profile')} aria-label="마이페이지 열기">
        <span className="avatar">{data.me.name.slice(-1)}</span>
        <span><small>오늘도 목표를 향해 달립니다</small><strong>안녕하세요, {data.me.name}님</strong></span>
      </button>
      <button className="icon-circle" aria-label="최근 인증 알림" onClick={() => navigate('records')}><Bell size={21}/>{mine.some(s=>s.status==='changes')&&<i/>}</button>
    </header>
    <div className="reference-home-grid">
      <section className="goal-overview">
        <div className="row-between"><div><span className="eyebrow">CURRENT GOAL</span><h1>{goal ? `체력검정 ${goal.grade}` : '나의 첫 목표'}</h1></div><button className="d-day" onClick={() => open('goal')} aria-label="목표 수정">{dday===null?'목표 설정':`D-${dday}`}</button></div>
        <div className="progress-number"><strong><NumberValue value={readiness}/></strong><span>%</span></div>
        <Meter value={readiness}/>
        <p className="caption">개인 목표 대비 · 공식 등급 환산 아님</p>
        <div className="goal-stats">{(['pushup','situp','run'] as Sport[]).map(sport => <div key={sport}><span>{sport==='run'?'3km':sportLabels[sport]}</span><strong>{latest(sport)?formatRecord(sport,latest(sport)!.value):'—'} <small>/ {goal?formatRecord(sport,goal[sport]):'—'}</small></strong></div>)}</div>
      </section>
      <section className="photo-workout-hero">
        <img src="/assets/pushup-workout.jpg" alt="체육관에서 팔굽혀펴기를 하는 남성"/>
        <div className="photo-overlay"/>
        <div className="photo-workout-copy"><span className="eyebrow lime">TODAY</span><h2>{routine?.title||'오늘의 루틴'}</h2><p>{routine?.type==='training'?`${routine.exercises.length}개 운동 · 약 ${routine.minutes}분`:'몸의 회복도 훈련의 일부예요'}</p><button className="primary-button" onClick={() => navigate('routine')}>{savedToday?'수행한 루틴 보기':routine?.type==='training'?'운동 시작':'이번 주 계획 보기'}<ArrowRight size={18}/></button></div>
      </section>
      <section className="home-week">
        <div className="section-title"><h2>이번 주</h2><strong>{new Set(performed.map(s=>s.date)).size} / {planned.length}회 수행</strong></div>
        <div className="home-week-strip">{week.map((date,i) => {
          const done = performed.some(s=>s.date===date);
          const rest = data.routines.find(r=>r.date===date)?.type !== 'training';
          return <div key={date}><span className={`day-dot ${done?'done':date===data.today?'today':rest?'rest':''}`} aria-label={`${shortDate(date)} ${done?'수행':rest?'휴식':'예정'}`}>{done?<Check size={16}/>:rest?'–':''}</span><small>{['월','화','수','목','금','토','일'][i]}</small></div>;
        })}</div>
        <button className="subtle-action" onClick={()=>open('recovery')}><Heart size={16}/><span>{data.recovery?.pain?'통증 신호가 있어요. 컨디션을 확인해 주세요.':'오늘의 컨디션을 기록해 주세요'}</span><ChevronRight size={16}/></button>
      </section>
      <section className="home-certifications">
        <SectionTitle title="최근 인증" action="전체 보기" onClick={()=>navigate('records')}/>
        <div className="certification-list">{recent.length?recent.map(s=><button key={s.id} className="certification-row" onClick={()=>navigate('records')}><span className={`certification-icon ${s.status==='approved'?'done':''}`}>{s.status==='approved'?<Check size={17}/>:<Clock3 size={17}/>}</span><span><strong>{s.kind==='performance'?(data.routines.find(r=>r.id===s.routineId)?.title||'루틴 수행'):sportLabels[s.sport]}</strong><small>{shortDate(s.date)} · {s.kind==='performance'?`${s.minutes}분`:formatRecord(s.sport,s.value)}</small></span><StatusBadge status={s.status}/></button>):<p className="empty-copy">아직 인증 요청이 없어요. 첫 운동 기록을 남겨 보세요.</p>}</div>
      </section>
      <button className="home-level" onClick={()=>navigate('growth')}><Trophy size={25}/><div><span>나의 활동 레벨</span><strong>Lv. {data.level}<small>{data.totalXp} XP</small></strong><Meter value={data.totalXp%200/2}/></div><ChevronRight size={19}/></button>
      <button className="home-goal-action" onClick={()=>open('goal')}><Target size={20}/><span>목표와 운동 가능한 일정 수정</span><ChevronRight size={17}/></button>
    </div>
    {data.demo&&<div className="home-demo"><span>DEMO · 가상 데이터</span><button disabled={busy} onClick={switchRole}><Shield size={14}/> 관리자 체험</button></div>}
  </div>;
}
