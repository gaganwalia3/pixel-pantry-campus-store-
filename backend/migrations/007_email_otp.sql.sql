ALTER TABLE users
  ADD COLUMN email_verified_at TIMESTAMP(6) NULL DEFAULT NULL;


-- One active OTP challenge per user.
-- challenge_id_hash is SHA-256 of the opaque challenge token sent to the client.
CREATE TABLE auth_email_otp_challenges (
  challenge_id_hash BINARY(32) NOT NULL,
  user_id BINARY(16) NOT NULL,
  purpose ENUM('LOGIN', 'REGISTER') NOT NULL,
  otp_hash BINARY(32) NOT NULL,
  expires_at TIMESTAMP(6) NOT NULL,

  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at TIMESTAMP(6) NOT NULL
    DEFAULT CURRENT_TIMESTAMP(6)
    ON UPDATE CURRENT_TIMESTAMP(6),

  PRIMARY KEY (challenge_id_hash),
  UNIQUE KEY uq_auth_otp_challenge_user (user_id),
  KEY idx_auth_otp_challenge_expiry (expires_at),

  CONSTRAINT fk_auth_otp_challenge_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);


-- Persistent per-user throttling state.
-- This record is not deleted when a challenge expires or is replaced.
CREATE TABLE auth_email_otp_state (
  user_id BINARY(16) NOT NULL,

  failed_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  attempt_window_started_at TIMESTAMP(6) NULL DEFAULT NULL,
  locked_until TIMESTAMP(6) NULL DEFAULT NULL,

  sends_in_window TINYINT UNSIGNED NOT NULL DEFAULT 0,
  send_window_started_at TIMESTAMP(6) NULL DEFAULT NULL,
  last_sent_at TIMESTAMP(6) NULL DEFAULT NULL,

  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at TIMESTAMP(6) NOT NULL
    DEFAULT CURRENT_TIMESTAMP(6)
    ON UPDATE CURRENT_TIMESTAMP(6),

  PRIMARY KEY (user_id),
  KEY idx_auth_otp_state_locked_until (locked_until),

  CONSTRAINT fk_auth_otp_state_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE,

  CONSTRAINT chk_auth_otp_failed_attempts
    CHECK (failed_attempts <= 3),

  CONSTRAINT chk_auth_otp_sends
    CHECK (sends_in_window <= 5)
);