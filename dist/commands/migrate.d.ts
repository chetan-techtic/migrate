import { ParsedSettings, Settings } from "../settings";
export declare function _migrate(parsedSettings: ParsedSettings, shadow?: boolean, force?: boolean): Promise<void>;
export declare function migrate(settings: Settings, shadow?: boolean, force?: boolean): Promise<void>;
