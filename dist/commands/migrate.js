"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const actions_1 = require("../actions");
const migration_1 = require("../migration");
const pg_1 = require("../pg");
const settings_1 = require("../settings");
async function _migrate(parsedSettings, shadow = false, force = false) {
    const connectionString = shadow
        ? parsedSettings.shadowConnectionString
        : parsedSettings.connectionString;
    if (!connectionString) {
        throw new Error("Could not determine connection string");
    }
    const logSuffix = shadow ? "[shadow]" : "";
    await pg_1.withClient(connectionString, parsedSettings, async (pgClient, context) => {
        const lastMigration = await migration_1.getLastMigration(pgClient, parsedSettings);
        const remainingMigrations = await migration_1.getMigrationsAfter(parsedSettings, lastMigration);
        // Run migrations in series
        for (const migration of remainingMigrations) {
            await migration_1.runCommittedMigration(pgClient, parsedSettings, context, migration, logSuffix);
        }
        if (remainingMigrations.length > 0 || force) {
            await actions_1.executeActions(parsedSettings, shadow, parsedSettings.afterAllMigrations);
        }
        // eslint-disable-next-line no-console
        console.log(`graphile-migrate${logSuffix}: ${remainingMigrations.length > 0
            ? `${remainingMigrations.length} committed migrations executed`
            : lastMigration
                ? "Already up to date"
                : `Up to date — no committed migrations to run`}`);
    });
}
exports._migrate = _migrate;
async function migrate(settings, shadow = false, force = false) {
    const parsedSettings = await settings_1.parseSettings(settings, shadow);
    return _migrate(parsedSettings, shadow, force);
}
exports.migrate = migrate;
//# sourceMappingURL=migrate.js.map