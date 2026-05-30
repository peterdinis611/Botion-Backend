import { Provider } from '@nestjs/common';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import * as schema from './schema';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

export const DRIZZLE = 'DRIZZLE';

export type DrizzleDB = BetterSQLite3Database<typeof schema>;

/** Find backend package root by locating the drizzle migrations folder. */
function resolveBackendRoot(): string {
  let dir = resolve(__dirname);

  for (let i = 0; i < 8; i++) {
    const migrationsDir = join(dir, 'drizzle');
    if (
      existsSync(join(migrationsDir, 'meta', '_journal.json')) ||
      existsSync(join(migrationsDir, '0000_purple_the_renegades.sql'))
    ) {
      return dir;
    }

    const parent = join(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }

  throw new Error(
    `Could not locate backend drizzle migrations from ${__dirname}`,
  );
}

function columnExists(sqlite: Database.Database, table: string, column: string) {
  const rows = sqlite
    .prepare(`PRAGMA table_info(${table})`)
    .all() as { name: string }[];
  return rows.some((r) => r.name === column);
}

function tableExists(sqlite: Database.Database, table: string) {
  const row = sqlite
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
    .get(table);
  return Boolean(row);
}

function applySqlPatch(
  sqlite: Database.Database,
  backendRoot: string,
  filename: string,
  label: string,
  options?: { splitBreakpoints?: boolean },
) {
  const sqlPath = join(backendRoot, 'drizzle', filename);
  if (!existsSync(sqlPath)) {
    console.warn(`Schema patch file missing: ${sqlPath}`);
    return;
  }

  const sql = readFileSync(sqlPath, 'utf8');
  const statements = options?.splitBreakpoints
    ? sql.split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean)
    : [sql.trim()].filter(Boolean);

  for (const statement of statements) {
    try {
      sqlite.exec(statement);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('duplicate column') && !msg.includes('already exists')) {
        throw err;
      }
    }
  }

  console.log(`Applied schema patch (${label}).`);
}

/** Apply critical migrations when drizzle journal is out of sync with the DB file. */
function ensureCriticalSchema(sqlite: Database.Database, backendRoot: string) {
  if (!columnExists(sqlite, 'tags', 'notebook_id')) {
    applySqlPatch(sqlite, backendRoot, '0011_workspace_tags.sql', '0011', {
      splitBreakpoints: true,
    });
  }

  if (!tableExists(sqlite, 'workspace_invites')) {
    applySqlPatch(sqlite, backendRoot, '0012_workspace_invites.sql', '0012', {
      splitBreakpoints: true,
    });
  }

  if (!columnExists(sqlite, 'notifications', 'metadata')) {
    applySqlPatch(sqlite, backendRoot, '0013_notification_metadata.sql', '0013');
  }

  if (!columnExists(sqlite, 'notes', 'sort_order')) {
    applySqlPatch(sqlite, backendRoot, '0014_note_sort_order.sql', '0014');
  }
}

export const drizzleProvider: Provider = {
  provide: DRIZZLE,
  useFactory: () => {
    const backendRoot = resolveBackendRoot();
    const dbPath = join(backendRoot, 'sqlite.db');
    const migrationsFolder = join(backendRoot, 'drizzle');

    console.log(`Using database: ${dbPath}`);

    const sqlite = new Database(dbPath);
    sqlite.pragma('journal_mode = WAL');

    const db = drizzle(sqlite, { schema });

    try {
      migrate(db, { migrationsFolder });
      console.log('Database migrations applied successfully.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('Drizzle migrate warning:', message);
    }

    ensureCriticalSchema(sqlite, backendRoot);

    if (!columnExists(sqlite, 'notes', 'sort_order')) {
      throw new Error(
        'Database schema is missing notes.sort_order. Run from backend/: sqlite3 sqlite.db "ALTER TABLE notes ADD COLUMN sort_order integer DEFAULT 0 NOT NULL;"',
      );
    }

    return db;
  },
};
