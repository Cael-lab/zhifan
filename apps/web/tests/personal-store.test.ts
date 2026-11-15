import { afterEach, beforeEach, expect, it } from "vitest";
import type Database from "better-sqlite3";
import { openJournalDatabase } from "../src/db/bootstrap";
import { PersonalStore } from "../src/server/personal-store";
import { emptyContent } from "../src/lib/personal";
let sqlite:Database.Database,store:PersonalStore;
beforeEach(()=>{sqlite=openJournalDatabase(':memory:');store=new PersonalStore(sqlite);});
afterEach(()=>sqlite.close());
const note=(title='知识点')=>({...emptyContent(),kind:'knowledge',title});
it('persists Chinese notes and rejects stale overwrites without losing the latest text',()=>{
 const first=store.save(note());
 const next=store.save({...first,content:'新的观察与理解'},first.id);
 expect(next.revision).toBe(2);
 expect(()=>store.save({...first,content:'旧页面'},first.id)).toThrow('其他页面');
 expect(store.get(first.id)?.content).toBe('新的观察与理解');
});
it('removes a knowledge point with its cases and image bytes, while preserving unrelated diary content',()=>{
 const point=store.save(note());
 const example=store.save({...note('案例'),kind:'case',parentId:point.id});
 const diary=store.save({...note('日记'),kind:'diary',knowledgeIds:[point.id]});
 sqlite.prepare("INSERT INTO attachments VALUES (?,?,?,?,?,?,?,?)").run('image','personal',example.id,'test.png','image/png',3,Buffer.from([1,2,3]),new Date().toISOString());
 store.remove(point.id);
 expect(store.get(example.id)).toBeNull();
 expect(sqlite.prepare('SELECT * FROM attachments').all()).toEqual([]);
 expect(store.get(diary.id)?.knowledgeIds).toEqual([]);
 expect(store.get(diary.id)?.title).toBe('日记');
});
it('requires an existing knowledge parent and refuses invalid links and dates atomically',()=>{
 expect(()=>store.save({...note(),kind:'case',parentId:'missing'})).toThrow('知识点');
 expect(()=>store.save({...note(),tradeKeys:['missing']})).toThrow('交易不存在');
 expect(()=>store.save({...note(),date:'2026-02-30'})).toThrow('日期');
 expect(()=>store.save({...note(),source:'javascript:alert(1)'})).toThrow('来源');
 expect(store.list()).toEqual([]);
});
