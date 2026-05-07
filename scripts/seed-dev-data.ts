/**
 * seed-dev-data.ts
 * Populates the database with realistic dev/test data.
 * Run via: npm run db:seed
 *
 * Data created:
 *   - 1 admin team_member
 *   - 5 FB social_account (TAKI pages)
 *   - 20 social_post per account (100 total)
 *   - 30 days of post_metric_daily per post (3 000 rows)
 *   - 30 days of account_metric_daily per account (150 rows)
 *   - 5 alert rows
 */

import 'dotenv/config';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

// ─── Config ───────────────────────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@taki.vn';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'Admin@123456';

const pool = new Pool({ connectionString: DATABASE_URL, max: 5 });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Date N days ago from now */
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

/** Random date within last 30 days */
function randomPastDate(): Date {
  return daysAgo(randInt(0, 29));
}

// ─── Seed data definitions ────────────────────────────────────────────────────

const FB_ACCOUNTS = [
  { external_id: 'fb_page_001', name: 'TAKI Travel', category: 'Travel' },
  { external_id: 'fb_page_002', name: 'TAKI Food', category: 'Food & Beverage' },
  { external_id: 'fb_page_003', name: 'TAKI Lifestyle', category: 'Lifestyle' },
  { external_id: 'fb_page_004', name: 'TAKI Education', category: 'Education' },
  { external_id: 'fb_page_005', name: 'TAKI Tech', category: 'Technology' },
];

const POST_TYPES = ['photo', 'video', 'reel', 'status', 'link'] as const;
const ALERT_TYPES = ['low_reach', 'token_expiring', 'er_drop', 'sync_failed', 'milestone'] as const;

