
-- ============================================================
-- 006_product_reviews.sql
-- Product reviews with verified purchases and delivery windows
-- ============================================================

-- Record when each individual order item is delivered.
-- The delivery handler must populate this timestamp when the
-- item transitions to DELIVERED.
ALTER TABLE order_items
    ADD COLUMN delivered_at TIMESTAMP(6) NULL
    AFTER seller_ready_at;

CREATE INDEX idx_order_items_delivered_at
    ON order_items (delivered_at);

-- One review per customer per product.
-- One review per order item.
CREATE TABLE product_reviews (
    id BINARY(16) NOT NULL,
    product_id BINARY(16) NOT NULL,
    user_id BINARY(16) NOT NULL,
    order_item_id BINARY(16) NOT NULL,

    rating TINYINT UNSIGNED NOT NULL,
    review_text VARCHAR(2000) NULL,

    created_at TIMESTAMP(6) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),

    UNIQUE KEY uq_product_reviews_user_product
        (user_id, product_id),

    UNIQUE KEY uq_product_reviews_order_item
        (order_item_id),

    KEY idx_product_reviews_product_created
        (product_id, created_at),

    KEY idx_product_reviews_product_rating
        (product_id, rating),

    CONSTRAINT fk_product_reviews_product
        FOREIGN KEY (product_id)
        REFERENCES products (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,

    CONSTRAINT fk_product_reviews_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,

    CONSTRAINT fk_product_reviews_order_item
        FOREIGN KEY (order_item_id)
        REFERENCES order_items (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,

    CONSTRAINT chk_product_reviews_rating
        CHECK (rating BETWEEN 1 AND 5),

    CONSTRAINT chk_product_reviews_text
        CHECK (
            review_text IS NULL
            OR CHAR_LENGTH(review_text) <= 2000
        )
);

-- Optional images attached to reviews.
CREATE TABLE product_review_images (
    id BINARY(16) NOT NULL,
    review_id BINARY(16) NOT NULL,
    image_url VARCHAR(2048) NOT NULL,
    sort_order TINYINT UNSIGNED NOT NULL DEFAULT 0,

    created_at TIMESTAMP(6) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),

    KEY idx_product_review_images_review
        (review_id, sort_order),

    CONSTRAINT fk_product_review_images_review
        FOREIGN KEY (review_id)
        REFERENCES product_reviews (id)
        ON UPDATE RESTRICT ON DELETE CASCADE,

    CONSTRAINT chk_product_review_images_sort_order
        CHECK (sort_order < 5)
);
