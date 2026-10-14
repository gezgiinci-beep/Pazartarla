CREATE TABLE IF NOT EXISTS auth_action_limits (
  action TEXT NOT NULL CHECK (
    action IN (
      'signup',
      'resend_verification',
      'request_password_reset',
      'verify_email',
      'reset_password'
    )
  ),
  subject_hash TEXT NOT NULL,
  window_started_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL CHECK (attempts > 0),
  PRIMARY KEY (action, subject_hash)
);

CREATE INDEX IF NOT EXISTS auth_action_limits_window_idx
  ON auth_action_limits(window_started_at);
