CREATE TABLE users (
    id BINARY(16) NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(254) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'CUSTOMER',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),

    UNIQUE KEY uq_users_email (email),

    CONSTRAINT chk_users_role
        CHECK (role IN ('CUSTOMER', 'SELLER', 'ADMIN'))
);


CREATE TABLE seller_applications (
    id BINARY(16) NOT NULL,
    user_id BINARY(16) NOT NULL,

    shop_name VARCHAR(120) NOT NULL,
    description TEXT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',

    reviewed_by BINARY(16) NULL,
    reviewed_at TIMESTAMP(6) NULL,
    rejection_reason VARCHAR(500) NULL,

    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),

    KEY idx_seller_applications_user_id (user_id),
    KEY idx_seller_applications_status (status),
    KEY idx_seller_applications_reviewed_by (reviewed_by),

    CONSTRAINT fk_seller_applications_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_seller_applications_reviewer
        FOREIGN KEY (reviewed_by)
        REFERENCES users (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_seller_applications_status
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'))
);


CREATE TABLE seller_profiles (
    id BINARY(16) NOT NULL,
    user_id BINARY(16) NOT NULL,

    shop_name VARCHAR(120) NOT NULL,
    commission_rate DECIMAL(5,2) NOT NULL DEFAULT 20.00,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    approved_at TIMESTAMP(6) NULL,
    suspended_at TIMESTAMP(6) NULL,

    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),

    UNIQUE KEY uq_seller_profiles_user_id (user_id),
    KEY idx_seller_profiles_status (status),

    CONSTRAINT fk_seller_profiles_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_seller_profiles_commission
        CHECK (
            commission_rate >= 0.00
            AND commission_rate <= 100.00
        ),

    CONSTRAINT chk_seller_profiles_status
        CHECK (status IN ('ACTIVE', 'SUSPENDED'))
);


CREATE TABLE brands (
    id BINARY(16) NOT NULL,

    name VARCHAR(120) NOT NULL,
    slug VARCHAR(140) NOT NULL,
    description TEXT NULL,
    logo_url VARCHAR(2048) NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),

    UNIQUE KEY uq_brands_name (name),
    UNIQUE KEY uq_brands_slug (slug),
    KEY idx_brands_active (is_active)
);


CREATE TABLE categories (
    id BINARY(16) NOT NULL,

    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL,
    description TEXT NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),

    UNIQUE KEY uq_categories_name (name),
    UNIQUE KEY uq_categories_slug (slug),
    KEY idx_categories_active (is_active)
);


