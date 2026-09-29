import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getRepository } from '@/lib/server/repository';
import { AppError, snapshot, saveGoal, saveRecovery, savePreferences, submit, resubmit, review } from '@/lib/server/service';
import { assertLocalDemo, assertOrigin, demoCookie, identity, isDemo } from '@/lib/server/auth';
import { addDays, ranking, regenerate, todayISO } from '@/lib/domain/rules';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function handle(request:NextRequest,context:{params:Promise<{path:string[]}>}){
 try{
  const {path}=await context.params,key=path.join('/');
  if(key==='health'&&request.method==='GET')return json({status:'ok',mode:isDemo()?'demo':'production'});
  if(request.method==='POST')assertOrigin(request);
  let input:unknown;
  if(request.method==='POST') { const raw=await request.text();if(Buffer.byteLength(raw)>32768)throw new AppError(413,'PAYLOAD_TOO_LARGE','입력 내용이 너무 길어요.');try{input=JSON.parse(raw);}catch{throw new AppError(400,'INVALID_JSON','입력 형식을 확인해 주세요.');} }
  if(key==='session'&&request.method==='POST'){
    assertLocalDemo(request);const {role}=z.object({role:z.enum(['soldier','admin'])}).strict().parse(input);
    const response=json({ok:true});response.headers.set('Set-Cookie',demoCookie(role==='admin'?'a01':'u01'));return response;
  }
  const userId=await identity(request);
  const data=await getRepository().transaction(state=>{
    const user=state.users.find(u=>u.id===userId);if(!user)throw new AppError(403,'USER_NOT_PROVISIONED','등록된 참여자 계정이 필요해요.');
    if(request.method==='GET'){
      if(key==='snapshot'){
        // Extend a plan only once when a new calendar day enters its horizon.
        if(user.role==='soldier'&&!state.routines.some(r=>r.userId===user.id&&r.date===addDays(todayISO(),6)))regenerate(state,user.id,'새 날짜의 일정을 준비했어요.');
        return snapshot(state,user,isDemo());
      }
      if(key==='rankings'){const sport=z.enum(['run','pushup','situp']).parse(request.nextUrl.searchParams.get('sport')||'run');const scope=z.enum(['unit','corps','region','national']).parse(request.nextUrl.searchParams.get('scope')||'unit');return ranking(state,user,sport,scope);}
    }
    if(request.method==='POST'){
      if(key==='goals')return saveGoal(state,user,input);
      if(key==='submissions')return submit(state,user,input);
      if(path[0]==='submissions'&&path[2]==='resubmit'&&path.length===3)return resubmit(state,user,path[1],input);
      if(key==='reviews')return review(state,user,input);
      if(key==='recovery')return saveRecovery(state,user,input);
      if(key==='preferences')return savePreferences(state,user,input);
    }
    throw new AppError(404,'NOT_FOUND','지원하지 않는 요청이에요.');
  });
  return json({data});
 }catch(error){
  if(error instanceof z.ZodError)return json({error:{code:'VALIDATION',message:error.issues[0]?.message||'입력을 확인해 주세요.',fields:error.flatten().fieldErrors}},422);
  if(error instanceof AppError)return json({error:{code:error.code,message:error.message}},error.status);
  console.error('[fitness-api]',error instanceof Error?error.message:'unknown error');return json({error:{code:'SERVER_ERROR',message:'처리를 완료하지 못했어요. 잠시 후 다시 시도해 주세요.'}},500);
 }
}
export const GET=handle;
export const POST=handle;
