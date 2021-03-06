import { Client, Context } from "./pg";
import { ParsedSettings } from "./settings";
export interface Migration {
    filename: string;
    hash: string;
    previousHash: string | null;
}
export interface DbMigration extends Migration {
    date: Date;
}
export interface FileMigration extends Migration {
    body: string;
    fullPath: string;
    previous: FileMigration | null;
}
export declare const slowGeneratePlaceholderReplacement: (parsedSettings: ParsedSettings, { database }: Context) => (str: string) => string;
export declare const generatePlaceholderReplacement: (parsedSettings: ParsedSettings, __1: Context) => (str: string) => string;
export declare function _migrateMigrationSchema(pgClient: Client, parsedSettings: ParsedSettings): Promise<void>;
export declare function getLastMigration(pgClient: Client, parsedSettings: ParsedSettings): Promise<DbMigration | null>;
export declare function getAllMigrations(parsedSettings: ParsedSettings): Promise<Array<FileMigration>>;
export declare function getMigrationsAfter(parsedSettings: ParsedSettings, previousMigration: Migration | null): Promise<Array<FileMigration>>;
export declare function runStringMigration(pgClient: Client, parsedSettings: ParsedSettings, context: Context, rawBody: string, filename: string, committedMigration?: FileMigration, dryRun?: boolean): Promise<{
    sql: string;
    transaction: boolean;
}>;
export declare function undoMigration(parsedSettings: ParsedSettings, committedMigration: FileMigration): Promise<void>;
export declare function runCommittedMigration(pgClient: Client, parsedSettings: ParsedSettings, context: Context, committedMigration: FileMigration, logSuffix: string): Promise<void>;
export declare function reverseMigration(pgClient: Client, _body: string): Promise<void>;