CREATE TABLE products (
    id BINARY(16) NOT NULL,
    seller_id BINARY(16) NOT NULL,
    brand_id BINARY(16) NOT NULL,
    category_id BINARY(16) NOT NULL,

    name VARCHAR(200) NOT NULL,
    slug VARCHAR(220) NOT NULL,
    description TEXT NULL,

    price DECIMAL(10,2) NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',

    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),

    UNIQUE KEY uq_products_slug (slug),

    KEY idx_products_seller_id (seller_id),
    KEY idx_products_brand_id (brand_id),
    KEY idx_products_category_id (category_id),
    KEY idx_products_status (status),

    CONSTRAINT fk_products_seller
        FOREIGN KEY (seller_id)
        REFERENCES seller_profiles (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_products_brand
        FOREIGN KEY (brand_id)
        REFERENCES brands (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_products_category
        FOREIGN KEY (category_id)
        REFERENCES categories (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_products_price
        CHECK (price >= 0.00),

    CONSTRAINT chk_products_status
        CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED'))
);


CREATE TABLE product_images (
    id BINARY(16) NOT NULL,
    product_id BINARY(16) NOT NULL,

    image_url VARCHAR(2048) NOT NULL,
    alt_text VARCHAR(255) NULL,

    sort_order INT UNSIGNED NOT NULL DEFAULT 0,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),

    KEY idx_product_images_product_id (product_id),
    KEY idx_product_images_sort_order (product_id, sort_order),

    CONSTRAINT fk_product_images_product
        FOREIGN KEY (product_id)
        REFERENCES products (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_product_images_sort_order
        CHECK (sort_order >= 0)
);


CREATE TABLE product_inventory (
    id BINARY(16) NOT NULL,
    product_id BINARY(16) NOT NULL,

    quantity INT UNSIGNED NOT NULL DEFAULT 0,
    reserved_quantity INT UNSIGNED NOT NULL DEFAULT 0,

    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),

    UNIQUE KEY uq_product_inventory_product_id (product_id),

    CONSTRAINT fk_product_inventory_product
        FOREIGN KEY (product_id)
        REFERENCES products (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_product_inventory_reserved
        CHECK (reserved_quantity <= quantity)
);


CREATE TABLE product_variants (
    id BINARY(16) NOT NULL,
    product_id BINARY(16) NOT NULL,

    sku VARCHAR(100) NOT NULL,
    variant_name VARCHAR(150) NOT NULL,

    price DECIMAL(12,2) NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),

    UNIQUE KEY uq_product_variants_sku (sku),

    KEY idx_product_variants_product_id (product_id),
    KEY idx_product_variants_active (is_active),

    CONSTRAINT fk_product_variants_product
        FOREIGN KEY (product_id)
        REFERENCES products (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_product_variants_price
        CHECK (price IS NULL OR price >= 0.00)
);


CREATE TABLE variant_inventory (
    id BINARY(16) NOT NULL,
    variant_id BINARY(16) NOT NULL,

    quantity INT UNSIGNED NOT NULL DEFAULT 0,
    reserved_quantity INT UNSIGNED NOT NULL DEFAULT 0,

    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),

    UNIQUE KEY uq_variant_inventory_variant_id (variant_id),

    CONSTRAINT fk_variant_inventory_variant
        FOREIGN KEY (variant_id)
        REFERENCES product_variants (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_variant_inventory_reserved
        CHECK (reserved_quantity <= quantity)
);


CREATE TABLE orders (
    id BINARY(16) NOT NULL,
    user_id BINARY(16) NOT NULL,

    customer_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',

    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,

    currency CHAR(3) NOT NULL DEFAULT 'INR',

    payment_method VARCHAR(20) NOT NULL DEFAULT 'COD',
    payment_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',

    delivery_location VARCHAR(255) NOT NULL
        DEFAULT 'Square One, Chitkara University',

    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),

    KEY idx_orders_user_id (user_id),
    KEY idx_orders_status (status),
    KEY idx_orders_created_at (created_at),

    CONSTRAINT fk_orders_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_orders_status
        CHECK (
            status IN (
                'PENDING',
                'CONFIRMED',
                'PROCESSING',
                'COMPLETED',
                'CANCELLED',
                'FAILED'
            )
        ),

    CONSTRAINT chk_orders_subtotal
        CHECK (subtotal >= 0.00),

    CONSTRAINT chk_orders_total
        CHECK (total_amount >= 0.00)
);


CREATE TABLE order_items (
    id BINARY(16) NOT NULL,
    order_id BINARY(16) NOT NULL,
    product_id BINARY(16) NOT NULL,
    seller_id BINARY(16) NOT NULL,

    product_name VARCHAR(200) NOT NULL,

    quantity INT UNSIGNED NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    line_total DECIMAL(12,2) NOT NULL,

    fulfillment_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    seller_ready_at TIMESTAMP(6) NULL,

    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),

    KEY idx_order_items_order_id (order_id),
    KEY idx_order_items_product_id (product_id),
    KEY idx_order_items_seller_id (seller_id),

    CONSTRAINT fk_order_items_order
        FOREIGN KEY (order_id)
        REFERENCES orders (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_order_items_product
        FOREIGN KEY (product_id)
        REFERENCES products (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_order_items_seller
        FOREIGN KEY (seller_id)
        REFERENCES seller_profiles (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_order_items_quantity
        CHECK (quantity > 0),

    CONSTRAINT chk_order_items_unit_price
        CHECK (unit_price >= 0.00),

    CONSTRAINT chk_order_items_line_total
        CHECK (line_total >= 0.00)
);


CREATE TABLE seller_orders (
    id BINARY(16) NOT NULL,
    order_id BINARY(16) NOT NULL,
    seller_id BINARY(16) NOT NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',

    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    commission_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    seller_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,

    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),

    UNIQUE KEY uq_seller_orders_order_seller (order_id, seller_id),

    KEY idx_seller_orders_order_id (order_id),
    KEY idx_seller_orders_seller_id (seller_id),
    KEY idx_seller_orders_status (status),

    CONSTRAINT fk_seller_orders_order
        FOREIGN KEY (order_id)
        REFERENCES orders (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_seller_orders_seller
        FOREIGN KEY (seller_id)
        REFERENCES seller_profiles (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_seller_orders_status
        CHECK (
            status IN (
                'PENDING',
                'CONFIRMED',
                'PROCESSING',
                'SHIPPED',
                'COMPLETED',
                'CANCELLED'
            )
        ),

    CONSTRAINT chk_seller_orders_subtotal
        CHECK (subtotal >= 0.00),

    CONSTRAINT chk_seller_orders_commission
        CHECK (commission_amount >= 0.00),

    CONSTRAINT chk_seller_orders_seller_amount
        CHECK (seller_amount >= 0.00)
);


CREATE TABLE seller_order_items (
    id BINARY(16) NOT NULL,
    seller_order_id BINARY(16) NOT NULL,
    order_item_id BINARY(16) NOT NULL,

    quantity INT UNSIGNED NOT NULL,

    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),

    UNIQUE KEY uq_seller_order_items_order_item (order_item_id),

    KEY idx_seller_order_items_seller_order_id (seller_order_id),

    CONSTRAINT fk_seller_order_items_seller_order
        FOREIGN KEY (seller_order_id)
        REFERENCES seller_orders (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_seller_order_items_order_item
        FOREIGN KEY (order_item_id)
        REFERENCES order_items (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_seller_order_items_quantity
        CHECK (quantity > 0)
);


CREATE TABLE payments (
    id BINARY(16) NOT NULL,
    order_id BINARY(16) NOT NULL,

    payment_method VARCHAR(20) NOT NULL DEFAULT 'COD',
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',

    amount DECIMAL(12,2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'INR',

    paid_at TIMESTAMP(6) NULL,

    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),

    UNIQUE KEY uq_payments_order_id (order_id),

    KEY idx_payments_status (status),

    CONSTRAINT fk_payments_order
        FOREIGN KEY (order_id)
        REFERENCES orders (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_payments_method
        CHECK (payment_method = 'COD'),

    CONSTRAINT chk_payments_status
        CHECK (
            status IN (
                'PENDING',
                'PAID',
                'CANCELLED'
            )
        ),

    CONSTRAINT chk_payments_amount
        CHECK (amount > 0.00)
);


CREATE TABLE commissions (
    id BINARY(16) NOT NULL,
    seller_order_id BINARY(16) NOT NULL,

    commission_rate DECIMAL(5,2) NOT NULL DEFAULT 20.00,
    commission_amount DECIMAL(12,2) NOT NULL,
    seller_amount DECIMAL(12,2) NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',

    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),

    UNIQUE KEY uq_commissions_seller_order_id (seller_order_id),

    KEY idx_commissions_status (status),

    CONSTRAINT fk_commissions_seller_order
        FOREIGN KEY (seller_order_id)
        REFERENCES seller_orders (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_commissions_rate
        CHECK (
            commission_rate >= 0.00
            AND commission_rate <= 100.00
        ),

    CONSTRAINT chk_commissions_amount
        CHECK (commission_amount >= 0.00),

    CONSTRAINT chk_commissions_seller_amount
        CHECK (seller_amount >= 0.00),

    CONSTRAINT chk_commissions_status
        CHECK (
            status IN (
                'PENDING',
                'EARNED',
                'REVERSED'
            )
        )
);


CREATE TABLE order_status_history (
    id BINARY(16) NOT NULL,
    order_id BINARY(16) NOT NULL,

    status VARCHAR(30) NOT NULL,
    changed_by BINARY(16) NULL,

    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),

    KEY idx_order_status_history_order_id (order_id),
    KEY idx_order_status_history_changed_by (changed_by),
    KEY idx_order_status_history_created_at (created_at),

    CONSTRAINT fk_order_status_history_order
        FOREIGN KEY (order_id)
        REFERENCES orders (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_order_status_history_user
        FOREIGN KEY (changed_by)
        REFERENCES users (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_order_status_history_status
        CHECK (
            status IN (
                'PENDING',
                'CONFIRMED',
                'PROCESSING',
                'COMPLETED',
                'CANCELLED',
                'FAILED'
            )
        )
);


CREATE TABLE inventory_movements (
    id BINARY(16) NOT NULL,
    product_id BINARY(16) NOT NULL,

    movement_type VARCHAR(30) NOT NULL,
    quantity INT NOT NULL,

    reference_type VARCHAR(30) NULL,
    reference_id BINARY(16) NULL,

    note VARCHAR(500) NULL,

    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),

    KEY idx_inventory_movements_product_id (product_id),
    KEY idx_inventory_movements_type (movement_type),
    KEY idx_inventory_movements_reference (reference_type, reference_id),
    KEY idx_inventory_movements_created_at (created_at),

    CONSTRAINT fk_inventory_movements_product
        FOREIGN KEY (product_id)
        REFERENCES products (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_inventory_movements_quantity
        CHECK (quantity <> 0),

    CONSTRAINT chk_inventory_movements_type
        CHECK (
            movement_type IN (
                'STOCK_IN',
                'SALE',
                'RESERVATION',
                'RELEASE',
                'ADJUSTMENT',
                'RETURN'
            )
        )
);


CREATE TABLE audit_logs (
    id BINARY(16) NOT NULL,

    user_id BINARY(16) NULL,

    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id BINARY(16) NULL,

    details JSON NULL,

    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),

    KEY idx_audit_logs_user_id (user_id),
    KEY idx_audit_logs_entity (entity_type, entity_id),
    KEY idx_audit_logs_action (action),
    KEY idx_audit_logs_created_at (created_at),

    CONSTRAINT fk_audit_logs_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
);


CREATE TABLE seller_application_history (
    id BINARY(16) NOT NULL,
    application_id BINARY(16) NOT NULL,

    status VARCHAR(20) NOT NULL,
    changed_by BINARY(16) NULL,

    rejection_reason VARCHAR(500) NULL,

    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),

    KEY idx_seller_application_history_application_id (application_id),
    KEY idx_seller_application_history_changed_by (changed_by),
    KEY idx_seller_application_history_created_at (created_at),

    CONSTRAINT fk_seller_application_history_application
        FOREIGN KEY (application_id)
        REFERENCES seller_applications (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_seller_application_history_user
        FOREIGN KEY (changed_by)
        REFERENCES users (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_seller_application_history_status
        CHECK (
            status IN (
                'PENDING',
                'APPROVED',
                'REJECTED'
            )
        )
);


CREATE TABLE seller_payouts (
    id BINARY(16) NOT NULL,
    seller_order_id BINARY(16) NOT NULL,
    seller_id BINARY(16) NOT NULL,

    gross_amount DECIMAL(12,2) NOT NULL,
    commission_amount DECIMAL(12,2) NOT NULL,
    net_amount DECIMAL(12,2) NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',

    paid_at TIMESTAMP(6) NULL,

    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),

    UNIQUE KEY uq_seller_payouts_seller_order (seller_order_id),

    KEY idx_seller_payouts_seller_id (seller_id),
    KEY idx_seller_payouts_status (status),

    CONSTRAINT fk_seller_payouts_seller_order
        FOREIGN KEY (seller_order_id)
        REFERENCES seller_orders (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_seller_payouts_seller
        FOREIGN KEY (seller_id)
        REFERENCES seller_profiles (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_seller_payouts_gross
        CHECK (gross_amount >= 0.00),

    CONSTRAINT chk_seller_payouts_commission
        CHECK (commission_amount >= 0.00),

    CONSTRAINT chk_seller_payouts_net
        CHECK (net_amount >= 0.00),

    CONSTRAINT chk_seller_payouts_status
        CHECK (
            status IN (
                'PENDING',
                'ELIGIBLE',
                'PAID',
                'CANCELLED'
            )
        )
);