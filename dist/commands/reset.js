"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const actions_1 = require("../actions");
const pg_1 = require("../pg");
const settings_1 = require("../settings");
const migrate_1 = require("./migrate");
async function _reset(parsedSettings, shadow) {
    const connectionString = shadow
        ? parsedSettings.shadowConnectionString
        : parsedSettings.connectionString;
    if (!connectionString) {
        throw new Error("Could not determine connection string for reset");
    }
    await pg_1.withClient(parsedSettings.rootConnectionString, parsedSettings, async (pgClient) => {
        const databaseName = shadow
            ? parsedSettings.shadowDatabaseName
            : parsedSettings.databaseName;
        if (!databaseName) {
            throw new Error("Database name unknown");
        }
        const databaseOwner = parsedSettings.databaseOwner;
        const logSuffix = shadow ? "[shadow]" : "";
        await pgClient.query(`DROP DATABASE IF EXISTS ${pg_1.escapeIdentifier(databaseName)};`);
        // eslint-disable-next-line no-console
        console.log(`graphile-migrate${logSuffix}: dropped database '${databaseName}'`);
        await pgClient.query(`CREATE DATABASE ${pg_1.escapeIdentifier(databaseName)} OWNER ${pg_1.escapeIdentifier(databaseOwner)};`);
        await pgClient.query(`REVOKE ALL ON DATABASE ${pg_1.escapeIdentifier(databaseName)} FROM PUBLIC;`);
        // eslint-disable-next-line no-console
        console.log(`graphile-migrate${logSuffix}: recreated database '${databaseName}'`);
    });
    await actions_1.executeActions(parsedSettings, shadow, parsedSettings.afterReset);
    await migrate_1._migrate(parsedSettings, shadow);
}
exports._reset = _reset;
async function reset(settings, shadow = false) {
    const parsedSettings = await settings_1.parseSettings(settings, shadow);
    return _reset(parsedSettings, shadow);
}
exports.reset = reset;
//# sourceMappingURL=reset.js.map