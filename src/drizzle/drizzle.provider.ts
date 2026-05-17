import { Provider } from '@nestjs/common';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { join } from 'path';

export const DRIZZLE = 'DRIZZLE';

export type DrizzleDB = BetterSQLite3Database<typeof schema>;

export const drizzleProvider: Provider = {
  provide: DRIZZLE,
  useFactory: () => {
    const sqlite = new Database('sqlite.db');
    // Enable Write-Ahead Logging (WAL) mode for superior SQLite performance
    sqlite.pragma('journal_mode = WAL');
    
    const db = drizzle(sqlite, { schema });
    
    try {
      // Auto-run migrations using absolute path relative to process.cwd()
      migrate(db, { migrationsFolder: join(process.cwd(), 'drizzle') });
      console.log('Database migrations applied successfully.');
    } catch (error) {
      console.warn('Could not run database migrations automatically:', error.message);
      console.warn('Make sure to run "pnpm db:generate" first.');
    }
    
    return db;
  },
};
