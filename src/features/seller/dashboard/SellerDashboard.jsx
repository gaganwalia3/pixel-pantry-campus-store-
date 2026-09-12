import React, {
    useEffect,
    useState,
} from 'react';

import {
    getSellerProducts,
    publishSellerProduct,
} from '../products/sellerProductStore';

import AddProductModal from '../products/AddProductModal';
import ProductPreviewModal from '../products/ProductPreviewModal';
import SellerOrders from '../orders/SellerOrders';

const API_URL =
    import.meta.env.VITE_API_URL ||
    'http://localhost:5000';

const getSellerDashboard = async () => {
    const response = await fetch(
        `${API_URL}/api/seller/dashboard`,
        {
            credentials: 'include',
        },
    );

    const data =
        await response.json();

    if (!response.ok) {
        throw new Error(
            data.message ||
            'Unable to load seller dashboard',
        );
    }

    return data.seller;
};

export default function SellerDashboard({
    isOpen,
    onClose,
    onToast,
}) {
    const [seller, setSeller] =
        useState(null);

    const [products, setProducts] =
        useState([]);

    const [isLoading, setIsLoading] =
        useState(false);

    const [isLoadingProducts, setIsLoadingProducts] =
        useState(false);

    const [addProductOpen, setAddProductOpen] =
        useState(false);

    const [productToEdit, setProductToEdit] =
        useState(null);

    const [productToPreview, setProductToPreview] =
        useState(null);

    const [isPublishing, setIsPublishing] =
        useState(false);

    const loadDashboard = async () => {
        try {
            const data =
                await getSellerDashboard();

            setSeller(data);
        } catch (error) {
            onToast(
                error.message ||
                'Unable to load seller dashboard.',
            );
        }
    };

    const loadProducts = async () => {
        setIsLoadingProducts(true);

        try {
            const data =
                await getSellerProducts();

            setProducts(data);
        } catch (error) {
            onToast(
                error.message ||
                'Unable to load seller products.',
            );
        } finally {
            setIsLoadingProducts(false);
        }
    };

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        let isMounted = true;

        const load = async () => {
            setIsLoading(true);

            try {
                const [
                    dashboardData,
                    productData,
                ] = await Promise.all([
                    getSellerDashboard(),
                    getSellerProducts(),
                ]);

                if (isMounted) {
                    setSeller(
                        dashboardData,
                    );

                    setProducts(
                        productData,
                    );
                }
            } catch (error) {
                if (isMounted) {
                    onToast(
                        error.message ||
                        'Unable to load seller dashboard.',
                    );
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        load();

        return () => {
            isMounted = false;
        };
    }, [isOpen, onToast]);

    if (!isOpen) {
        return null;
    }

    const handleProductCreated = async () => {
        await Promise.all([
            loadDashboard(),
            loadProducts(),
        ]);
    };

    const handleEditProduct = (
        product,
    ) => {
        setProductToEdit(product);
        setAddProductOpen(true);
    };

    const handleCloseProductModal = () => {
        setAddProductOpen(false);
        setProductToEdit(null);
    };

    const handlePreviewProduct = (
        product,
    ) => {
        setProductToPreview(product);
    };

    const handleClosePreview = () => {
        if (isPublishing) {
            return;
        }

        setProductToPreview(null);
    };

    const handlePublishProduct = async () => {
        if (
            !productToPreview ||
            isPublishing
        ) {
            return;
        }

        if (
            productToPreview.status !==
            'DRAFT'
        ) {
            onToast(
                'Only draft products can be published.',
            );
            return;
        }

        setIsPublishing(true);

        try {
            await publishSellerProduct(
                productToPreview.id,
            );

            /*
             * Close the preview immediately after
             * the backend confirms publication.
             */
            setProductToPreview(null);

            /*
             * Reload both the seller statistics
             * and product list from the database.
             */
            await Promise.all([
                loadDashboard(),
                loadProducts(),
            ]);

            onToast(
                'Product published successfully.',
            );
        } catch (error) {
            onToast(
                error.message ||
                'Unable to publish product.',
            );
        } finally {
            setIsPublishing(false);
        }
    };

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
        <>
            <div className="seller-dashboard">
                <div className="seller-dashboard-inner">
                    <button
                        className="close"
                        type="button"
                        onClick={onClose}
                        aria-label="Close seller dashboard"
                    >
                        ×
                    </button>

                    {isLoading ? (
                        <div>
                            <div className="eyebrow">
                                Seller space
                            </div>

                            <h2>
                                Loading your shelf.
                            </h2>

                            <p>
                                Checking your seller
                                account and products.
                            </p>
                        </div>
                    ) : seller ? (
                        <>
                            <div className="seller-dashboard-header">
                                <div>
                                    <div className="eyebrow">
                                        Your shelf
                                    </div>

                                    <h2>
                                        {seller.shopName}
                                    </h2>

                                    <p>
                                        ACTIVE SELLER
                                    </p>
                                </div>

                                <div className="seller-status">
                                    {seller.status}
                                </div>
                            </div>

                            <div className="seller-dashboard-stats">
                                <div className="seller-stat">
                                    <span>
                                        PRODUCTS
                                    </span>

                                    <strong>
                                        {
                                            seller.productCount
                                        }
                                    </strong>
                                </div>

                                <div className="seller-stat">
                                    <span>
                                        ACTIVE
                                    </span>

                                    <strong>
                                        {
                                            seller.activeProductCount
                                        }
                                    </strong>
                                </div>

                                <div className="seller-stat">
                                    <span>
                                        DRAFTS
                                    </span>

                                    <strong>
                                        {
                                            seller.draftProductCount
                                        }
                                    </strong>
                                </div>

                                <div className="seller-stat">
                                    <span>
                                        COMMISSION
                                    </span>

                                    <strong>
                                        {
                                            seller.commissionRate
                                        }%
                                    </strong>
                                </div>
                            </div>

                            <div className="seller-dashboard-section">
                                <div className="section-top">
                                    <div>
                                        <div className="eyebrow">
                                            Inventory
                                        </div>

                                        <h3>
                                            Your products
                                        </h3>
                                    </div>

                                    <button
                                        className="primary seller-add-product"
                                        type="button"
                                        onClick={() => {
                                            setProductToEdit(
                                                null,
                                            );

                                            setAddProductOpen(
                                                true,
                                            );
                                        }}
                                    >
                                        + ADD PRODUCT
                                    </button>
                                </div>

                                {isLoadingProducts ? (
                                    <div className="seller-empty">
                                        <strong>
                                            Loading your products.
                                        </strong>

                                        <p>
                                            Fetching your inventory
                                            from the database.
                                        </p>
                                    </div>
                                ) : products.length ===
                                    0 ? (
                                    <div className="seller-empty">
                                        <strong>
                                            Your shelf is
                                            empty.
                                        </strong>

                                        <p>
                                            Add your first
                                            product and start
                                            building your shop.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="seller-products-list">
                                        {products.map(
                                            (product) => (
                                                <article
                                                    key={
                                                        product.id
                                                    }
                                                    className="seller-product-row"
                                                >
                                                    <div className="seller-product-main">
                                                        <div className="seller-product-status">
                                                            {
                                                                product.status
                                                            }
                                                        </div>

                                                        <h4>
                                                            {
                                                                product.name
                                                            }
                                                        </h4>

                                                        <p>
                                                            {
                                                                product
                                                                    .category
                                                                    .name
                                                            }{' '}
                                                            ·{' '}
                                                            {
                                                                product
                                                                    .brand
                                                                    .name
                                                            }
                                                        </p>
                                                    </div>

                                                    <div className="seller-product-details">
                                                        <strong>
                                                            {formatPrice(
                                                                product.price,
                                                            )}
                                                        </strong>

                                                        <span>
                                                            {
                                                                product
                                                                    .inventory
                                                                    .availableQuantity
                                                            }{' '}
                                                            available
                                                        </span>

                                                        <div className="seller-product-actions">
                                                            <button
                                                                type="button"
                                                                className="seller-product-edit"
                                                                onClick={() =>
                                                                    handleEditProduct(
                                                                        product,
                                                                    )
                                                                }
                                                            >
                                                                EDIT
                                                            </button>

                                                            <button
                                                                type="button"
                                                                className="seller-product-preview"
                                                                onClick={() =>
                                                                    handlePreviewProduct(
                                                                        product,
                                                                    )
                                                                }
                                                            >
                                                                PREVIEW
                                                            </button>
                                                        </div>
                                                    </div>
                                                </article>
                                            ),
                                        )}
                                    </div>
                                )}
                            </div>

                            <SellerOrders
                                isOpen={true}
                                onToast={onToast}
                            />
                        </>
                    ) : null}
                </div>
            </div>

            <AddProductModal
                isOpen={
                    addProductOpen
                }
                onClose={
                    handleCloseProductModal
                }
                onToast={onToast}
                onProductCreated={
                    handleProductCreated
                }
                productToEdit={
                    productToEdit
                }
            />

            <ProductPreviewModal
                isOpen={
                    Boolean(
                        productToPreview,
                    )
                }
                product={
                    productToPreview
                }
                onClose={
                    handleClosePreview
                }
                onPublish={
                    handlePublishProduct
                }
            />
        </>
    );
}