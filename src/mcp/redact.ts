// PII redaction helpers — allowlist approach (KHÔNG blacklist).
// Return chỉ các field whitelist để tránh vô tình expose field mới khi schema mở rộng.

import type { ChannelListItem } from '@/lib/queries/channels-list';

/**
 * Redact channel list item — hiện không chứa PII (PII đã filter ở SQL level).
 * Đây là pass-through allowlist explicit để defense-in-depth.
 */
export function redactChannelListItem(c: ChannelListItem): ChannelListItem {
  return {
    id: c.id,
    externalId: c.externalId,
    name: c.name,
    platform: c.platform,
    status: c.status,
    lastSyncedAt: c.lastSyncedAt,
    followers: c.followers,
    healthScore: c.healthScore,
    reach7d: c.reach7d,
    avgEngagementRate: c.avgEngagementRate,
    ownerName: c.ownerName,
    lead30d: c.lead30d,
  };
}

/**
 * Redact full channel detail — strip persona_json + access_token_encrypted (KHÔNG bao giờ ra ngoài).
 * Owner email được giữ vì MCP nội bộ admin (user decision 2026-05-19).
 */
export function redactChannelDetail<T extends Record<string, unknown>>(c: T): Omit<T, 'access_token_encrypted' | 'accessTokenEncrypted' | 'personaJson' | 'persona_json'> {
  const { access_token_encrypted: _t1, accessTokenEncrypted: _t2, personaJson: _p1, persona_json: _p2, ...safe } = c as Record<string, unknown>;
  void _t1; void _t2; void _p1; void _p2;
  return safe as Omit<T, 'access_token_encrypted' | 'accessTokenEncrypted' | 'personaJson' | 'persona_json'>;
}
