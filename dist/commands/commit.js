"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const migration_1 = require("../migration");
const settings_1 = require("../settings");
const pgMinify = require("pg-minify");
const fs_1 = require("fs");
const current_1 = require("../current");
const hash_1 = require("../hash");
const instrumentation_1 = require("../instrumentation");
const migrate_1 = require("./migrate");
const reset_1 = require("./reset");
async function _commit(parsedSettings) {
    const { migrationsFolder } = parsedSettings;
    const committedMigrationsFolder = `${migrationsFolder}/committed`;
    const allMigrations = await migration_1.getAllMigrations(parsedSettings);
    const lastMigration = allMigrations[allMigrations.length - 1];
    const newMigrationNumber = lastMigration
        ? parseInt(lastMigration.filename, 10) + 1
        : 1;
    if (Number.isNaN(newMigrationNumber)) {
        throw new Error("Could not determine next migration number");
    }
    const newMigrationFilename = String(newMigrationNumber).padStart(6, "0") + ".sql";
    const currentLocation = await current_1.getCurrentMigrationLocation(parsedSettings);
    const body = await current_1.readCurrentMigration(parsedSettings, currentLocation);
    const minifiedBody = pgMinify(body);
    if (minifiedBody === "") {
        throw new Error("Current migration is blank.");
    }
    const hash = hash_1.calculateHash(body, lastMigration && lastMigration.hash);
    const finalBody = `--! Previous: ${lastMigration ? lastMigration.hash : "-"}\n--! Hash: ${hash}\n\n${body.trim()}\n`;
    await reset_1._reset(parsedSettings, true);
    const newMigrationFilepath = `${committedMigrationsFolder}/${newMigrationFilename}`;
    await fs_1.promises.writeFile(newMigrationFilepath, finalBody);
    // eslint-disable-next-line no-console
    console.log(`graphile-migrate: New migration '${newMigrationFilename}' created`);
    try {
        await migrate_1._migrate(parsedSettings, true);
        await migrate_1._migrate(parsedSettings);
        await current_1.writeCurrentMigration(parsedSettings, currentLocation, parsedSettings.blankMigrationContent);
    }
    catch (e) {
        instrumentation_1.logDbError(e);
        // eslint-disable-next-line no-console
        console.error("ABORTING...");
        await current_1.writeCurrentMigration(parsedSettings, currentLocation, body);
        await fs_1.promises.unlink(newMigrationFilepath);
        // eslint-disable-next-line no-console
        console.error("ABORTED AND ROLLED BACK");
        process.exitCode = 1;
    }
}
exports._commit = _commit;
async function commit(settings) {
    const parsedSettings = await settings_1.parseSettings(settings, true);
    return _commit(parsedSettings);
}
exports.commit = commit;
//# sourceMappingURL=commit.js.map