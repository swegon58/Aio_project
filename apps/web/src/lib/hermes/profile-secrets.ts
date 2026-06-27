import fs from "fs/promises";
import { profileEnvPath } from "@/lib/hermes/config";

const ENV_NAME = /^[A-Z][A-Z0-9_]*$/;

export async function resolveProfileSecret(
  profileName: string | null,
  envName: string,
): Promise<string | null> {
  if (!ENV_NAME.test(envName)) return null;

  if (profileName) {
    try {
      const envRaw = await fs.readFile(profileEnvPath(profileName), "utf-8");
      const line = envRaw
        .split(/\r?\n/)
        .find((candidate) => candidate.startsWith(`${envName}=`));
      const value = line?.slice(envName.length + 1).trim();
      if (value) return value;
    } catch {
      // Fall through to the process environment for hosted deployments.
    }
  }

  return process.env[envName]?.trim() || null;
}
