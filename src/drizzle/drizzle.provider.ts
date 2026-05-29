import { Provider } from '@nestjs/common';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as schema from './schema';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

export const DRIZZLE = 'DRIZZLE';

export type DrizzleDB = BetterSQLite3Database<typeof schema>;

function columnExists(sqlite: Database.Database, table: string, column: string) {
  const rows = sqlite
    .prepare(`PRAGMA table_info(${table})`)
    .all() as { name: string }[];
  return rows.some((r) => r.name === column);
}

/** Apply critical migrations when drizzle journal is out of sync with the DB file. */
function ensureCriticalSchema(sqlite: Database.Database) {
  if (!columnExists(sqlite, 'tags', 'notebook_id')) {
    const sqlPath = join(process.cwd(), 'drizzle', '0011_workspace_tags.sql');
    const sql = readFileSync(sqlPath, 'utf8');
    for (const statement of sql.split('--> statement-breakpoint')) {
      const trimmed = statement.trim();
      if (trimmed) {
        try {
          sqlite.exec(trimmed);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          if (!msg.includes('duplicate column') && !msg.includes('already exists')) {
            throw err;
          }
        }
      }
    }
    console.log('Applied workspace tags schema patch (0011).');
  }

  if (!tableExists(sqlite, 'workspace_invites')) {
    const sqlPath = join(process.cwd(), 'drizzle', '0012_workspace_invites.sql');
    const sql = readFileSync(sqlPath, 'utf8');
    for (const statement of sql.split('--> statement-breakpoint')) {
      const trimmed = statement.trim();
      if (trimmed) sqlite.exec(trimmed);
    }
    console.log('Applied workspace invites schema patch (0012).');
  }

  if (!columnExists(sqlite, 'notifications', 'metadata')) {
    const sqlPath = join(process.cwd(), 'drizzle', '0013_notification_metadata.sql');
    const sql = readFileSync(sqlPath, 'utf8').trim();
    if (sql) sqlite.exec(sql);
    console.log('Applied notification metadata schema patch (0013).');
  }
}

function tableExists(sqlite: Database.Database, table: string) {
  const row = sqlite
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
    )
    .get(table);
  return Boolean(row);
}

export const drizzleProvider: Provider = {
  provide: DRIZZLE,
  useFactory: () => {
    const sqlite = new Database('sqlite.db');
    sqlite.pragma('journal_mode = WAL');

    const db = drizzle(sqlite, { schema });

    try {
      migrate(db, { migrationsFolder: join(process.cwd(), 'drizzle') });
      console.log('Database migrations applied successfully.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('Drizzle migrate warning:', message);
    }

    ensureCriticalSchema(sqlite);

    return db;
  },
};
