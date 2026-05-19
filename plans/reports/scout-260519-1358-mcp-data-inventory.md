# MCP Data Inventory - Channels and Posts (Read-Only)

Scope: scout schema + existing query funcs feeding a read-only MCP server for channels and posts domains.

## Tables

### Core domain

| Table | Columns | Purpose |
|---|---|---|
| social_account | id UUID PK, platform (platform_t enum: facebook/tiktok/youtube/instagram/threads/zalo), external_id TEXT, name TEXT, persona_json JSONB, **access_token_encrypted BYTEA**, connected_at, last_synced_at, status (account_status_t: active/token_expired/disconnected), owner_member_id FK to team_member, UNIQUE(platform, external_id) | A connected social channel. One row per page/account. |
| social_post | id UUID PK, account_id FK to social_account CASCADE, external_id TEXT, content TEXT, media_url TEXT, post_type (post_type_t enum: photo/video/reel/status/link/album/sticker/share), published_at TIMESTAMPTZ, permalink TEXT, campaign_tag TEXT, content_tsv tsvector GIN (mig 007) | One published item on a channel. FTS over content. |
| post_metric_daily | PK(post_id, date), reactions, comments, shares, reach, impressions, clicks, video_views, engagement_rate (NUMERIC generated = (react+comm+shares)/reach), updated_at | Per-post per-day snapshot. Latest row per post = current. |
| account_metric_daily | PK(account_id, date), followers, follower_growth, posts_count, total_reach, total_engagement, updated_at + (mig 009) total_reach_unique, total_actions, page_views, post_reactions_total | Per-channel per-day snapshot. Date = PT calendar (FB Insights convention, mig 011). posts_count denormalized - known untrustworthy, recompute from social_post (see dashboard-trend). |
| channel_health_daily | PK(account_id, date), health_score, er_score, consistency_score, growth_score, reach_score, computed_at | Derived per-channel health 0-100 (5 sub-scores). Latest row = current snapshot. |

### Related lookup / auxiliary

| Table | Columns | Purpose |
|---|---|---|
| team_member | id UUID, email UNIQUE, name, role, created_at, **password_hash (mig 006)** | Channel owners (FK target for social_account.owner_member_id). |
| alert | id, severity (info/warning/critical), type, title, message, account_id?, post_id?, is_read, created_at | System alerts linked to a channel/post. |
| api_sync_log | id, sync_type (page_insights/posts/health_recompute/manual_refresh/ladipage), account_id?, started_at, finished_at, status (running/success/failed), records_upserted, error_message, **details JSONB (mig 008 - per-call payload, can be MB-sized)** | Cron + manual sync history per channel. |
| landing_page_conversion (mig 015) | id, account_id FK CASCADE, occurred_date, conversion_count, **raw_response JSONB**, synced_at, UNIQUE(account_id, occurred_date) | Auto-pulled leads from Ladipage via n8n. |
| manual_revenue (mig 016) | id, account_id FK CASCADE, amount_vnd CHECK >=0, occurred_date, note, created_by FK to team_member, created_at | Manually logged revenue, attributed to a channel. |

Enums: platform_t, account_status_t, post_type_t, severity_t, sync_type_t (mig 001 + 010 + 015 extensions).

Indexes (mig 005, 007, 008, 015, 016): idx_post_account_published, idx_post_metric_date, idx_account_metric_date, idx_health_account_date, idx_alert_unread (partial), GIN on persona_json, GIN on content_tsv, idx_api_sync_log_started_at, idx_landing_page_conversion_occurred_date|_account, idx_manual_revenue_occurred_date|_account.

## Existing Queries (src/lib/queries/)

Reusable for MCP tools - channels/posts scope only:

