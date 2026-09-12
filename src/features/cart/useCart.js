import {
    useEffect,
    useMemo,
    useState,
} from 'react';

const CART_STORAGE_KEY =
    'campus-store-cart';

export default function useCart() {
    const [cart, setCart] = useState(
        () => {
            try {
                const savedCart =
                    localStorage.getItem(
                        CART_STORAGE_KEY,
                    );

                if (!savedCart) {
                    return [];
                }

                const parsedCart =
                    JSON.parse(savedCart);

                if (
                    !Array.isArray(
                        parsedCart,
                    )
                ) {
                    return [];
                }

                return parsedCart;
            } catch (error) {
                console.error(
                    'Unable to restore cart:',
                    error,
                );

                return [];
            }
        },
    );

    useEffect(() => {
        try {
            localStorage.setItem(
                CART_STORAGE_KEY,
                JSON.stringify(cart),
            );
        } catch (error) {
            console.error(
                'Unable to save cart:',
                error,
            );
        }
    }, [cart]);

    const addToCart = (product) => {
        const availableStock =
            Number(
                product.inventory
                    ?.availableQuantity ??
                product.stock ??
                0,
            );

        if (availableStock <= 0) {
            return {
                success: false,
                message:
                    'This product is currently out of stock.',
            };
        }

        const existingItem =
            cart.find(
                (item) =>
                    item.productId ===
                    product.id,
            );

        if (existingItem) {
            if (
                existingItem.quantity >=
                availableStock
            ) {
                return {
                    success: false,
                    message:
                        `You already have the maximum available quantity of ${product.name}.`,
                };
            }

            setCart(
                (currentCart) =>
                    currentCart.map(
                        (item) =>
                            item.productId ===
                                product.id
                                ? {
                                    ...item,
                                    quantity:
                                        item.quantity +
                                        1,
                                    availableStock,
                                }
                                : item,
                    ),
            );

            return {
                success: true,
            };
        }

        setCart(
            (currentCart) => [
                ...currentCart,
                {
                    productId:
                        product.id,

                    name:
                        product.name,

                    price:
                        product.price,

                    quantity: 1,

                    availableStock,
                },
            ],
        );

        return {
            success: true,
        };
    };

    /*
     * Increase the quantity of an item
     * already inside the cart.
     */
    const increaseQuantity = (
        productId,
    ) => {
        let result = {
            success: true,
        };

        setCart(
            (currentCart) =>
                currentCart.map(
                    (item) => {
                        if (
                            item.productId !==
                            productId
                        ) {
                            return item;
                        }

                        const availableStock =
                            Number(
                                item.availableStock ??
                                0,
                            );

                        if (
                            item.quantity >=
                            availableStock
                        ) {
                            result = {
                                success: false,
                                message:
                                    `You already have the maximum available quantity of ${item.name}.`,
                            };

                            return item;
                        }

                        return {
                            ...item,
                            quantity:
                                item.quantity +
                                1,
                        };
                    },
                ),
        );

        return result;
    };

    /*
     * Decrease the quantity of an item.
     *
     * If quantity reaches zero, the item
     * is removed from the cart.
     */
    const decreaseQuantity = (
        productId,
    ) => {
        setCart(
            (currentCart) =>
                currentCart
                    .map(
                        (item) => {
                            if (
                                item.productId !==
                                productId
                            ) {
                                return item;
                            }

                            return {
                                ...item,
                                quantity:
                                    item.quantity -
                                    1,
                            };
                        },
                    )
                    .filter(
                        (item) =>
                            item.quantity > 0,
                    ),
        );
    };

    /*
     * Remove an item completely from
     * the cart.
     */
    const removeFromCart = (
        productId,
    ) => {
        setCart(
            (currentCart) =>
                currentCart.filter(
                    (item) =>
                        item.productId !==
                        productId,
                ),
        );
    };

    const clearCart = () => {
        setCart([]);
    };

    const total = useMemo(() => {
        return cart.reduce(
            (sum, item) => {
                return (
                    sum +
                    Number(item.price) *
                    item.quantity
                );
            },
            0,
        );
    }, [cart]);

    const itemCount = useMemo(() => {
        return cart.reduce(
            (count, item) => {
                return (
                    count +
                    item.quantity
                );
            },
            0,
        );
    }, [cart]);

    return {
        cart,
        addToCart,
        increaseQuantity,
        decreaseQuantity,
        removeFromCart,
        clearCart,
        total,
        itemCount,
    };
}