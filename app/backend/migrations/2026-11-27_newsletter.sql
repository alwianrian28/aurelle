-- Newsletter: the addresses that asked for the store's emails in the storefront's footer, with the consent they gave.
-- Only adds one table; nothing that exists is changed. Safe to run more than once.
-- The backend runs the same statements on every start (app/db.py, NEWSLETTER_MIGRATION).

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  email           VARCHAR(254) PRIMARY KEY,
  locale          VARCHAR(5)   NOT NULL,
  source          VARCHAR(20)  NOT NULL,
  consent_version VARCHAR(60)  NOT NULL,
  subscribed_at   TIMESTAMPTZ  NOT NULL,
  unsubscribed_at TIMESTAMPTZ
);

ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
