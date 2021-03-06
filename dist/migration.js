"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const hash_1 = require("./hash");
const header_1 = require("./header");
const instrumentation_1 = require("./instrumentation");
const memoize_1 = require("./memoize");
const pg_1 = require("./pg");
// NEVER CHANGE THESE!
const PREVIOUS = "--! Previous: ";
const HASH = "--! Hash: ";
// From https://stackoverflow.com/a/3561711/141284
function escapeRegexp(str) {
    return str.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}
exports.slowGeneratePlaceholderReplacement = (parsedSettings, { database }) => {
    const placeholders = Object.assign(Object.assign({}, parsedSettings.placeholders), { ":DATABASE_NAME": database, ":DATABASE_OWNER": parsedSettings.databaseOwner });
    const regexp = new RegExp("(?:" +
        Object.keys(placeholders)
            .map(escapeRegexp)
            .join("|") +
        ")\\b", "g");
    return (str) => str.replace(regexp, (keyword) => placeholders[keyword] || "");
};
exports.generatePlaceholderReplacement = memoize_1.default(exports.slowGeneratePlaceholderReplacement);
const TABLE_CHECKS = {
    migrations: {
        columnCount: 4,
    },
    current: {
        columnCount: 3,
    },
};
async function verifyGraphileMigrateSchema(pgClient) {
    // Verify that graphile_migrate schema exists
    const { rows: [graphileMigrateSchema], } = await pgClient.query(`select oid from pg_namespace where nspname = 'graphile_migrate';`);
    if (!graphileMigrateSchema) {
        throw new Error("You've set manageGraphileMigrateSchema to false, but have not installed our database schema - we cannot continue.");
    }
    for (const [tableName, expected] of Object.entries(TABLE_CHECKS)) {
        // Check that table exists
        const { rows: [table], } = await pgClient.query(`select oid from pg_class where relnamespace = ${graphileMigrateSchema.oid} and relname = '${tableName}'  and relkind = 'r'`);
        if (!table) {
            throw new Error(`You've set manageGraphileMigrateSchema to false, but the 'graphile_migrate.${tableName}' table couldn't be found - we cannot continue.`);
        }
        // Check that it has the right number of columns
        const { rows: columns } = await pgClient.query(`select attrelid, attname from pg_attribute where attrelid = ${table.oid} and attnum > 0`);
        if (columns.length !== expected.columnCount) {
            throw new Error(`You've set manageGraphileMigrateSchema to false, but the 'graphile_migrate.${tableName}' table has the wrong number of columns (${columns.length} != ${expected.columnCount}) - we cannot continue.`);
        }
    }
    return null;
}
async function _migrateMigrationSchema(pgClient, parsedSettings) {
    if (!parsedSettings.manageGraphileMigrateSchema) {
        // Verify schema
        await verifyGraphileMigrateSchema(pgClient);
        return;
    }
    await pgClient.query(`
    create schema if not exists graphile_migrate;

    create table if not exists graphile_migrate.migrations (
      hash text primary key,
      previous_hash text references graphile_migrate.migrations,
      filename text not null,
      date timestamptz not null default now()
    );

    create table if not exists graphile_migrate.current (
      filename text primary key default 'current.psql',
      content text not null,
      date timestamptz not null default now()
    );
  `);
}
exports._migrateMigrationSchema = _migrateMigrationSchema;
async function getLastMigration(pgClient, parsedSettings) {
    await _migrateMigrationSchema(pgClient, parsedSettings);
    const { rows: [row], } = await pgClient.query(`select filename, previous_hash as "previousHash", hash, date from graphile_migrate.migrations order by filename desc limit 1`);
    return row || null;
}
exports.getLastMigration = getLastMigration;
async function getAllMigrations(parsedSettings) {
    const { migrationsFolder } = parsedSettings;
    const committedMigrationsFolder = `${migrationsFolder}/committed`;
    try {
        await fs_1.promises.mkdir(migrationsFolder);
    }
    catch (e) {
        // noop
    }
    try {
        await fs_1.promises.mkdir(committedMigrationsFolder);
    }
    catch (e) {
        // noop
    }
    const files = await fs_1.promises.readdir(committedMigrationsFolder);
    const isMigration = (filename) => /^[0-9]{6,}\.sql/.exec(filename);
    const migrations = await Promise.all(files.filter(isMigration).map(async (filename) => {
        const fullPath = `${committedMigrationsFolder}/${filename}`;
        const contents = await fs_1.promises.readFile(fullPath, "utf8");
        const i = contents.indexOf("\n");
        const firstLine = contents.substring(0, i);
        if (!firstLine.startsWith(PREVIOUS)) {
            throw new Error("Invalid committed migration - no 'previous' comment");
        }
        const previousHashRaw = firstLine.substring(PREVIOUS.length) || null;
        const previousHash = previousHashRaw && previousHashRaw !== "-" ? previousHashRaw : null;
        const j = contents.indexOf("\n", i + 1);
        const secondLine = contents.substring(i + 1, j);
        if (!secondLine.startsWith(HASH)) {
            throw new Error("Invalid committed migration - no 'hash' comment");
        }
        const hash = secondLine.substring(HASH.length);
        if (contents[j + 1] !== "\n") {
            throw new Error(`Invalid migration header in '${fullPath}'`);
        }
        const body = contents.substring(j + 2);
        return {
            filename,
            fullPath,
            hash,
            previousHash,
            body,
            previous: null,
        };
    }));
    migrations.sort((a, b) => a.filename.localeCompare(b.filename));
    // Validate and link
    let previous = null;
    for (const migration of migrations) {
        if (!previous) {
            if (migration.previousHash !== null) {
                throw new Error(`Migration '${migration.filename}' expected a previous migration, but no correctly ordered previous migration was found`);
            }
        }
        else {
            if (migration.previousHash !== previous.hash) {
                throw new Error(`Previous migration with hash '${previous.hash}' doesn't match '${migration.filename}''s expected previous hash '${migration.previousHash}'`);
            }
        }
        migration.previous = previous;
        previous = migration;
    }
    return migrations;
}
exports.getAllMigrations = getAllMigrations;
async function getMigrationsAfter(parsedSettings, previousMigration) {
    const allMigrations = await getAllMigrations(parsedSettings);
    return allMigrations.filter(m => !previousMigration || m.filename > previousMigration.filename);
}
exports.getMigrationsAfter = getMigrationsAfter;
async function runStringMigration(pgClient, parsedSettings, context, rawBody, filename, committedMigration, dryRun) {
    const placeholderReplacement = exports.generatePlaceholderReplacement(parsedSettings, context);
    const sql = placeholderReplacement(rawBody);
    const transaction = header_1.isNoTransactionDefined(sql) === false;
    if (dryRun) {
        return { sql, transaction };
    }
    if (transaction) {
        await pgClient.query("begin");
    }
    try {
        await instrumentation_1.runQueryWithErrorInstrumentation(pgClient, sql, filename);
        if (committedMigration) {
            const { hash, previousHash, filename } = committedMigration;
            await pgClient.query({
                name: "migration-insert",
                text: "insert into graphile_migrate.migrations(hash, previous_hash, filename) values ($1, $2, $3)",
                values: [hash, previousHash, filename],
            });
        }
        if (transaction) {
            await pgClient.query("commit");
        }
        return { sql, transaction };
    }
    catch (e) {
        if (transaction) {
            await pgClient.query("rollback");
        }
        throw e;
    }
}
exports.runStringMigration = runStringMigration;
async function undoMigration(parsedSettings, committedMigration) {
    const { hash } = committedMigration;
    await pg_1.withClient(parsedSettings.connectionString, parsedSettings, async (pgClient) => {
        await pgClient.query({
            name: "migration-delete",
            text: "delete from graphile_migrate.migrations where hash = $1",
            values: [hash],
        });
    });
}
exports.undoMigration = undoMigration;
async function runCommittedMigration(pgClient, parsedSettings, context, committedMigration, logSuffix) {
    const { hash, filename, body, previousHash } = committedMigration;
    // Check the hash
    const newHash = hash_1.calculateHash(body, previousHash);
    if (newHash !== hash) {
        throw new Error(`Hash for ${filename} does not match - ${newHash} !== ${hash}; has the file been tampered with?`);
    }
    // eslint-disable-next-line no-console
    console.log(`graphile-migrate${logSuffix}: Running migration '${filename}'`);
    await runStringMigration(pgClient, parsedSettings, context, body, filename, committedMigration);
}
exports.runCommittedMigration = runCommittedMigration;
async function reverseMigration(pgClient, _body) {
    // TODO: reverse the migration
    // Clean up graphile_migrate.current
    await pgClient.query(`delete from graphile_migrate.current where filename = 'current.psql'`);
}
exports.reverseMigration = reverseMigration;
//# sourceMappingURL=migration.js.map