| Function | File | Signature | Purpose |
|---|---|---|---|
| fetchChannelsList(filter) | channels-list.ts | (ChannelsListFilter) -> ChannelListItem[] | List channels w/ platform/status filter + sort (name/health/followers). Joins latest followers, health, 7d reach, 30d avg ER, owner name, 30d leads. Hides disconnected by default. LIMIT 100. |
| fetchChannelsSummary() | channels-list.ts | () -> ChannelsSummary | KPI cards: total / active / avgHealth / byPlatform map. Excludes disconnected. |
| fetchChannel(id) | channel-detail.ts | (uuid) -> ChannelAccount or null | Single channel: account + latest followers/health + owner profile + persona_json + ownerId. |
| fetchMetrics7d(accountId) | channel-detail.ts | (uuid) -> ChannelMetricDay[] | Last 7 days (excl. today) of followers/reach/engagement + posts_count recomputed from social_post (PT date). |
| fetchRecentPosts(accountId, limit=10) | channel-detail.ts | (uuid, num) -> ChannelPost[] | Recent posts of one channel + latest metric snapshot (reactions/comments/shares/views/ER). Orders by published_at DESC. |
| fetchSyncLog(accountId, limit=10) | channel-detail.ts | (uuid, num) -> SyncLogEntry[] | Per-channel sync log (excludes heavy details JSONB; only calls_count). |
| fetchLibraryPosts(filter) | library-posts.ts | (LibraryFilter) -> {posts, nextCursor} | Filtered/sorted posts across all channels (24/page cursor). Filters: q/platform/account/type/date range/tag/sort=recent or er or reach. Joins SUM/AVG metrics. |
| fetchLibraryStats(filter) | library-stats.ts | (LibraryFilter) -> LibraryStats | Counts: total/thisWeek/prevWeek/viral (ER >= 0.05). |
| fetchActiveAccounts() | library-posts.ts | () -> AccountOption[] | id/name/platform of active accounts. |
| fetchChannelHealth() | dashboard-channel-health.ts | () -> ChannelHealthData[] | Latest health (within 7d) + prior-week health per channel, excludes disconnected. |
| fetchTrendData(days) | dashboard-trend.ts | (int) -> TrendDataPoint[] | Cross-channel daily trend N days: reach/engagement/followers/totalPost/conversions. |
| fetchKpiData(days) | dashboard-kpi.ts | (int) -> KpiData | Global KPI current vs prev window: reach, avgEr, conversions, revenue, totalFollowers. Excludes disconnected. |
| fetchTopPerformers(days, limit=5) | dashboard-top-performers.ts | (int,int) -> TopPerformerRow[] | Top team members by engagement (member-centric, not post-centric). |
| fetchUnreadAlerts(limit=10) | alerts.ts | (int) -> AlertData[] | Unread alerts (may link account/post). |
| fetchLastSync() | alerts.ts | () -> LastSyncData | Last successful sync time + platform. |
| fetchCronHistory(filter) | cron-history.ts | (CronHistoryFilter) -> CronHistoryRow[] | Cron runs w/ status, account, recordsUpserted, duration. Excludes heavy details. |
| fetchCronStats() | cron-history.ts | () -> CronStats | 24h success/failed/running + last run timestamps. |
| fetchTeamMembers() | team-members.ts | () -> TeamMemberOption[] | Owner dropdown - id/name/email/role. |

Helpers worth knowing: buildPostsQuery(filter) in src/lib/library/build-posts-query.ts (parameterized SQL builder for posts list with cursor pagination), parseFilterParams(raw) in src/lib/library/parse-filter-params.ts.

Gaps (no existing query):
- Post-by-id detail with full metric history (only list+latest exists).
- Top posts by metric within arbitrary date range (closest: fetchLibraryPosts w/ sort=er or reach + date range - reusable).
- Per-channel metrics trend over arbitrary N (only fixed-7d via fetchMetrics7d and cross-channel via fetchTrendData).
- Channel health snapshot incl. sub-scores (channel_health_daily has er/consistency/growth/reach scores but existing queries only project health_score).

## Proposed MCP Tools (Read-Only)

