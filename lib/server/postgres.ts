import { Pool } from 'pg';
import type { Repository } from './repository';
import type { State } from '../domain/types';
const tables={users:'user_profiles',goals:'goals',routines:'routine_sessions',submissions:'submissions',reviews:'reviews',officials:'official_results',recovery:'recovery_checkins',xp:'xp_ledger',audits:'audit_events'} as const;
export class PostgresRepository implements Repository {
  private pool:Pool;
  constructor(connectionString:string){this.pool=new Pool({connectionString,max:5,connectionTimeoutMillis:5000,statement_timeout:10000});}
  async close(){await this.pool.end();}
  async transaction<T>(operation:(state:State)=>T|Promise<T>):Promise<T>{
    const client=await this.pool.connect();
    try{
      await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(9282026)');
      const state={schemaVersion:1} as State;
      for(const key of Object.keys(tables) as (keyof typeof tables)[]){const {rows}=await client.query(`SELECT payload FROM fitness.${tables[key]} ORDER BY sequence_id`);(state[key] as unknown[]) = rows.map(r=>r.payload);}
      const result=await operation(state);
      for(const key of Object.keys(tables) as (keyof typeof tables)[]){
        if(key==='xp')await client.query('DELETE FROM fitness.xp_ledger');
        for(const row of state[key])await client.query(`INSERT INTO fitness.${tables[key]} (id,payload) VALUES ($1,$2::jsonb) ON CONFLICT (id) DO UPDATE SET payload=EXCLUDED.payload`,[row.id,JSON.stringify(row)]);
      }
      await client.query('COMMIT');return result;
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
}
