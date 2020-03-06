"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chalk = require("chalk");
const indent_1 = require("./indent");
async function runQueryWithErrorInstrumentation(pgClient, body, filename) {
    try {
        await pgClient.query({
            text: body,
        });
    }
    catch (e) {
        if (e.position) {
            const p = parseInt(e.position, 10);
            let line = 1;
            let column = 0;
            let idx = 0;
            while (idx < p) {
                column++;
                const char = body[idx];
                if (char === "\n") {
                    line++;
                    column = 0;
                }
                else {
                    // ...
                }
                idx++;
            }
            const endOfLine = body.indexOf("\n", p);
            const previousNewline = body.lastIndexOf("\n", p);
            const previousNewline2 = body.lastIndexOf("\n", previousNewline - 1) || previousNewline;
            const previousNewline3 = body.lastIndexOf("\n", previousNewline2 - 1) || previousNewline2;
            const previousNewline4 = body.lastIndexOf("\n", previousNewline3 - 1) || previousNewline3;
            const startOfLine = previousNewline + 1;
            const positionWithinLine = p - startOfLine;
            const snippet = body.substring(previousNewline4 + 1, endOfLine);
            const indentString = chalk.red("| ");
            const codeIndent = 2;
            const lines = [
                chalk.bold.red(`🛑 Error occurred at line ${line}, column ${column} of "${filename}":`),
                chalk.reset(indent_1.default(indent_1.default(snippet, codeIndent), indentString)),
                indentString +
                    chalk.red("-".repeat(positionWithinLine - 1 + codeIndent) + "^"),
                indentString + chalk.red.bold(e.code) + chalk.red(": " + e.message),
            ];
            e["_gmMessageOverride"] = lines.join("\n");
        }
        throw e;
    }
}
exports.runQueryWithErrorInstrumentation = runQueryWithErrorInstrumentation;
exports.logDbError = (e) => {
    // eslint-disable-next-line no-console
    console.error("");
    if (e["_gmMessageOverride"]) {
        // eslint-disable-next-line no-console
        console.error(e["_gmMessageOverride"]);
    }
    else {
        // eslint-disable-next-line no-console
        console.error(chalk.red.bold(`🛑 Error occurred whilst processing migration`));
        // eslint-disable-next-line no-console
        console.error(indent_1.default(e.stack ? e.stack : e.message, 4));
    }
    // eslint-disable-next-line no-console
    console.error("");
};
//# sourceMappingURL=instrumentation.js.map