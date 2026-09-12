import React, { useEffect, useState } from 'react';
import {
    getSellerApplication,
    submitSellerApplication,
} from './sellerApplicationStore';
import {
    SELLER_APPLICATION_STATUS,
} from './sellerApplicationConstants';

const INITIAL_FORM = {
    fullName: '',
    email: '',
    shopName: '',
    productType: '',
    description: '',
    phone: '',
    acceptsRules: false,
};

export default function SellerApplicationModal({
    isOpen,
    onClose,
    onToast,
}) {
    const [form, setForm] = useState(INITIAL_FORM);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [application, setApplication] = useState(null);
    const [isLoadingApplication, setIsLoadingApplication] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        let isMounted = true;

        const loadApplication = async () => {
            setIsLoadingApplication(true);

            try {
                const existingApplication = await getSellerApplication();

                if (isMounted) {
                    setApplication(existingApplication);
                }
            } catch (error) {
                if (isMounted) {
                    onToast(
                        error.message ||
                        'Unable to load seller application status.',
                    );
                }
            } finally {
                if (isMounted) {
                    setIsLoadingApplication(false);
                }
            }
        };

        loadApplication();

        return () => {
            isMounted = false;
        };
    }, [isOpen, onToast]);

    if (!isOpen) {
        return null;
    }

    const handleChange = (event) => {
        const { name, value, type, checked } = event.target;

        setForm((currentForm) => ({
            ...currentForm,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!form.acceptsRules) {
            onToast('Please accept the seller guidelines first.');
            return;
        }

        setIsSubmitting(true);

        try {
            const submittedApplication =
                await submitSellerApplication(form);

            setApplication(submittedApplication);
            setForm(INITIAL_FORM);
            onClose();

            onToast(
                'Application submitted. We’ll review your seller request.',
            );
        } catch (error) {
            onToast(
                error.message ||
                'Unable to submit seller application.',
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const isPending =
        application?.status === SELLER_APPLICATION_STATUS.PENDING;
    const isApproved =
        application?.status === SELLER_APPLICATION_STATUS.APPROVED;

    return (
        <div
            className={`modal ${isOpen ? 'show' : ''}`}
            onClick={(event) => {
                if (event.target.classList.contains('modal')) {
                    onClose();
                }
            }}
        >
            <div className="modal-card">
                <button
                    className="close"
                    type="button"
                    onClick={onClose}
                    aria-label="Close seller application"
                >
                    ×
                </button>

                {isLoadingApplication ? (
                    <div>
                        <h2>Checking your application.</h2>

                        <p>
                            We’re checking whether you already have a seller
                            application.
                        </p>
                    </div>
                ) : isPending ? (
                    <div>
                        <h2>Application received.</h2>

                        <p>
                            Your seller application is currently being
                            reviewed. We’ll let you know when there’s an
                            update.
                        </p>

                        <div className="cod">
                            <b>✦</b>

                            <span>
                                <strong>STATUS: PENDING</strong>
                                <br />
                                Your application is with the Campus Store team.
                            </span>
                        </div>

                        <button
                            className="primary"
                            type="button"
                            onClick={onClose}
                        >
                            GOT IT →
                        </button>
                    </div>
                ) : isApproved ? (
                    <div>
                        <h2>Your shelf is open.</h2>

                        <p>
                            Your seller application has been approved.
                            You can now start building your shop on the
                            marketplace.
                        </p>

                        <div className="cod">
                            <b>✦</b>

                            <span>
                                <strong>STATUS: APPROVED</strong>
                                <br />
                                You’re officially a Campus Store seller.
                            </span>
                        </div>

                        <button
                            className="primary"
                            type="button"
                            onClick={onClose}
                        >
                            GOT IT →
                        </button>
                    </div>
                ) : (
                    <div>
                        <h2>Open your shelf.</h2>

                        <p>
                            Sell to students across campus. Tell us a little
                            about your store and what you want to bring to the
                            marketplace.
                        </p>

                        <form onSubmit={handleSubmit}>
                            <div className="field">
                                <label htmlFor="seller-full-name">
                                    Full name
                                </label>

                                <input
                                    id="seller-full-name"
                                    name="fullName"
                                    required
                                    value={form.fullName}
                                    onChange={handleChange}
                                    placeholder="Your name"
                                />
                            </div>

                            <div className="field">
                                <label htmlFor="seller-email">
                                    Chitkara email
                                </label>

                                <input
                                    id="seller-email"
                                    name="email"
                                    required
                                    type="email"
                                    value={form.email}
                                    onChange={handleChange}
                                    placeholder="you@chitkara.edu.in"
                                />
                            </div>

                            <div className="field">
                                <label htmlFor="seller-shop-name">
                                    Shop name
                                </label>

                                <input
                                    id="seller-shop-name"
                                    name="shopName"
                                    required
                                    value={form.shopName}
                                    onChange={handleChange}
                                    placeholder="What should your shelf be called?"
                                />
                            </div>

                            <div className="field">
                                <label htmlFor="seller-product-type">
                                    What do you want to sell?
                                </label>

                                <input
                                    id="seller-product-type"
                                    name="productType"
                                    required
                                    value={form.productType}
                                    onChange={handleChange}
                                    placeholder="e.g. Art prints, jewellery, snacks"
                                />
                            </div>

                            <div className="field">
                                <label htmlFor="seller-description">
                                    Tell us about your store
                                </label>

                                <textarea
                                    id="seller-description"
                                    name="description"
                                    required
                                    value={form.description}
                                    onChange={handleChange}
                                    placeholder="What makes your products useful or special for students?"
                                ></textarea>
                            </div>

                            <div className="field">
                                <label htmlFor="seller-phone">
                                    Phone number
                                </label>

                                <input
                                    id="seller-phone"
                                    name="phone"
                                    required
                                    type="tel"
                                    value={form.phone}
                                    onChange={handleChange}
                                    placeholder="Your phone number"
                                />
                            </div>

                            <label className="switch">
                                <input
                                    name="acceptsRules"
                                    type="checkbox"
                                    checked={form.acceptsRules}
                                    onChange={handleChange}
                                />

                                <span>
                                    I agree to follow Campus Store seller
                                    guidelines and understand that applications
                                    require admin approval.
                                </span>
                            </label>

                            <button
                                className="primary"
                                type="submit"
                                disabled={isSubmitting}
                            >
                                {isSubmitting
                                    ? 'SUBMITTING...'
                                    : 'APPLY TO SELL →'}
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}