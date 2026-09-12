import React from 'react';

export default function ProductPreviewModal({
    isOpen,
    product,
    onClose,
    onPublish,
}) {
    if (!isOpen || !product) {
        return null;
    }

    const formatPrice = (price) => {
        return `₹${Number(price).toLocaleString(
            'en-IN',
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            },
        )}`;
    };

    return (
        <div
            className="modal show"
            onClick={(event) => {
                if (
                    event.target.classList.contains(
                        'modal',
                    )
                ) {
                    onClose();
                }
            }}
        >
            <div className="modal-card">
                <button
                    className="close"
                    type="button"
                    onClick={onClose}
                    aria-label="Close product preview"
                >
                    ×
                </button>

                <div className="eyebrow">
                    Product preview
                </div>

                <h2>
                    {product.name}
                </h2>

                <div className="seller-product-preview">

                    {/* PRODUCT IMAGE */}
                    {product.image?.imageUrl ? (
                        <div className="seller-product-preview-image">
                            <img
                                src={
                                    product.image
                                        .imageUrl
                                }
                                alt={
                                    product.image
                                        .altText ||
                                    product.name
                                }
                            />
                        </div>
                    ) : (
                        <div className="seller-product-preview-image seller-product-preview-image-empty">
                            <span>
                                No product image
                            </span>
                        </div>
                    )}

                    <div className="seller-product-preview-status">
                        {product.status}
                    </div>

                    <div className="seller-product-preview-price">
                        {formatPrice(
                            product.price,
                        )}
                    </div>

                    <p>
                        {product.description ||
                            'No description added yet.'}
                    </p>

                    <div className="seller-product-preview-meta">
                        <span>
                            CATEGORY
                        </span>

                        <strong>
                            {
                                product.category
                                    ?.name
                            }
                        </strong>
                    </div>

                    <div className="seller-product-preview-meta">
                        <span>
                            BRAND
                        </span>

                        <strong>
                            {
                                product.brand
                                    ?.name
                            }
                        </strong>
                    </div>

                    <div className="seller-product-preview-meta">
                        <span>
                            STOCK
                        </span>

                        <strong>
                            {
                                product
                                    .inventory
                                    ?.availableQuantity
                            }{' '}
                            available
                        </strong>
                    </div>
                </div>

                <div className="seller-product-preview-actions">
                    <button
                        type="button"
                        className="secondary"
                        onClick={onClose}
                    >
                        BACK TO EDIT
                    </button>

                    {product.status ===
                        'DRAFT' && (
                            <button
                                type="button"
                                className="primary"
                                onClick={
                                    onPublish
                                }
                            >
                                PUBLISH PRODUCT →
                            </button>
                        )}
                </div>
            </div>
        </div>
    );
}