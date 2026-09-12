import React, {
    useEffect,
    useState,
} from 'react';

import {
    getAdminSellerApplications,
    reviewSellerApplication,
} from './adminSellerApplicationStore';

import {
    getAdminOrders,
    updateAdminOrderStatus,
    markAdminOrderItemDelivered,
} from './adminOrderStore';

export default function AdminSellerApplications({
    isOpen,
    onClose,
    onToast,
}) {
    const [activeSection, setActiveSection] =
        useState('APPLICATIONS');

    const [applications, setApplications] =
        useState([]);

    const [orders, setOrders] =
        useState([]);

    const [isLoading, setIsLoading] =
        useState(false);

    const [ordersLoading, setOrdersLoading] =
        useState(false);

    const [reviewingId, setReviewingId] =
        useState(null);

    const [updatingOrderId, setUpdatingOrderId] =
        useState(null);

    const [deliveringItemId, setDeliveringItemId] =
        useState(null);

    const [rejectionId, setRejectionId] =
        useState(null);

    const [rejectionReason, setRejectionReason] =
        useState('');

    const [cancelOrder, setCancelOrder] =
        useState(null);

    const [cancelConfirmation, setCancelConfirmation] =
        useState('');

    /*
     * Load seller applications when the admin
     * panel opens.
     */
    useEffect(() => {
        if (!isOpen) {
            return;
        }

        let isMounted = true;

        const loadApplications = async () => {
            setIsLoading(true);

            try {
                const data =
                    await getAdminSellerApplications();

                if (isMounted) {
                    setApplications(
                        Array.isArray(data)
                            ? data
                            : [],
                    );
                }
            } catch (error) {
                if (isMounted) {
                    onToast(
                        error.message ||
                        'Unable to load seller applications.',
                    );
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        loadApplications();

        return () => {
            isMounted = false;
        };
    }, [isOpen, onToast]);

    /*
     * Load orders only when the ORDERS section
     * is opened.
     */
    useEffect(() => {
        if (
            !isOpen ||
            activeSection !== 'ORDERS'
        ) {
            return;
        }

        let isMounted = true;

        const loadOrders = async () => {
            setOrdersLoading(true);

            try {
                const data =
                    await getAdminOrders();

                if (isMounted) {
                    setOrders(
                        Array.isArray(data)
                            ? data
                            : [],
                    );
                }
            } catch (error) {
                if (isMounted) {
                    onToast(
                        error.message ||
                        'Unable to load orders.',
                    );
                }
            } finally {
                if (isMounted) {
                    setOrdersLoading(false);
                }
            }
        };

        loadOrders();

        return () => {
            isMounted = false;
        };
    }, [
        isOpen,
        activeSection,
        onToast,
    ]);

    if (!isOpen) {
        return null;
    }

    const formatCurrency = (amount) => {
        return (
            '₹' +
            Number(amount).toLocaleString(
                'en-IN',
                {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                },
            )
        );
    };

    const formatDate = (date) => {
        if (!date) {
            return '—';
        }

        const parsedDate =
            new Date(date);

        if (
            Number.isNaN(
                parsedDate.getTime(),
            )
        ) {
            return '—';
        }

        return parsedDate.toLocaleString(
            'en-IN',
        );
    };

    /*
     * -----------------------------------------------------
     * SELLER APPLICATION ACTIONS
     * -----------------------------------------------------
     */

    const handleApprove = async (
        applicationId,
    ) => {
        if (reviewingId) {
            return;
        }

        setReviewingId(applicationId);

        try {
            await reviewSellerApplication({
                applicationId,
                status: 'APPROVED',
            });

            setApplications((current) =>
                current.map(
                    (application) =>
                        application.id ===
                            applicationId
                            ? {
                                ...application,
                                status:
                                    'APPROVED',
                            }
                            : application,
                ),
            );

            onToast(
                'Seller application approved.',
            );
        } catch (error) {
            onToast(
                error.message ||
                'Unable to approve application.',
            );
        } finally {
            setReviewingId(null);
        }
    };

    const handleReject = async (
        applicationId,
    ) => {
        if (reviewingId) {
            return;
        }

        const reason =
            rejectionReason.trim();

        if (!reason) {
            onToast(
                'Please enter a rejection reason.',
            );

            return;
        }

        setReviewingId(applicationId);

        try {
            await reviewSellerApplication({
                applicationId,
                status: 'REJECTED',
                rejectionReason:
                    reason,
            });

            setApplications((current) =>
                current.map(
                    (application) =>
                        application.id ===
                            applicationId
                            ? {
                                ...application,
                                status:
                                    'REJECTED',
                                rejectionReason:
                                    reason,
                            }
                            : application,
                ),
            );

            setRejectionId(null);
            setRejectionReason('');

            onToast(
                'Seller application rejected.',
            );
        } catch (error) {
            onToast(
                error.message ||
                'Unable to reject application.',
            );
        } finally {
            setReviewingId(null);
        }
    };

    const handleStartRejecting = (
        applicationId,
    ) => {
        setRejectionId(
            applicationId,
        );

        setRejectionReason('');
    };

    const handleCancelRejecting = () => {
        if (reviewingId) {
            return;
        }

        setRejectionId(null);
        setRejectionReason('');
    };

    /*
     * -----------------------------------------------------
     * ORDER STATUS WORKFLOW
     * -----------------------------------------------------
     *
     * Order-level status:
     *
     * PENDING
     *     ↓
     * CONFIRMED
     *     ↓
     * PROCESSING
     *
     * Cancellation is allowed before anything
     * has been delivered.
     *
     * READY is NOT an order-level status.
     *
     * COMPLETED is NOT manually selected.
     * The backend completes the order after every
     * order item has been delivered.
     */

    const getNextOrderStatuses = (
        currentStatus,
    ) => {
        if (
            currentStatus ===
            'PENDING'
        ) {
            return [
                'CONFIRMED',
                'CANCELLED',
            ];
        }

        if (
            currentStatus ===
            'CONFIRMED'
        ) {
            return [
                'PROCESSING',
                'CANCELLED',
            ];
        }

        if (
            currentStatus ===
            'PROCESSING'
        ) {
            return [
                'CANCELLED',
            ];
        }

        return [];
    };

    const handleOrderStatusChange =
        async (
            orderId,
            status,
        ) => {
            if (updatingOrderId) {
                return;
            }

            /*
             * Cancellation requires explicit
             * confirmation.
             */
            if (
                status ===
                'CANCELLED'
            ) {
                const order =
                    orders.find(
                        (item) =>
                            item.id ===
                            orderId,
                    );

                if (!order) {
                    onToast(
                        'Order not found.',
                    );

                    return;
                }

                setCancelOrder(order);
                setCancelConfirmation('');

                return;
            }

            setUpdatingOrderId(orderId);

            try {
                const result =
                    await updateAdminOrderStatus(
                        {
                            orderId,
                            status,
                        },
                    );

                /*
                 * Reload from the database.
                 *
                 * Never trust the frontend copy
                 * of order state as the source of truth.
                 */
                const refreshedOrders =
                    await getAdminOrders();

                setOrders(
                    Array.isArray(
                        refreshedOrders,
                    )
                        ? refreshedOrders
                        : [],
                );

                onToast(
                    result.message ||
                    'Order status updated successfully.',
                );
            } catch (error) {
                onToast(
                    error.message ||
                    'Unable to update order status.',
                );
            } finally {
                setUpdatingOrderId(
                    null,
                );
            }
        };

    /*
     * -----------------------------------------------------
     * ITEM DELIVERY
     * -----------------------------------------------------
     *
     * Only READY seller items are offered
     * to the admin for delivery.
     *
     * The backend performs the actual authorization,
     * state validation, row locking and inventory
     * update.
     */
    const handleMarkItemDelivered =
        async (
            orderId,
            itemId,
        ) => {
            if (
                deliveringItemId
            ) {
                return;
            }

            setDeliveringItemId(
                itemId,
            );

            try {
                const result =
                    await markAdminOrderItemDelivered(
                        {
                            orderId,
                            itemId,
                        },
                    );

                /*
                 * Always refresh from the server.
                 *
                 * This is especially important because
                 * the backend may have automatically changed
                 * the overall order to COMPLETED.
                 */
                const refreshedOrders =
                    await getAdminOrders();

                setOrders(
                    Array.isArray(
                        refreshedOrders,
                    )
                        ? refreshedOrders
                        : [],
                );

                onToast(
                    result.message ||
                    'Item marked as delivered.',
                );
            } catch (error) {
                onToast(
                    error.message ||
                    'Unable to mark item as delivered.',
                );
            } finally {
                setDeliveringItemId(
                    null,
                );
            }
        };

    /*
     * -----------------------------------------------------
     * ORDER CANCELLATION
     * -----------------------------------------------------
     */

    const handleConfirmCancellation =
        async () => {
            if (!cancelOrder) {
                return;
            }

            if (
                cancelConfirmation !==
                'CANCEL'
            ) {
                onToast(
                    'Type CANCEL exactly to confirm order cancellation.',
                );

                return;
            }

            if (updatingOrderId) {
                return;
            }

            const orderId =
                cancelOrder.id;

            setUpdatingOrderId(
                orderId,
            );

            try {
                const result =
                    await updateAdminOrderStatus(
                        {
                            orderId,
                            status: 'CANCELLED',
                        },
                    );

                /*
                 * Reload the complete server state.
                 */
                const refreshedOrders =
                    await getAdminOrders();

                setOrders(
                    Array.isArray(
                        refreshedOrders,
                    )
                        ? refreshedOrders
                        : [],
                );

                setCancelOrder(null);
                setCancelConfirmation('');

                onToast(
                    result.message ||
                    'Order cancelled and inventory released.',
                );
            } catch (error) {
                onToast(
                    error.message ||
                    'Unable to cancel order.',
                );
            } finally {
                setUpdatingOrderId(
                    null,
                );
            }
        };

    const handleCancelCancellation =
        () => {
            if (updatingOrderId) {
                return;
            }

            setCancelOrder(null);
            setCancelConfirmation('');
        };

    return (
        <div
            className={`modal ${isOpen
                    ? 'show'
                    : ''
                }`}
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
                    aria-label="Close admin panel"
                >
                    ×
                </button>

                <h2>
                    Admin panel.
                </h2>

                <p>
                    Manage seller applications
                    and marketplace orders.
                </p>

                <div
                    style={{
                        display: 'flex',
                        gap: '10px',
                        marginBottom: '20px',
                    }}
                >
                    <button
                        type="button"
                        className={
                            activeSection ===
                                'APPLICATIONS'
                                ? 'primary'
                                : ''
                        }
                        onClick={() =>
                            setActiveSection(
                                'APPLICATIONS',
                            )
                        }
                    >
                        SELLER APPLICATIONS
                    </button>

                    <button
                        type="button"
                        className={
                            activeSection ===
                                'ORDERS'
                                ? 'primary'
                                : ''
                        }
                        onClick={() =>
                            setActiveSection(
                                'ORDERS',
                            )
                        }
                    >
                        ORDERS
                    </button>
                </div>

                {/*
                 * =================================================
                 * SELLER APPLICATIONS
                 * =================================================
                 */}

                {activeSection ===
                    'APPLICATIONS' && (
                        <>
                            {isLoading ? (
                                <div>
                                    <p>
                                        Loading seller
                                        applications...
                                    </p>
                                </div>
                            ) : applications.length ===
                                0 ? (
                                <div>
                                    <p>
                                        There are no seller
                                        applications to
                                        review.
                                    </p>
                                </div>
                            ) : (
                                <div>
                                    {applications.map(
                                        (
                                            application,
                                        ) => {
                                            const isPending =
                                                application.status ===
                                                'PENDING';

                                            const isReviewing =
                                                reviewingId ===
                                                application.id;

                                            return (
                                                <div
                                                    key={
                                                        application.id
                                                    }
                                                    className="checkout-product"
                                                >
                                                    <div>
                                                        <strong>
                                                            {
                                                                application.shopName
                                                            }
                                                        </strong>

                                                        <br />

                                                        <span>
                                                            {
                                                                application
                                                                    .applicant
                                                                    .name
                                                            }
                                                        </span>

                                                        <br />

                                                        <span>
                                                            {
                                                                application
                                                                    .applicant
                                                                    .email
                                                            }
                                                        </span>

                                                        <br />

                                                        <span>
                                                            {
                                                                application.description
                                                            }
                                                        </span>

                                                        <br />

                                                        <strong>
                                                            STATUS:{' '}
                                                            {
                                                                application.status
                                                            }
                                                        </strong>
                                                    </div>

                                                    {isPending && (
                                                        <div>
                                                            {rejectionId ===
                                                                application.id ? (
                                                                <div>
                                                                    <div className="field">
                                                                        <label
                                                                            htmlFor={`rejection-${application.id}`}
                                                                        >
                                                                            Rejection
                                                                            reason
                                                                        </label>

                                                                        <textarea
                                                                            id={`rejection-${application.id}`}
                                                                            value={
                                                                                rejectionReason
                                                                            }
                                                                            onChange={(
                                                                                event,
                                                                            ) =>
                                                                                setRejectionReason(
                                                                                    event
                                                                                        .target
                                                                                        .value,
                                                                                )
                                                                            }
                                                                            placeholder="Tell the applicant why the application was rejected."
                                                                            maxLength={
                                                                                500
                                                                            }
                                                                        />
                                                                    </div>

                                                                    <button
                                                                        className="primary"
                                                                        type="button"
                                                                        disabled={
                                                                            isReviewing
                                                                        }
                                                                        onClick={() =>
                                                                            handleReject(
                                                                                application.id,
                                                                            )
                                                                        }
                                                                    >
                                                                        {isReviewing
                                                                            ? 'REJECTING...'
                                                                            : 'CONFIRM REJECTION →'}
                                                                    </button>

                                                                    <button
                                                                        type="button"
                                                                        disabled={
                                                                            isReviewing
                                                                        }
                                                                        onClick={
                                                                            handleCancelRejecting
                                                                        }
                                                                    >
                                                                        CANCEL
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <div>
                                                                    <button
                                                                        className="primary"
                                                                        type="button"
                                                                        disabled={
                                                                            isReviewing
                                                                        }
                                                                        onClick={() =>
                                                                            handleApprove(
                                                                                application.id,
                                                                            )
                                                                        }
                                                                    >
                                                                        {isReviewing
                                                                            ? 'APPROVING...'
                                                                            : 'APPROVE →'}
                                                                    </button>

                                                                    <button
                                                                        type="button"
                                                                        disabled={
                                                                            isReviewing
                                                                        }
                                                                        onClick={() =>
                                                                            handleStartRejecting(
                                                                                application.id,
                                                                            )
                                                                        }
                                                                    >
                                                                        REJECT
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        },
                                    )}
                                </div>
                            )}
                        </>
                    )}

                {/*
                 * =================================================
                 * ORDERS
                 * =================================================
                 */}

                {activeSection ===
                    'ORDERS' && (
                        <>
                            {ordersLoading ? (
                                <div>
                                    <p>
                                        Loading orders...
                                    </p>
                                </div>
                            ) : orders.length ===
                                0 ? (
                                <div>
                                    <p>
                                        There are no orders
                                        yet.
                                    </p>
                                </div>
                            ) : (
                                <div>
                                    {orders.map(
                                        (order) => {
                                            const isUpdating =
                                                updatingOrderId ===
                                                order.id;

                                            const isFinal =
                                                order.status ===
                                                'COMPLETED' ||
                                                order.status ===
                                                'CANCELLED';

                                            const nextStatuses =
                                                getNextOrderStatuses(
                                                    order.status,
                                                );

                                            return (
                                                <div
                                                    key={
                                                        order.id
                                                    }
                                                    className="checkout-product"
                                                >
                                                    <div
                                                        style={{
                                                            width:
                                                                '100%',
                                                        }}
                                                    >
                                                        <strong>
                                                            ORDER{' '}
                                                            {
                                                                order.id
                                                            }
                                                        </strong>

                                                        <br />

                                                        <span>
                                                            Customer:{' '}
                                                            {
                                                                order.customerName
                                                            }
                                                        </span>

                                                        <br />

                                                        <span>
                                                            Phone:{' '}
                                                            {
                                                                order.customerPhone
                                                            }
                                                        </span>

                                                        <br />

                                                        <span>
                                                            Delivery:{' '}
                                                            {
                                                                order.deliveryLocation
                                                            }
                                                        </span>

                                                        <br />

                                                        <span>
                                                            Created:{' '}
                                                            {formatDate(
                                                                order.createdAt,
                                                            )}
                                                        </span>

                                                        <br />
                                                        <br />

                                                        <strong>
                                                            ITEMS
                                                        </strong>

                                                        <div
                                                            style={{
                                                                display:
                                                                    'grid',
                                                                gap:
                                                                    '12px',
                                                                marginTop:
                                                                    '10px',
                                                            }}
                                                        >
                                                            {order.items.map(
                                                                (
                                                                    item,
                                                                ) => {
                                                                    const fulfillmentStatus =
                                                                        item.fulfillmentStatus ||
                                                                        'PENDING';

                                                                    const isDelivering =
                                                                        deliveringItemId ===
                                                                        item.id;

                                                                    const canDeliver =
                                                                        order.status ===
                                                                        'PROCESSING' &&
                                                                        fulfillmentStatus ===
                                                                        'READY';

                                                                    return (
                                                                        <div
                                                                            key={
                                                                                item.id
                                                                            }
                                                                            style={{
                                                                                padding:
                                                                                    '12px',
                                                                                border:
                                                                                    '1px solid rgba(35, 28, 45, 0.10)',
                                                                                borderRadius:
                                                                                    '14px',
                                                                            }}
                                                                        >
                                                                            <strong>
                                                                                {
                                                                                    item.productName
                                                                                }{' '}
                                                                                ×{' '}
                                                                                {
                                                                                    item.quantity
                                                                                }
                                                                            </strong>

                                                                            <br />

                                                                            <span>
                                                                                Seller:{' '}
                                                                                {
                                                                                    item.sellerShopName
                                                                                }
                                                                            </span>

                                                                            <br />

                                                                            <span>
                                                                                {
                                                                                    formatCurrency(
                                                                                        item.unitPrice,
                                                                                    )}{' '}
                                                                                each
                                                                            </span>

                                                                            <br />

                                                                            <strong>
                                                                                {formatCurrency(
                                                                                    item.lineTotal,
                                                                                )}
                                                                            </strong>

                                                                            <div
                                                                                style={{
                                                                                    marginTop:
                                                                                        '10px',
                                                                                    display:
                                                                                        'flex',
                                                                                    alignItems:
                                                                                        'center',
                                                                                    justifyContent:
                                                                                        'space-between',
                                                                                    gap:
                                                                                        '10px',
                                                                                    flexWrap:
                                                                                        'wrap',
                                                                                }}
                                                                            >
                                                                                <span>
                                                                                    <strong>
                                                                                        FULFILLMENT:{' '}
                                                                                    </strong>

                                                                                    {
                                                                                        fulfillmentStatus
                                                                                    }
                                                                                </span>

                                                                                {item.sellerReadyAt && (
                                                                                    <span>
                                                                                        Ready:{' '}
                                                                                        {formatDate(
                                                                                            item.sellerReadyAt,
                                                                                        )}
                                                                                    </span>
                                                                                )}
                                                                            </div>

                                                                            {canDeliver && (
                                                                                <button
                                                                                    className="primary"
                                                                                    type="button"
                                                                                    disabled={
                                                                                        Boolean(
                                                                                            deliveringItemId,
                                                                                        )
                                                                                    }
                                                                                    onClick={() =>
                                                                                        handleMarkItemDelivered(
                                                                                            order.id,
                                                                                            item.id,
                                                                                        )
                                                                                    }
                                                                                    style={{
                                                                                        marginTop:
                                                                                            '10px',
                                                                                    }}
                                                                                >
                                                                                    {isDelivering
                                                                                        ? 'DELIVERING...'
                                                                                        : 'MARK DELIVERED →'}
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                },
                                                            )}
                                                        </div>

                                                        <br />

                                                        <strong>
                                                            TOTAL:{' '}
                                                            {formatCurrency(
                                                                order.totalAmount,
                                                            )}
                                                        </strong>

                                                        <br />

                                                        <span>
                                                            Payment:{' '}
                                                            {
                                                                order.paymentMethod
                                                            }
                                                            {' / '}
                                                            {
                                                                order.paymentStatus
                                                            }
                                                        </span>

                                                        <br />

                                                        <strong>
                                                            STATUS:{' '}
                                                            {
                                                                order.status
                                                            }
                                                        </strong>

                                                        {/*
                                                     * Only show legitimate
                                                     * next order-level states.
                                                     *
                                                     * READY and COMPLETED
                                                     * are intentionally absent.
                                                     */}
                                                        {!isFinal &&
                                                            nextStatuses.length >
                                                            0 && (
                                                                <div
                                                                    style={{
                                                                        marginTop:
                                                                            '12px',
                                                                    }}
                                                                >
                                                                    <label
                                                                        htmlFor={`order-status-${order.id}`}
                                                                    >
                                                                        Update
                                                                        status
                                                                    </label>

                                                                    <select
                                                                        id={`order-status-${order.id}`}
                                                                        value=""
                                                                        disabled={
                                                                            isUpdating
                                                                        }
                                                                        onChange={(
                                                                            event,
                                                                        ) => {
                                                                            const nextStatus =
                                                                                event
                                                                                    .target
                                                                                    .value;

                                                                            if (
                                                                                nextStatus
                                                                            ) {
                                                                                handleOrderStatusChange(
                                                                                    order.id,
                                                                                    nextStatus,
                                                                                );
                                                                            }
                                                                        }}
                                                                    >
                                                                        <option value="">
                                                                            Select
                                                                            next
                                                                            status
                                                                        </option>

                                                                        {nextStatuses.map(
                                                                            (
                                                                                nextStatus,
                                                                            ) => (
                                                                                <option
                                                                                    key={
                                                                                        nextStatus
                                                                                    }
                                                                                    value={
                                                                                        nextStatus
                                                                                    }
                                                                                >
                                                                                    {
                                                                                        nextStatus
                                                                                    }
                                                                                </option>
                                                                            ),
                                                                        )}
                                                                    </select>

                                                                    {isUpdating && (
                                                                        <span>
                                                                            {' '}
                                                                            UPDATING...
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                    </div>
                                                </div>
                                            );
                                        },
                                    )}
                                </div>
                            )}
                        </>
                    )}
            </div>

            {/*
             * =================================================
             * CANCELLATION CONFIRMATION
             * =================================================
             */}

            {cancelOrder && (
                <div
                    className="modal show"
                    style={{
                        zIndex: 1200,
                    }}
                    onClick={(event) => {
                        if (
                            event.target.classList.contains(
                                'modal',
                            )
                        ) {
                            handleCancelCancellation();
                        }
                    }}
                >
                    <div
                        className="modal-card"
                        style={{
                            maxWidth:
                                '480px',
                        }}
                    >
                        <button
                            className="close"
                            type="button"
                            onClick={
                                handleCancelCancellation
                            }
                            aria-label="Close cancellation confirmation"
                        >
                            ×
                        </button>

                        <h2>
                            Cancel order?
                        </h2>

                        <p>
                            You are about to
                            cancel order{' '}
                            <strong>
                                {cancelOrder.id}
                            </strong>
                            .
                        </p>

                        <p>
                            This will release
                            the inventory
                            reserved for this
                            order.
                        </p>

                        <p>
                            <strong>
                                This action cannot
                                be undone.
                            </strong>
                        </p>

                        <div className="field">
                            <label
                                htmlFor="cancel-order-confirmation"
                            >
                                Type CANCEL to
                                confirm
                            </label>

                            <input
                                id="cancel-order-confirmation"
                                type="text"
                                value={
                                    cancelConfirmation
                                }
                                onChange={(
                                    event,
                                ) =>
                                    setCancelConfirmation(
                                        event
                                            .target
                                            .value,
                                    )
                                }
                                autoComplete="off"
                                autoCapitalize="characters"
                                spellCheck="false"
                                placeholder="CANCEL"
                            />
                        </div>

                        <button
                            className="primary"
                            type="button"
                            disabled={
                                updatingOrderId ===
                                cancelOrder.id
                            }
                            onClick={
                                handleConfirmCancellation
                            }
                        >
                            {updatingOrderId ===
                                cancelOrder.id
                                ? 'CANCELLING...'
                                : 'CANCEL ORDER →'}
                        </button>

                        <button
                            type="button"
                            disabled={
                                updatingOrderId ===
                                cancelOrder.id
                            }
                            onClick={
                                handleCancelCancellation
                            }
                        >
                            GO BACK
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}