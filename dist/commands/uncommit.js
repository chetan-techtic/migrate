"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const migration_1 = require("../migration");
const settings_1 = require("../settings");
const pgMinify = require("pg-minify");
const fs_1 = require("fs");
const current_1 = require("../current");
const migrate_1 = require("./migrate");
const reset_1 = require("./reset");
async function _uncommit(parsedSettings) {
    const { migrationsFolder } = parsedSettings;
    const committedMigrationsFolder = `${migrationsFolder}/committed`;
    // Determine the last migration
    const allMigrations = await migration_1.getAllMigrations(parsedSettings);
    const lastMigration = allMigrations[allMigrations.length - 1];
    if (!lastMigration) {
        throw new Error("There's no committed migration to uncommit");
    }
    // Check current.psql is blank
    const currentLocation = await current_1.getCurrentMigrationLocation(parsedSettings);
    const currentBody = await current_1.readCurrentMigration(parsedSettings, currentLocation);
    const minifiedCurrentBody = pgMinify(currentBody);
    if (minifiedCurrentBody !== "") {
        throw new Error("Cannot uncommit - current migration is not blank.");
    }
    // Restore current.psql from migration
    const lastMigrationFilepath = `${committedMigrationsFolder}/${lastMigration.filename}`;
    const body = await fs_1.promises.readFile(lastMigrationFilepath, "utf8");
    const nn = body.indexOf("\n\n");
    if (nn < 10) {
        throw new Error(`Migration '${lastMigrationFilepath}' seems invalid - could not read metadata`);
    }
    const bodyWithoutMetadata = body.substr(nn + 2);
    await current_1.writeCurrentMigration(parsedSettings, currentLocation, bodyWithoutMetadata);
    // Delete the migration from committed and from the DB
    await fs_1.promises.unlink(lastMigrationFilepath);
    await migration_1.undoMigration(parsedSettings, lastMigration);
    // eslint-disable-next-line no-console
    console.log(`graphile-migrate: migration '${lastMigrationFilepath}' undone`);
    // Reset shadow
    await reset_1._reset(parsedSettings, true);
    await migrate_1._migrate(parsedSettings, true, true);
}
exports._uncommit = _uncommit;
async function uncommit(settings) {
    const parsedSettings = await settings_1.parseSettings(settings, true);
    return _uncommit(parsedSettings);
}
exports.uncommit = uncommit;
//# sourceMappingURL=uncommit.js.map