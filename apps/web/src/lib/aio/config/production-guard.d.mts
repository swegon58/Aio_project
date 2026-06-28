export type Environment = Record<string, string | undefined>;

export function isProductionDeployment(env?: Environment): boolean;
export function productionEnvironmentErrors(env: Environment): string[];
export function assertProductionEnvironment(env?: Environment): void;
