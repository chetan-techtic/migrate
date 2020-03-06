"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const migration_1 = require("../migration");
const pg_1 = require("../pg");
const settings_1 = require("../settings");
const pgMinify = require("pg-minify");
const current_1 = require("../current");
async function _status(parsedSettings) {
    const connectionString = parsedSettings.connectionString;
    if (!connectionString) {
        throw new Error("Could not determine connection string");
    }
    return pg_1.withClient(connectionString, parsedSettings, async (pgClient) => {
        const lastMigration = await migration_1.getLastMigration(pgClient, parsedSettings);
        const remainingMigrations = await migration_1.getMigrationsAfter(parsedSettings, lastMigration);
        const currentLocation = await current_1.getCurrentMigrationLocation(parsedSettings);
        const body = await current_1.readCurrentMigration(parsedSettings, currentLocation);
        const minifiedBody = pgMinify(body);
        const hasCurrentMigration = minifiedBody !== "";
        return {
            remainingMigrations: remainingMigrations.map(m => m.filename),
            hasCurrentMigration,
        };
    });
}
async function status(settings) {
    const parsedSettings = await settings_1.parseSettings(settings, true);
    return _status(parsedSettings);
}
exports.status = status;
//# sourceMappingURL=status.js.map