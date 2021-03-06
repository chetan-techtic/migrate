import { ParsedSettings, Settings } from "../settings";
export declare function _makeCurrentMigrationRunner(parsedSettings: ParsedSettings, _once?: boolean, shadow?: boolean): () => Promise<void>;
export declare function _watch(parsedSettings: ParsedSettings, once?: boolean, shadow?: boolean): Promise<void>;
export declare function watch(settings: Settings, once?: boolean, shadow?: boolean): Promise<void>;
