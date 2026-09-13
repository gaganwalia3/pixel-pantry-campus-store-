CREATE TABLE checkout_idempotency (
    id BINARY(16) NOT NULL,

    user_id BINARY(16) NOT NULL,

    idempotency_key VARCHAR(128) NOT NULL,

    request_hash CHAR(64) NOT NULL,

    order_id BINARY(16) NULL,

    created_at TIMESTAMP(6) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),

    UNIQUE KEY uq_checkout_idempotency_user_key (
        user_id,
        idempotency_key
    ),

    UNIQUE KEY uq_checkout_idempotency_order (
        order_id
    ),

    KEY idx_checkout_idempotency_created_at (
        created_at
    ),

    CONSTRAINT fk_checkout_idempotency_user
        FOREIGN KEY (user_id)
        REFERENCES users(id),

    CONSTRAINT fk_checkout_idempotency_order
        FOREIGN KEY (order_id)
        REFERENCES orders(id)
);