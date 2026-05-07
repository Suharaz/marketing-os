-- Migration 001: Extensions and Enums
-- Up migration

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE platform_t AS ENUM (
    'facebook',
    'tiktok',
    'youtube',
    'instagram',
    'threads',
    'zalo'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE account_status_t AS ENUM (
    'active',
    'token_expired',
    'disconnected'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE post_type_t AS ENUM (
    'photo',
    'video',
    'reel',
    'status',
    'link'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE severity_t AS ENUM (
    'info',
    'warning',
    'critical'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sync_type_t AS ENUM (
    'page_insights',
    'posts',
    'health_recompute',
    'manual_refresh'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
