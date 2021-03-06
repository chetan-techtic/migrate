"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chokidar = require("chokidar");
const actions_1 = require("../actions");
const instrumentation_1 = require("../instrumentation");
const migration_1 = require("../migration");
const pg_1 = require("../pg");
const settings_1 = require("../settings");
const migrate_1 = require("./migrate");
const pgMinify = require("pg-minify");
const current_1 = require("../current");
function _makeCurrentMigrationRunner(parsedSettings, _once = false, shadow = false) {
    async function run() {
        const currentLocation = await current_1.getCurrentMigrationLocation(parsedSettings);
        const body = await current_1.readCurrentMigration(parsedSettings, currentLocation);
        let migrationsAreEquivalent = false;
        try {
            // eslint-disable-next-line no-console
            console.log(`[${new Date().toISOString()}]: Running current.psql`);
            const start = process.hrtime();
            const connectionString = shadow
                ? parsedSettings.shadowConnectionString
                : parsedSettings.connectionString;
            if (!connectionString) {
                throw new Error("Could not determine connection string for running commands");
            }
            await pg_1.withClient(connectionString, parsedSettings, (lockingPgClient, context) => pg_1.withTransaction(lockingPgClient, async () => {
                // 1: lock graphile_migrate.current so no concurrent migrations can occur
                await lockingPgClient.query("lock graphile_migrate.current in EXCLUSIVE mode");
                // 2: Get last current.psql from graphile_migrate.current
                const { rows: [previousCurrent], } = await lockingPgClient.query(`
              select *
              from graphile_migrate.current
              where filename = 'current.psql'
            `);
                // 3: minify and compare last ran current.psql with this _COMPILED_ current.psql.
                const previousBody = previousCurrent && previousCurrent.content;
                const { sql: currentBodyFromDryRun } = await migration_1.runStringMigration(lockingPgClient, parsedSettings, context, body, "current.psql", undefined, true);
                const previousBodyMinified = previousBody
                    ? pgMinify(previousBody)
                    : null;
                const currentBodyMinified = pgMinify(currentBodyFromDryRun);
                migrationsAreEquivalent =
                    currentBodyMinified === previousBodyMinified;
                // 4: if different
                if (!migrationsAreEquivalent) {
                    // 4a: invert previous current; on success delete from graphile_migrate.current; on failure rollback and abort
                    if (previousBody) {
                        await migration_1.reverseMigration(lockingPgClient, previousBody);
                    }
                    // COMMIT ─ because we need to commit that the migration was reversed
                    await lockingPgClient.query("commit");
                    await lockingPgClient.query("begin");
                    // Re-establish a lock ASAP to continue with migration
                    await lockingPgClient.query("lock graphile_migrate.current in EXCLUSIVE mode");
                    // 4b: run this current (in its own independent transaction) if not empty
                    if (currentBodyMinified !== "") {
                        await pg_1.withClient(connectionString, parsedSettings, (independentPgClient, context) => migration_1.runStringMigration(independentPgClient, parsedSettings, context, body, "current.psql", undefined));
                    }
                }
                else {
                    // eslint-disable-next-line no-console
                    console.log(`[${new Date().toISOString()}]: current.psql unchanged, skipping migration`);
                }
                // 5: update graphile_migrate.current with latest content
                //   (NOTE: we update even if the minified versions don't differ since
                //    the comments may have changed.)
                await lockingPgClient.query({
                    name: "current-insert",
                    text: `
              insert into graphile_migrate.current(content)
              values ($1)
              on conflict (filename)
              do update
              set content = excluded.content, date = excluded.date
            `,
                    values: [currentBodyFromDryRun],
                });
            }));
            const interval = process.hrtime(start);
            const duration = interval[0] * 1e3 + interval[1] * 1e-6;
            if (!migrationsAreEquivalent) {
                await actions_1.executeActions(parsedSettings, shadow, parsedSettings.afterCurrent);
            }
            const interval2 = process.hrtime(start);
            const duration2 = interval2[0] * 1e3 + interval2[1] * 1e-6;
            // eslint-disable-next-line no-console
            console.log(`[${new Date().toISOString()}]: Finished (${duration2.toFixed(0)}ms${duration2 - duration >= 5
                ? `; excluding actions: ${duration.toFixed(0)}ms`
                : ""})`);
        }
        catch (e) {
            instrumentation_1.logDbError(e);
        }
    }
    return run;
}
exports._makeCurrentMigrationRunner = _makeCurrentMigrationRunner;
async function _watch(parsedSettings, once = false, shadow = false) {
    await migrate_1._migrate(parsedSettings, shadow);
    const currentLocation = await current_1.getCurrentMigrationLocation(parsedSettings);
    if (!currentLocation.exists) {
        await current_1.writeCurrentMigration(parsedSettings, currentLocation, parsedSettings.blankMigrationContent);
    }
    const run = _makeCurrentMigrationRunner(parsedSettings, once, shadow);
    if (once) {
        return run();
    }
    else {
        let running = false;
        let runAgain = false;
        const queue = () => {
            if (running) {
                runAgain = true;
            }
            running = true;
            run().finally(() => {
                running = false;
                if (runAgain) {
                    runAgain = false;
                    queue();
                }
            });
        };
        const watcher = chokidar.watch(currentLocation.path, {
            /*
             * Without `usePolling`, on Linux, you can prevent the watching from
             * working by issuing `git stash && sleep 2 && git stash pop`. This is
             * annoying.
             */
            usePolling: true,
            /*
             * Some editors stream the writes out a little at a time, we want to wait
             * for the write to finish before triggering.
             */
            awaitWriteFinish: {
                stabilityThreshold: 200,
                pollInterval: 100,
            },
        });
        watcher.on("change", queue);
        queue();
        return Promise.resolve();
    }
}
exports._watch = _watch;
async function watch(settings, once = false, shadow = false) {
    const parsedSettings = await settings_1.parseSettings(settings, shadow);
    return _watch(parsedSettings, once, shadow);
}
exports.watch = watch;
//# sourceMappingURL=watch.js.map