import { ActionSpec, CommandActionSpec, SqlActionSpec } from "./actions";
export declare type Actions = string | Array<string | ActionSpec>;
export declare function isActionSpec(o: unknown): o is ActionSpec;
export declare function isSqlActionSpec(o: unknown): o is SqlActionSpec;
export declare function isCommandActionSpec(o: unknown): o is CommandActionSpec;
export interface Settings {
    connectionString?: string;
    shadowConnectionString?: string;
    rootConnectionString?: string;
    databaseOwner?: string;
    manageGraphileMigrateSchema?: boolean;
    pgSettings?: {
        [key: string]: string;
    };
    placeholders?: {
        [key: string]: string;
    };
    afterReset?: Actions;
    afterAllMigrations?: Actions;
    afterCurrent?: Actions;
}
export interface ParsedSettings extends Settings {
    connectionString: string;
    rootConnectionString: string;
    databaseOwner: string;
    migrationsFolder: string;
    databaseName: string;
    shadowDatabaseName?: string;
    afterReset: ActionSpec[];
    afterAllMigrations: ActionSpec[];
    afterCurrent: ActionSpec[];
    blankMigrationContent: string;
}
export declare function parseSettings(settings: Settings, requireShadow?: boolean): Promise<ParsedSettings>;
