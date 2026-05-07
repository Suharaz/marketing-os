-- Migration 006: Add password_hash column to team_member
-- Up migration

ALTER TABLE team_member
  ADD COLUMN IF NOT EXISTS password_hash TEXT;