| Tool | Underlying query | Notes |
|---|---|---|
| list_channels | fetchChannelsList(filter) + fetchChannelsSummary() | Filters: platform, status, sort. Reuse as-is. Consider stripping externalId if exposed externally (currently admin-OK). |
| get_channel | fetchChannel(id) | Single channel. REDACT persona_json if it contains tokens/PII (review needed). Owner block contains email - flag as PII. |
| list_posts | fetchLibraryPosts(filter) (via buildPostsQuery) | Pass account filter to scope by channel; supports date range, sort=recent/er/reach, cursor pagination. Reuse. |
| get_post | needs new query | Fetch one social_post + latest metric snapshot + optional metric history. Pattern from fetchRecentPosts LATERAL JOIN. |
| top_posts | fetchLibraryPosts({sort:er or reach, from, to, ...}) | Already supports top-by-metric with date range. Enforce LIMIT semantically. |
| channel_health | fetchChannel(id) (latest score only) + needs extended query for sub-scores | Existing query projects health_score only; new query selects all 5 scores from channel_health_daily. |
| channel_metrics_trend | fetchMetrics7d (hard-coded 7) -> needs param version fetchMetricsRange(accountId, days) | Trivial generalization of existing func. |

Optional extras worth exposing:
- list_alerts_for_channel - wrap alert table filtered by account_id (no existing func; trivial).
- recent_syncs_for_channel - reuse fetchSyncLog(accountId).

## PII / Sensitive Fields

**MUST redact / never expose:**
- social_account.access_token_encrypted (BYTEA - OAuth token). Never SELECT in MCP queries.
- social_account.persona_json - JSONB free-form; may contain PII or secrets. Audit before exposing; recommend opt-in only.
- team_member.password_hash (mig 006) - bcrypt hash. Existing fetchTeamMembers already excludes; ensure MCP queries do too.
- team_member.email - PII. fetchChannel returns this in owner block. Decide: redact in MCP or scope to admin-only consumer.
- api_sync_log.details - JSONB raw FB API payloads, may contain tokens / IDs / response samples (per code comment, 5-50KB rows). Existing queries already exclude (fetchSyncLog, fetchCronHistory project has_details flag only). Same in MCP.
- landing_page_conversion.raw_response - JSONB raw n8n/Ladipage payload; likely contains lead PII (name/phone/email). Never project; only aggregate conversion_count.

**Lower-risk but worth noting:**
- social_account.external_id - public-ish platform ID (FB Page ID) but reveals ownership. Currently exposed.
- social_account.owner_member_id + owner name - internal team mapping.
- social_post.permalink / content / media_url - public on platform; safe.
- manual_revenue.amount_vnd, note, created_by - financial data, internal only.

Tables to consider EXCLUDING entirely from MCP:
- landing_page_conversion (revenue/lead pipeline - only expose aggregates if needed)
- manual_revenue (financial)
- team_member (auth) - expose only id+name+role if owner display needed
- api_sync_log.details field (always)

## Unresolved Questions

1. Auth scope of MCP consumer: admin-only (full data) or external (must redact owner email, persona_json, financials)?
2. persona_json schema - does it ever hold secrets/tokens, or only public persona settings? Need to grep persona_json writers.
3. get_post history depth - return last N metric snapshots or just latest? Affects payload size.
4. top_posts semantics - top-N global vs top-N per channel? Both? Currently fetchLibraryPosts is global w/ optional account filter.
5. Disconnected channels - should MCP follow existing convention (hide by default) or always include for audit?
6. channel_metrics_trend window cap - UI uses 7d; trend dashboard supports arbitrary N. Set a max (e.g., 90d) to bound query cost?
7. Manual revenue / conversions exposure - out of scope per channels and posts framing, but channel detail KPIs reference them. Confirm exclude.

**Status:** DONE
**Summary:** Inventoried 9 channels/posts-related tables + 17 reusable query funcs across src/lib/queries/. Mapped 7 proposed MCP tools to existing funcs (5 reuse, 2 need new/generalized queries). Flagged 6 sensitive fields requiring redaction.
