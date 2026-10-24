import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import EmbeddedPostgres from 'embedded-postgres';

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.pgdata');

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'postgres',
  password: 'postgres',
  port: 5432,
  persistent: true,
});

if (!fs.existsSync(path.join(dataDir, 'PG_VERSION'))) {
  await pg.initialise();
}

await pg.start();

try {
  await pg.createDatabase('ekofi');
} catch {
  // Database already exists
}

console.log('Embedded PostgreSQL is running on localhost:5432 (database: ekofi)');
