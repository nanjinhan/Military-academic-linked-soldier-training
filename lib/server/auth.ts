import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { AppError } from './service';
const runtime=globalThis as typeof globalThis&{fitnessSecret?:string};
runtime.fitnessSecret ||= randomBytes(32).toString('hex');
const secret=()=>process.env.SESSION_SECRET||runtime.fitnessSecret!;
export const isDemo=()=>process.env.NODE_ENV!=='production'&&process.env.APP_MODE!=='production';
export function assertLocalDemo(request:Request){
  const host=new URL(request.url).hostname;
  if(!isDemo()||!['localhost','127.0.0.1','[::1]'].includes(host))throw new AppError(403,'DEMO_DISABLED','이 환경에서는 데모 계정 전환을 사용할 수 없어요.');
}
export function demoCookie(userId:string){const payload=Buffer.from(JSON.stringify({sub:userId,exp:Date.now()+8*60*60*1000})).toString('base64url');const sig=createHmac('sha256',secret()).update(payload).digest('base64url');return `fitness_session=${payload}.${sig}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`;}
let remoteKeys:ReturnType<typeof createRemoteJWKSet>|undefined;
export async function identity(request:Request):Promise<string>{
  if(isDemo()){
    assertLocalDemo(request);
    const cookie=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('fitness_session='))?.slice(16);
    if(!cookie)return 'u01';
    try{
      const [payload,sig]=cookie.split('.'),expected=createHmac('sha256',secret()).update(payload).digest();const actual=Buffer.from(sig,'base64url');
      if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw Error();
      const data=JSON.parse(Buffer.from(payload,'base64url').toString());if(typeof data.sub!=='string'||data.exp<Date.now())throw Error();return data.sub;
    }catch{throw new AppError(401,'SESSION_EXPIRED','체험 세션이 만료됐어요. 장병 체험을 다시 선택해 주세요.');}
  }
  const {AUTH_JWKS_URL,AUTH_ISSUER,AUTH_AUDIENCE}=process.env;
  if(!AUTH_JWKS_URL||!AUTH_ISSUER||!AUTH_AUDIENCE)throw new AppError(503,'AUTH_NOT_CONFIGURED','운영 로그인 연결이 아직 준비되지 않았어요.');
  const token=request.headers.get('authorization')?.replace(/^Bearer /,'');if(!token)throw new AppError(401,'LOGIN_REQUIRED','로그인이 필요해요.');
  try{remoteKeys ||= createRemoteJWKSet(new URL(AUTH_JWKS_URL));const {payload}=await jwtVerify(token,remoteKeys,{issuer:AUTH_ISSUER,audience:AUTH_AUDIENCE,algorithms:['RS256','ES256']});if(!payload.sub)throw Error();return payload.sub;}catch{throw new AppError(401,'INVALID_TOKEN','로그인 정보를 확인해 주세요.');}
}
export function assertOrigin(request:Request){
  const origin=request.headers.get('origin');
  const url=new URL(request.url);
  // Next.js can normalize request.url to localhost while the browser uses 127.0.0.1.
  // Browser Origin must still match the actual request Host (and configured production origin).
  const expected=process.env.APP_ORIGIN||`${url.protocol}//${request.headers.get('host')||url.host}`;
  if(origin!==expected)throw new AppError(403,'ORIGIN_DENIED','요청 출처를 확인할 수 없어요.');
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw new AppError(415,'JSON_REQUIRED','JSON 요청이 필요해요.');
}
