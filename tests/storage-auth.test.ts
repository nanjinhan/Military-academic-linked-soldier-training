import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, unlink, rmdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { FileRepository } from '../lib/server/repository';
import { assertOrigin, demoCookie, identity, assertLocalDemo } from '../lib/server/auth';

test('file repository persists, serializes concurrent transactions and rolls back failures',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'fitness-test-'));const file=path.join(dir,'state.json');const repo=new FileRepository(file);
 try{await repo.transaction(s=>{s.users[0].nickname='0'});await Promise.all(Array.from({length:8},()=>repo.transaction(async s=>{const n=+s.users[0].nickname;await Promise.resolve();s.users[0].nickname=String(n+1)})));
 assert.equal(await new FileRepository(file).transaction(s=>s.users[0].nickname),'8');
 await assert.rejects(repo.transaction(s=>{s.users[0].nickname='corrupted';throw Error('rollback')}));assert.equal(await repo.transaction(s=>s.users[0].nickname),'8');
 }finally{await unlink(file);await rmdir(dir);}
});
test('demo cookie is signed, role comes from server identity, cross-origin writes denied',async()=>{
 const prior=process.env.APP_MODE;process.env.APP_MODE='demo';
 try{const cookie=demoCookie('u01').split(';')[0];assert.equal(await identity(new Request('http://127.0.0.1:3000/api/v1/snapshot',{headers:{cookie}})),'u01');
 await assert.rejects(identity(new Request('http://127.0.0.1:3000/api/v1/snapshot',{headers:{cookie:'fitness_session=forged.signature'}})));
 assert.throws(()=>assertOrigin(new Request('http://127.0.0.1:3000/api/v1/goals',{method:'POST',headers:{origin:'https://bad.example','content-type':'application/json'}})));
 assert.doesNotThrow(()=>assertOrigin(new Request('http://127.0.0.1:3000/api/v1/goals',{method:'POST',headers:{origin:'http://127.0.0.1:3000','content-type':'application/json'}})));
 assert.doesNotThrow(()=>assertOrigin(new Request('http://localhost:3000/api/v1/goals',{method:'POST',headers:{host:'127.0.0.1:3000',origin:'http://127.0.0.1:3000','content-type':'application/json'}})));
 assert.throws(()=>assertLocalDemo(new Request('https://public.example/api/v1/session')));
 }finally{if(prior===undefined)delete process.env.APP_MODE;else process.env.APP_MODE=prior;}
});
test('production mode fails closed without configured identity provider',async()=>{
 const prior=process.env.APP_MODE;process.env.APP_MODE='production';try{assert.throws(()=>assertLocalDemo(new Request('http://127.0.0.1:3000/api/v1/session')));await assert.rejects(identity(new Request('http://127.0.0.1:3000/api/v1/snapshot')));}finally{if(prior===undefined)delete process.env.APP_MODE;else process.env.APP_MODE=prior;}
});
