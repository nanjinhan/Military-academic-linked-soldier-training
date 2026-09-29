import { PostgresRepository } from '../lib/server/postgres';
import { createSeed } from '../lib/domain/seed';
if(process.env.NODE_ENV==='production'||process.env.APP_MODE==='production'||process.env.ALLOW_DEMO_DB_SEED!=='yes')throw new Error('Only allowed in an explicitly opted-in development database (ALLOW_DEMO_DB_SEED=yes).');
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL required.');
const repo=new PostgresRepository(process.env.DATABASE_URL);
await repo.transaction(state=>{if(state.users.length)throw new Error('Database is not empty. Existing data was not changed.');Object.assign(state,createSeed());});
console.log('Synthetic fixtures inserted into an empty development database.');
await repo.close();
