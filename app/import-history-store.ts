import { z } from 'zod';
import type { Article } from './model';

export const importMetadataSchema=z.object({sourceName:z.string().trim().min(1).max(255)});
export type ImportCollection='articles'|'examples';
export type ImportBatch={id:string;collection:ImportCollection;sourceName:string;createdAt:string;requestedCount:number;insertedCount:number;remainingCount:number};

// D1 batch runs the history and record inserts in one transaction. Only newly
// inserted rows receive this batch ID; skipped duplicates keep their owner batch.
export async function recordImport(db:D1Database,userId:string,collection:ImportCollection,entries:Article[],sourceName:string){
 const id=crypto.randomUUID(),now=new Date().toISOString();
 const results=await db.batch([
  db.prepare('INSERT INTO import_batches (id,user_id,collection,source_name,created_at,requested_count) VALUES (?,?,?,?,?,?)').bind(id,userId,collection,sourceName,now,entries.length),
  ...entries.map(entry=>db.prepare(`INSERT OR IGNORE INTO ${collection} (id,user_id,data,created_at,updated_at,import_batch_id) VALUES (?,?,?,?,?,?)`).bind(entry.id,userId,JSON.stringify(entry),now,now,id)),
  db.prepare(`UPDATE import_batches SET inserted_count=(SELECT COUNT(*) FROM ${collection} WHERE user_id=? AND import_batch_id=?) WHERE user_id=? AND id=?`).bind(userId,id,userId,id),
 ]);
 return results.slice(1,-1).reduce((count,result)=>count+(result.meta.changes||0),0);
}
