-- Migration 010: Extend post_type_t with album/sticker/share
-- Up migration
--
-- FB Graph attachment.media_type returns 6 values: photo, album, video_inline,
-- link, sticker, share. video_inline maps to existing 'video'; reel still
-- detected via permalink URL match. The other 3 had no enum value before — add
-- them so we can persist the original media_type instead of squashing to status.

ALTER TYPE post_type_t ADD VALUE IF NOT EXISTS 'album';
ALTER TYPE post_type_t ADD VALUE IF NOT EXISTS 'sticker';
ALTER TYPE post_type_t ADD VALUE IF NOT EXISTS 'share';
