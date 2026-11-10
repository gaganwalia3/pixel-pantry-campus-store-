CREATE TABLE auth_identities (
    id BINARY(16) NOT NULL,
    user_id BINARY(16) NOT NULL,

    provider VARCHAR(30) NOT NULL,
    provider_subject VARCHAR(255) NOT NULL,
    provider_email VARCHAR(254) NOT NULL,

    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),

    UNIQUE KEY uq_auth_identity_provider_subject (
        provider,
        provider_subject
    ),

    UNIQUE KEY uq_auth_identity_user_provider (
        user_id,
        provider
    ),

    KEY idx_auth_identity_user_id (user_id),

    CONSTRAINT fk_auth_identity_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE,

    CONSTRAINT chk_auth_identity_provider
        CHECK (provider IN ('GOOGLE'))
);