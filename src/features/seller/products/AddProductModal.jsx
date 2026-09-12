import React, {
    useEffect,
    useState,
} from 'react';

import {
    createSellerProduct,
    getSellerProductOptions,
    updateSellerProduct,
    uploadSellerProductImage,
} from './sellerProductStore';

const INITIAL_FORM = {
    name: '',
    description: '',
    price: '',
    categoryId: '',
    brandId: '',
    stock: '',
};

const MAX_IMAGE_SIZE =
    5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
]);

export default function AddProductModal({
    isOpen,
    onClose,
    onToast,
    onProductCreated,
    productToEdit = null,
}) {
    const [form, setForm] =
        useState(INITIAL_FORM);

    const [categories, setCategories] =
        useState([]);

    const [brands, setBrands] =
        useState([]);

    const [selectedImage, setSelectedImage] =
        useState(null);

    const [imagePreview, setImagePreview] =
        useState('');

    const [isLoadingOptions, setIsLoadingOptions] =
        useState(false);

    const [isSubmitting, setIsSubmitting] =
        useState(false);

    const isEditMode =
        Boolean(productToEdit);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        if (productToEdit) {
            setForm({
                name:
                    productToEdit.name || '',
                description:
                    productToEdit.description ||
                    '',
                price:
                    productToEdit.price ??
                    '',
                categoryId:
                    productToEdit.category?.id ||
                    '',
                brandId:
                    productToEdit.brand?.id ||
                    '',
                stock:
                    productToEdit.inventory
                        ?.quantity ??
                    '',
            });
        } else {
            setForm(INITIAL_FORM);
        }

        setSelectedImage(null);
        setImagePreview('');
    }, [
        isOpen,
        productToEdit,
    ]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        let isMounted = true;

        const loadOptions = async () => {
            setIsLoadingOptions(true);

            try {
                const data =
                    await getSellerProductOptions();

                if (isMounted) {
                    setCategories(
                        data.categories,
                    );

                    setBrands(
                        data.brands,
                    );
                }
            } catch (error) {
                if (isMounted) {
                    onToast(
                        error.message ||
                        'Unable to load product options.',
                    );
                }
            } finally {
                if (isMounted) {
                    setIsLoadingOptions(false);
                }
            }
        };

        loadOptions();

        return () => {
            isMounted = false;
        };
    }, [
        isOpen,
        onToast,
    ]);

    useEffect(() => {
        return () => {
            if (imagePreview) {
                URL.revokeObjectURL(
                    imagePreview,
                );
            }
        };
    }, [
        imagePreview,
    ]);

    if (!isOpen) {
        return null;
    }

    const handleChange = (event) => {
        const {
            name,
            value,
        } = event.target;

        setForm((currentForm) => ({
            ...currentForm,
            [name]: value,
        }));
    };

    const handleImageChange = (
        event,
    ) => {
        const file =
            event.target.files?.[0];

        if (!file) {
            return;
        }

        if (
            !ALLOWED_IMAGE_TYPES.has(
                file.type,
            )
        ) {
            event.target.value = '';

            setSelectedImage(null);
            setImagePreview('');

            onToast(
                'Please select a JPEG, PNG, or WebP image.',
            );

            return;
        }

        if (
            file.size >
            MAX_IMAGE_SIZE
        ) {
            event.target.value = '';

            setSelectedImage(null);
            setImagePreview('');

            onToast(
                'Image must be 5 MB or smaller.',
            );

            return;
        }

        if (imagePreview) {
            URL.revokeObjectURL(
                imagePreview,
            );
        }

        const previewUrl =
            URL.createObjectURL(
                file,
            );

        setSelectedImage(file);
        setImagePreview(
            previewUrl,
        );
    };

    const handleSubmit = async (
        event,
    ) => {
        event.preventDefault();

        const price = Number(
            form.price,
        );

        const stock = Number(
            form.stock,
        );

        if (
            !form.name.trim()
        ) {
            onToast(
                'Please enter a product name.',
            );
            return;
        }

        if (
            !Number.isFinite(price) ||
            price < 0
        ) {
            onToast(
                'Please enter a valid price.',
            );
            return;
        }

        if (
            !Number.isInteger(stock) ||
            stock < 0
        ) {
            onToast(
                'Please enter a valid stock quantity.',
            );
            return;
        }

        if (!form.categoryId) {
            onToast(
                'Please select a category.',
            );
            return;
        }

        if (!form.brandId) {
            onToast(
                'Please select a brand.',
            );
            return;
        }

        /*
         * A new product needs its first image
         * during the creation flow.
         */
        if (
            !isEditMode &&
            !selectedImage
        ) {
            onToast(
                'Please select a product image.',
            );
            return;
        }

        setIsSubmitting(true);

        try {
            let product;

            if (isEditMode) {
                product =
                    await updateSellerProduct({
                        productId:
                            productToEdit.id,
                        name:
                            form.name,
                        description:
                            form.description,
                        price,
                        categoryId:
                            form.categoryId,
                        brandId:
                            form.brandId,
                        stock,
                    });

                /*
                 * Only upload if the seller selected
                 * a new image.
                 *
                 * The backend will reject this if
                 * the product already has an image.
                 */
                if (selectedImage) {
                    await uploadSellerProductImage({
                        productId:
                            productToEdit.id,
                        file:
                            selectedImage,
                    });
                }

                onToast(
                    selectedImage
                        ? 'Product updated and image uploaded successfully.'
                        : 'Product updated successfully.',
                );
            } else {
                product =
                    await createSellerProduct({
                        name:
                            form.name,
                        description:
                            form.description,
                        price,
                        categoryId:
                            form.categoryId,
                        brandId:
                            form.brandId,
                        stock,
                    });

                /*
                 * Product creation succeeded.
                 * Now upload its image using the newly
                 * created product ID.
                 */
                await uploadSellerProductImage({
                    productId:
                        product.id,
                    file:
                        selectedImage,
                });

                onToast(
                    'Product saved as a draft with image.',
                );
            }

            onProductCreated(product);

            setForm(INITIAL_FORM);
            setSelectedImage(null);

            if (imagePreview) {
                URL.revokeObjectURL(
                    imagePreview,
                );
            }

            setImagePreview('');

            onClose();
        } catch (error) {
            onToast(
                error.message ||
                (
                    isEditMode
                        ? 'Unable to update product.'
                        : 'Unable to create product.'
                ),
            );
        } finally {
            setIsSubmitting(false);
        }
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
                    aria-label={
                        isEditMode
                            ? 'Close edit product'
                            : 'Close add product'
                    }
                >
                    ×
                </button>

                <div className="eyebrow">
                    Inventory
                </div>

                <h2>
                    {isEditMode
                        ? 'Edit your product.'
                        : 'Add a product.'}
                </h2>

                <p>
                    {isEditMode
                        ? 'Update your product listing. Changes will remain in draft until you publish it.'
                        : 'Create your product listing. It will be saved as a draft until you are ready to publish it.'}
                </p>

                <form
                    onSubmit={handleSubmit}
                >
                    <div className="field">
                        <label htmlFor="product-name">
                            Product name
                        </label>

                        <input
                            id="product-name"
                            name="name"
                            type="text"
                            required
                            maxLength={200}
                            value={form.name}
                            onChange={
                                handleChange
                            }
                            placeholder="What are you selling?"
                            disabled={
                                isSubmitting
                            }
                        />
                    </div>

                    <div className="field">
                        <label htmlFor="product-description">
                            Description
                        </label>

                        <textarea
                            id="product-description"
                            name="description"
                            maxLength={5000}
                            value={
                                form.description
                            }
                            onChange={
                                handleChange
                            }
                            placeholder="Tell students what makes this product useful."
                            disabled={
                                isSubmitting
                            }
                        ></textarea>
                    </div>

                    <div className="field">
                        <label htmlFor="product-price">
                            Price
                        </label>

                        <input
                            id="product-price"
                            name="price"
                            type="number"
                            required
                            min="0"
                            step="0.01"
                            value={form.price}
                            onChange={
                                handleChange
                            }
                            placeholder="0.00"
                            disabled={
                                isSubmitting
                            }
                        />
                    </div>

                    <div className="field">
                        <label htmlFor="product-stock">
                            Stock
                        </label>

                        <input
                            id="product-stock"
                            name="stock"
                            type="number"
                            required
                            min="0"
                            step="1"
                            value={form.stock}
                            onChange={
                                handleChange
                            }
                            placeholder="0"
                            disabled={
                                isSubmitting
                            }
                        />
                    </div>

                    <div className="field">
                        <label htmlFor="product-category">
                            Category
                        </label>

                        <select
                            id="product-category"
                            name="categoryId"
                            required
                            value={
                                form.categoryId
                            }
                            onChange={
                                handleChange
                            }
                            disabled={
                                isSubmitting ||
                                isLoadingOptions
                            }
                        >
                            <option value="">
                                {isLoadingOptions
                                    ? 'Loading categories...'
                                    : 'Select a category'}
                            </option>

                            {categories.map(
                                (category) => (
                                    <option
                                        key={
                                            category.id
                                        }
                                        value={
                                            category.id
                                        }
                                    >
                                        {
                                            category.name
                                        }
                                    </option>
                                ),
                            )}
                        </select>
                    </div>

                    <div className="field">
                        <label htmlFor="product-brand">
                            Brand
                        </label>

                        <select
                            id="product-brand"
                            name="brandId"
                            required
                            value={
                                form.brandId
                            }
                            onChange={
                                handleChange
                            }
                            disabled={
                                isSubmitting ||
                                isLoadingOptions
                            }
                        >
                            <option value="">
                                {isLoadingOptions
                                    ? 'Loading brands...'
                                    : 'Select a brand'}
                            </option>

                            {brands.map(
                                (brand) => (
                                    <option
                                        key={
                                            brand.id
                                        }
                                        value={
                                            brand.id
                                        }
                                    >
                                        {
                                            brand.name
                                        }
                                    </option>
                                ),
                            )}
                        </select>
                    </div>

                    <div className="field">
                        <label htmlFor="product-image">
                            Product image
                        </label>

                        <input
                            id="product-image"
                            name="image"
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={
                                handleImageChange
                            }
                            disabled={
                                isSubmitting
                            }
                        />

                        <small>
                            JPEG, PNG, or WebP ·
                            maximum 5 MB
                        </small>

                        {imagePreview && (
                            <div
                                style={{
                                    marginTop:
                                        '12px',
                                }}
                            >
                                <img
                                    src={
                                        imagePreview
                                    }
                                    alt="Product preview"
                                    style={{
                                        display:
                                            'block',
                                        width:
                                            '100%',
                                        maxHeight:
                                            '220px',
                                        objectFit:
                                            'contain',
                                        borderRadius:
                                            '12px',
                                    }}
                                />
                            </div>
                        )}
                    </div>

                    <button
                        className="primary"
                        type="submit"
                        disabled={
                            isSubmitting ||
                            isLoadingOptions
                        }
                    >
                        {isSubmitting
                            ? 'SAVING...'
                            : isEditMode
                                ? 'SAVE CHANGES →'
                                : 'SAVE AS DRAFT →'}
                    </button>
                </form>
            </div>
        </div>
    );
}