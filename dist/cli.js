#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable @typescript-eslint/explicit-function-return-type,no-console */
const fs = require("fs");
const uncommit_1 = require("./commands/uncommit");
const index_1 = require("./index");
function getSettings() {
    let data;
    try {
        data = fs.readFileSync(`${process.cwd()}/.gmrc`, "utf8");
    }
    catch (e) {
        throw new Error("No .gmrc file found; please run `graphile-migrate init` first.");
    }
    try {
        return JSON.parse(data);
    }
    catch (e) {
        throw new Error("Failed to parse .gmrc file: " + e.message);
    }
}
async function main() {
    const argv = process.argv.slice(2);
    const [cmd] = argv;
    if (argv.length === 0 || cmd === "migrate") {
        const shadow = argv.includes("--shadow");
        const force = argv.includes("--force");
        await index_1.migrate(getSettings(), shadow, force);
    }
    else if (cmd === "watch") {
        const once = argv.includes("--once");
        const shadow = argv.includes("--shadow");
        await index_1.watch(getSettings(), once, shadow);
    }
    else if (cmd === "reset") {
        const shadow = argv.includes("--shadow");
        await index_1.reset(getSettings(), shadow);
    }
    else if (cmd === "commit") {
        await index_1.commit(getSettings());
    }
    else if (cmd === "uncommit") {
        await uncommit_1.uncommit(getSettings());
    }
    else if (cmd === "status") {
        let exitCode = 0;
        const details = await index_1.status(getSettings());
        const remainingCount = details.remainingMigrations.length;
        if (remainingCount) {
            console.log(`There are ${remainingCount} committed migrations pending:\n\n  ${details.remainingMigrations.join("\n  ")}`);
            exitCode += 1;
        }
        if (details.hasCurrentMigration) {
            if (exitCode) {
                console.log();
            }
            console.log("The current.psql migration is not empty and has not been committed.");
            exitCode += 2;
        }
        // ESLint false positive.
        // eslint-disable-next-line require-atomic-updates
        process.exitCode = exitCode;
        if (exitCode === 0) {
            console.log("Up to date.");
        }
    }
    else {
        // eslint-disable-next-line no-console
        console.error(`Command '${cmd || ""}' not understood`);
        process.exit(1);
    }
}
main().catch(e => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
});
//# sourceMappingURL=cli.js.map