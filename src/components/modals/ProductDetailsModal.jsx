
import React, { useEffect } from 'react';

export default function ProductDetailsModal({
    product,
    onClose,
    onAddToCart,
}) {
    useEffect(() => {
        if (!product) return undefined;

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener(
            'keydown',
            handleKeyDown,
        );

        return () => {
            window.removeEventListener(
                'keydown',
                handleKeyDown,
            );
        };
    }, [product, onClose]);

    if (!product) return null;

    const price = Number(product.price);

    const formattedPrice =
        Number.isFinite(price)
            ? '₹' + price.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            })
            : 'Price unavailable';

    const sellerName =
        product.seller?.shopName ||
        'Campus Store seller';

    const description =
        typeof product.description === 'string' &&
            product.description.trim()
            ? product.description
            : 'No description is available for this product yet.';

    const availableQuantity =
        Number(
            product.inventory?.availableQuantity ??
            product.stock ??
            0,
        );

    const isAvailable =
        Number.isFinite(availableQuantity) &&
        availableQuantity > 0 &&
        Number.isFinite(price) &&
        price >= 0;

    const handleAddToCart = () => {
        onAddToCart(product);
    };

    return (
        <div
            className="modal show"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                    onClose();
                }
            }}
        >
            <section
                className="modal-card product-details-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="product-details-title"
                aria-describedby="product-details-description"
            >
                <button
                    className="close"
                    type="button"
                    onClick={onClose}
                    aria-label="Close product details"
                >
                    ×
                </button>

                <div className="product-details-content">
                    <div className="product-details-image">
                        {product.image?.imageUrl ? (
                            <img
                                src={product.image.imageUrl}
                                alt={
                                    product.image.altText ||
                                    product.name
                                }
                                loading="lazy"
                                referrerPolicy="no-referrer"
                            />
                        ) : (
                            <div
                                className={`product-icon ${product.iconClass || ''}`}
                                style={product.iconStyle || {}}
                                aria-hidden="true"
                            />
                        )}
                    </div>

                    <div className="product-details-info">
                        <span className="product-meta">
                            {product.category?.name ||
                                'Campus essentials'}
                        </span>

                        <h2 id="product-details-title">
                            {product.name}
                        </h2>

                        <p className="product-details-price">
                            {formattedPrice}
                        </p>

                        <div className="product-details-divider" />

                        <h3>About this product</h3>

                        <p id="product-details-description">
                            {description}
                        </p>

                        <div className="product-details-seller">
                            <span className="product-meta">
                                SOLD BY
                            </span>

                            <p>{sellerName}</p>
                        </div>

                        <p className="product-details-stock">
                            {isAvailable
                                ? 'Available to order'
                                : 'Currently unavailable'}
                        </p>

                        <button
                            className="primary"
                            type="button"
                            onClick={handleAddToCart}
                            disabled={!isAvailable}
                        >
                            {isAvailable
                                ? 'ADD TO BAG →'
                                : 'OUT OF STOCK'}
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );
}