const SAMPLE_CONTENT = [
  'Khám phá vẻ đẹp bốn mùa cùng TAKI! ✈️',
  'Món ngon mỗi ngày — thử ngay hôm nay!',
  'Sống khỏe, sống vui cùng TAKI Lifestyle.',
  'Học gì hôm nay? TAKI Education đồng hành cùng bạn.',
  'Công nghệ thay đổi cuộc sống — TAKI Tech cập nhật 24/7.',
  'Ưu đãi đặc biệt cuối tuần, đừng bỏ lỡ!',
  'Hành trình mới bắt đầu từ đây...',
  'Cảm ơn 100K fans đã đồng hành!',
  'Live stream tối nay lúc 8PM — tham gia ngay!',
  'Review thật, trải nghiệm thật từ cộng đồng TAKI.',
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Clear existing seed data (idempotent)
    await client.query(`DELETE FROM alert`);
    await client.query(`DELETE FROM account_metric_daily`);
    await client.query(`DELETE FROM post_metric_daily`);
    await client.query(`DELETE FROM social_post`);
    await client.query(`DELETE FROM social_account`);
    await client.query(`DELETE FROM team_member`);

    // 2. Admin team member
    // Use pre-generated hash from env if available, else hash ADMIN_PASSWORD at seed time
    let passwordHash: string;
    if (process.env.ADMIN_PASSWORD_HASH) {
      passwordHash = process.env.ADMIN_PASSWORD_HASH;
    } else {
      passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
      console.log(`Generated password hash (store in ADMIN_PASSWORD_HASH): ${passwordHash}`);
    }

    const memberRes = await client.query<{ id: string }>(
      `INSERT INTO team_member (email, name, role, password_hash)
       VALUES ($1, $2, 'admin', $3)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash
       RETURNING id`,
      [ADMIN_EMAIL, 'TAKI Admin', passwordHash],
    );
    const adminId = memberRes.rows[0]?.id;
    if (!adminId) throw new Error('Failed to insert admin team member');

    console.log(`Admin created: ${ADMIN_EMAIL} (hash: ${passwordHash.slice(0, 20)}...)`);

    // 3. Social accounts
    const accountIds: string[] = [];
    for (const acc of FB_ACCOUNTS) {
      const res = await client.query<{ id: string }>(
        `INSERT INTO social_account
           (platform, external_id, name, persona_json, status, owner_member_id)
         VALUES ('facebook', $1, $2, $3, 'active', $4)
         RETURNING id`,
        [
          acc.external_id,
          acc.name,
          JSON.stringify({ category: acc.category, language: 'vi', country: 'VN' }),
          adminId,
        ],
      );
      const accountId = res.rows[0]?.id;
      if (!accountId) throw new Error(`Failed to insert account ${acc.name}`);
      accountIds.push(accountId);
    }
    console.log(`Created ${accountIds.length} social accounts`);

    // 4. Posts + metrics
    let totalPosts = 0;
    let totalMetrics = 0;

    for (const accountId of accountIds) {
      const postIds: string[] = [];

      // 20 posts per account
      for (let i = 0; i < 20; i++) {
        const postType = POST_TYPES[i % POST_TYPES.length] ?? 'status';
        const content = SAMPLE_CONTENT[i % SAMPLE_CONTENT.length] ?? '';
        const publishedAt = randomPastDate();

        const res = await client.query<{ id: string }>(
          `INSERT INTO social_post
             (account_id, external_id, content, post_type, published_at, permalink)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [
            accountId,
            `ext_post_${accountId.slice(0, 8)}_${i}`,
            content,
            postType,
            publishedAt,
            `https://www.facebook.com/permalink/${accountId.slice(0, 8)}/${i}`,
          ],
        );
        const postId = res.rows[0]?.id;
        if (!postId) throw new Error('Failed to insert post');
        postIds.push(postId);
        totalPosts++;
      }

      // 30 days of daily metrics per post
      for (const postId of postIds) {
        // Simulate realistic distribution: a few viral posts, most average
        const isViral = Math.random() < 0.1;
        const baseReach = isViral ? randInt(20_000, 50_000) : randInt(1_000, 8_000);

        for (let day = 0; day < 30; day++) {
          const metricDate = daysAgo(29 - day);
          const dateStr = metricDate.toISOString().split('T')[0];

          // Decay reach over time (older = less reach delta)
          const reach = Math.max(0, baseReach - day * randInt(10, 200));
          const reactions = Math.floor(reach * (randInt(1, 8) / 100));
          const comments = Math.floor(reactions * 0.15);
          const shares = Math.floor(reactions * 0.08);
          const impressions = Math.floor(reach * randInt(110, 150) / 100);
          const clicks = Math.floor(reach * (randInt(1, 5) / 100));
          const videoViews = Math.floor(reach * (randInt(20, 60) / 100));

          await client.query(
            `INSERT INTO post_metric_daily
               (post_id, date, reactions, comments, shares, reach,
                impressions, clicks, video_views, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
             ON CONFLICT (post_id, date) DO UPDATE SET
               reactions = EXCLUDED.reactions,
               comments  = EXCLUDED.comments,
               shares    = EXCLUDED.shares,
               reach     = EXCLUDED.reach,
               impressions = EXCLUDED.impressions,
               clicks    = EXCLUDED.clicks,
               video_views = EXCLUDED.video_views,
               updated_at = NOW()`,
            [postId, dateStr, reactions, comments, shares, reach,
             impressions, clicks, videoViews],
          );
          totalMetrics++;
        }
      }

      // 5. Account daily metrics (30 days)
      let followers = randInt(10_000, 80_000);
      for (let day = 0; day < 30; day++) {
        const metricDate = daysAgo(29 - day);
        const dateStr = metricDate.toISOString().split('T')[0];
        const growth = randInt(-50, 300);
        followers = Math.max(0, followers + growth);
        const totalReach = randInt(5_000, 40_000);
        const totalEngagement = Math.floor(totalReach * (randInt(2, 8) / 100));

        await client.query(
          `INSERT INTO account_metric_daily
             (account_id, date, followers, follower_growth, posts_count,
              total_reach, total_engagement, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
           ON CONFLICT (account_id, date) DO UPDATE SET
             followers = EXCLUDED.followers,
             follower_growth = EXCLUDED.follower_growth,
             posts_count = EXCLUDED.posts_count,
             total_reach = EXCLUDED.total_reach,
             total_engagement = EXCLUDED.total_engagement,
             updated_at = NOW()`,
          [accountId, dateStr, followers, growth, randInt(0, 3),
           totalReach, totalEngagement],
        );
      }
    }

    console.log(`Created ${totalPosts} posts, ${totalMetrics} daily metric rows`);

    // 6. Sample alerts
    const alertSamples = [
      { severity: 'warning', type: 'er_drop',
        title: 'ER giảm mạnh', message: 'TAKI Travel ER giảm 40% so với tuần trước' },
      { severity: 'critical', type: 'token_expiring',
        title: 'Token sắp hết hạn', message: 'Access token của TAKI Food sẽ hết hạn sau 3 ngày' },
      { severity: 'info', type: 'milestone',
        title: 'Đạt 50K followers', message: 'TAKI Lifestyle vừa đạt mốc 50.000 followers!' },
      { severity: 'warning', type: 'low_reach',
        title: 'Reach thấp bất thường', message: '5 bài đăng gần nhất của TAKI Tech có reach < 500' },
      { severity: 'info', type: 'sync_failed',
        title: 'Đồng bộ thất bại', message: 'Lần đồng bộ 02:00 thất bại, sẽ thử lại sau 1 giờ' },
    ] as const;

    for (const a of alertSamples) {
      await client.query(
        `INSERT INTO alert (severity, type, title, message, is_read)
         VALUES ($1, $2, $3, $4, false)`,
        [a.severity, a.type, a.title, a.message],
      );
    }
    console.log(`Created ${alertSamples.length} sample alerts`);

    await client.query('COMMIT');
    console.log('Seed completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed, rolled back:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
