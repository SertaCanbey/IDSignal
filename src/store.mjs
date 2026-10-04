import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

export class Store {
  constructor(dir) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const keyPath = join(dir, 'vault.key');
    if (!existsSync(keyPath)) writeFileSync(keyPath, randomBytes(32), { mode: 0o600, flag: 'wx' });
    this.key = readFileSync(keyPath);
    this.db = new DatabaseSync(join(dir, 'IDSignal.db'));
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA secure_delete=ON;
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, time TEXT NOT NULL, value TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS event_time ON events(time);
      CREATE TABLE IF NOT EXISTS geo (ip TEXT PRIMARY KEY, checked TEXT NOT NULL, value TEXT NOT NULL);`);
  }
  get(key, fallback = null) { const r = this.db.prepare('SELECT value FROM settings WHERE key=?').get(key); return r ? JSON.parse(r.value) : fallback; }
  set(key, value) { this.db.prepare('INSERT OR REPLACE INTO settings VALUES (?,?)').run(key, JSON.stringify(value)); }
  encrypt(value) {
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
  }
  decrypt(value) {
    const b = Buffer.from(value, 'base64'), cipher = createDecipheriv('aes-256-gcm', this.key, b.subarray(0, 12));
    cipher.setAuthTag(b.subarray(12, 28));
    return Buffer.concat([cipher.update(b.subarray(28)), cipher.final()]).toString('utf8');
  }
  events(since) { return this.db.prepare('SELECT value FROM events WHERE time>=? ORDER BY time DESC').all(since).map(r => JSON.parse(r.value)); }
  getGeo(ip) { const r=this.db.prepare('SELECT value FROM geo WHERE ip=?').get(ip);return r?JSON.parse(r.value):null; }
  setGeo(ip,value) { this.db.prepare('INSERT OR REPLACE INTO geo VALUES (?,?,?)').run(ip,value.checkedAt,JSON.stringify(value));this.db.prepare('DELETE FROM geo WHERE checked<?').run(new Date(Date.now()-180*86400000).toISOString()); }
  commitSync(users, mfa, events, sync) {
    this.db.exec('BEGIN');
    try {
      this.set('users', users); this.set('mfa', mfa);
      const stmt = this.db.prepare('INSERT OR REPLACE INTO events VALUES (?,?,?)');
      for (const e of events) if (e.id && e.createdDateTime) stmt.run(e.id, e.createdDateTime, JSON.stringify(e));
      this.set('sync', sync); this.prune(); this.db.exec('COMMIT');
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  prune() { this.db.prepare('DELETE FROM events WHERE time<?').run(new Date(Date.now() - 30 * 86400000).toISOString()); }
  importEvents(events, metadata) {
    this.db.exec('BEGIN');
    try {
      let inserted=0;
      const stmt=this.db.prepare('INSERT OR IGNORE INTO events VALUES (?,?,?)');
      for(const e of events)inserted+=Number(stmt.run(e.id,e.createdDateTime,JSON.stringify(e)).changes);
      const result={...metadata,inserted,existing:events.length-inserted};
      this.set('import',result);this.prune();this.db.exec('COMMIT');return result;
    }catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  resetConnection() {
    this.db.exec('BEGIN');
    try { for (const k of ['connection', 'auditConnection', 'users', 'mfa', 'sync', 'import']) this.db.prepare('DELETE FROM settings WHERE key=?').run(k); this.db.exec('DELETE FROM events; COMMIT'); }
    catch(e) { this.db.exec('ROLLBACK'); throw e; }
  }
  close() { this.db.close(); }
}
