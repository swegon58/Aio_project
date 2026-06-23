// Canonical platform list for the "Connections" tab (Batch B).
//
// Source of truth: Aio_harness/hermes-agent/gateway/config.py
// `_token_env_names` (validate_and_sanitize_config) — the set of platforms
// Hermes itself treats as gated by a single bot/access token env var.
// Discord is plugin-registered (plugins/platforms/discord/plugin.yaml
// `requires_env: DISCORD_BOT_TOKEN`) but uses the same single-token shape,
// so it's included too.
//
// Deliberately excluded: WhatsApp (Baileys QR-pairing, no static token),
// WhatsApp Cloud / Signal / Email / SMS / DingTalk / Feishu / WeCom / etc.
// — these need multiple env vars or non-token setup (webhook URLs, IMAP/SMTP
// creds, OAuth-style app IDs) and don't fit the single
// "paste a token" flow this batch scopes to.
export interface PlatformDef {
  id: string;
  label: string;
  tokenEnvVar: string;
}

export const KNOWN_PLATFORMS: PlatformDef[] = [
  { id: "telegram", label: "Telegram", tokenEnvVar: "TELEGRAM_BOT_TOKEN" },
  { id: "discord", label: "Discord", tokenEnvVar: "DISCORD_BOT_TOKEN" },
  { id: "slack", label: "Slack", tokenEnvVar: "SLACK_BOT_TOKEN" },
  { id: "mattermost", label: "Mattermost", tokenEnvVar: "MATTERMOST_TOKEN" },
  { id: "matrix", label: "Matrix", tokenEnvVar: "MATRIX_ACCESS_TOKEN" },
  { id: "weixin", label: "WeiXin", tokenEnvVar: "WEIXIN_TOKEN" },
];

export function findPlatform(id: string): PlatformDef | undefined {
  return KNOWN_PLATFORMS.find((p) => p.id === id);
}
