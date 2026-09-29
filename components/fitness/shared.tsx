'use client';
import type { ReactNode } from 'react';
import { Activity, Dumbbell, Footprints, ShieldCheck, CircleCheck, ArrowUpRight } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import CountUp from '@/components/third-party/CountUp';
import { Progress } from '@/components/ui/progress';
import type { Sport, Status } from '@/lib/domain/types';
import { statusLabels } from '@/lib/domain/types';
export async function api<T>(path:string,input?:unknown):Promise<T>{
 const response=await fetch(`/api/v1/${path}`,{method:input===undefined?'GET':'POST',headers:input===undefined?{}:{'Content-Type':'application/json'},body:input===undefined?undefined:JSON.stringify(input),cache:'no-store'});
 const result=await response.json() as {data?:T,error?:{message:string}};if(!response.ok)throw new Error(result.error?.message||'요청을 처리하지 못했어요.');return (result.data??result) as T;
}
export function SportIcon({sport,className=''}:{sport:Sport,className?:string}){const Icon=sport==='run'?Footprints:sport==='pushup'?Dumbbell:Activity;return <span className={`sport-icon ${sport} ${className}`}><Icon size={23}/></span>;}
export function NumberValue({value}:{value:number}){const reduced=useReducedMotion();return reduced?<>{value.toLocaleString()}</>:<CountUp to={value} duration={.65} separator=","/>;}
export function Badge({children,tone='purple'}:{children:ReactNode,tone?:string}){return <span className={`badge tone-${tone}`}>{children}</span>;}
export function StatusBadge({status}:{status:Status}){return <Badge tone={status==='approved'?'green':status==='pending'?'amber':status==='changes'?'purple':'gray'}>{status==='approved'&&<ShieldCheck size={13}/>} {statusLabels[status]}</Badge>;}
export function Meter({value,className=''}:{value:number,className?:string}){return <Progress value={Math.max(0,Math.min(100,value))} className={`meter ${className}`}/>;}
export function Empty({title,body}:{title:string,body:string}){return <div className="empty-state"><CircleCheck/><h3>{title}</h3><p>{body}</p></div>;}
export function SectionTitle({title,action,onClick}:{title:string,action?:string,onClick?:()=>void}){return <div className="section-title"><h2>{title}</h2>{action&&<button className="text-link" onClick={onClick}>{action}<ArrowUpRight size={16}/></button>}</div>;}
export const shortDate=(date:string)=>`${Number(date.slice(5,7))}.${Number(date.slice(8,10))}`;
