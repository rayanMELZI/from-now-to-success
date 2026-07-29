-- Auto-filed GitHub issues for feedback the AI judges worth building.
--   ai_worth_doing   the model's build/skip decision (null until briefed)
--   ai_issue_title   short imperative title for the issue (encrypted: it can
--                    restate the sensitive request, like ai_summary)
--   github_issue_url set once an issue exists; also the dedup guard so a row
--                    is never filed twice (auto or via the manual promote link)
ALTER TABLE feedback ADD COLUMN ai_worth_doing  BOOLEAN;
ALTER TABLE feedback ADD COLUMN ai_issue_title   TEXT;
ALTER TABLE feedback ADD COLUMN github_issue_url TEXT;
