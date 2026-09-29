import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { State } from '../domain/types';
import { createSeed } from '../domain/seed';
import { PostgresRepository } from './postgres';

export interface Repository { transaction<T>(operation:(state:State)=>T|Promise<T>):Promise<T>; }
export class FileRepository implements Repository {
  private queue:Promise<unknown>=Promise.resolve();
  constructor(private file=path.resolve('.data/demo.json')){}
  async transaction<T>(operation:(state:State)=>T|Promise<T>):Promise<T>{
    const work=this.queue.then(async()=>{
      await mkdir(path.dirname(this.file),{recursive:true});
      let state:State;
      try {state=JSON.parse(await readFile(this.file,'utf8'));if(state.schemaVersion!==1)throw new Error('Unsupported data version');}
      catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;state=createSeed();}
      const result=await operation(state);
      const temporary=`${this.file}.tmp`;
      await writeFile(temporary,JSON.stringify(state),'utf8');await rename(temporary,this.file);
      return result;
    });
    this.queue=work.catch(()=>undefined);return work;
  }
}
const runtime=globalThis as typeof globalThis&{fitnessRepository?:Repository};
export function getRepository():Repository{
  if(runtime.fitnessRepository)return runtime.fitnessRepository;
  if(process.env.DATABASE_URL)runtime.fitnessRepository=new PostgresRepository(process.env.DATABASE_URL);
  else if(process.env.NODE_ENV!=='production'&&process.env.APP_MODE!=='production')runtime.fitnessRepository=new FileRepository();
  else throw new Error('Production requires DATABASE_URL and configured authentication. Local demo storage is disabled.');
  return runtime.fitnessRepository;
}
