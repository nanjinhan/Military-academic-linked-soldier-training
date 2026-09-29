import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required. No database changes were made.');
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1});
try{await pool.query(await readFile(new URL('../db/001_initial.sql',import.meta.url),'utf8'));console.log('Migration 001 applied. No demo or personal data was imported.');}finally{await pool.end();}
