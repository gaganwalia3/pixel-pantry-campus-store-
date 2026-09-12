import React, { useState } from 'react';

import {
    getCsrfToken,
    signIn,
    signUp,
} from './authStore';

const INITIAL_SIGN_IN_FORM = {
    email: '',
    password: '',
};

const INITIAL_SIGN_UP_FORM = {
    name: '',
    email: '',
    password: '',
};

export default function AuthModal({
    isOpen,
    onClose,
    onToast,
    onAuthenticated,
}) {
    const [isSignUp, setIsSignUp] = useState(false);

    const [signInForm, setSignInForm] = useState(
        INITIAL_SIGN_IN_FORM,
    );

    const [signUpForm, setSignUpForm] = useState(
        INITIAL_SIGN_UP_FORM,
    );

    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) {
        return null;
    }

    const handleSignInChange = (event) => {
        const { name, value } = event.target;

        setSignInForm((currentForm) => ({
            ...currentForm,
            [name]: value,
        }));
    };

    const handleSignUpChange = (event) => {
        const { name, value } = event.target;

        setSignUpForm((currentForm) => ({
            ...currentForm,
            [name]: value,
        }));
    };

    const handleSignIn = async (event) => {
        event.preventDefault();

        if (isSubmitting) {
            return;
        }

        setIsSubmitting(true);

        try {
            const csrfToken = await getCsrfToken();

            const session = await signIn({
                email: signInForm.email,
                password: signInForm.password,
                csrfToken,
            });

            onAuthenticated(session);

            setSignInForm(INITIAL_SIGN_IN_FORM);

            onClose();

            onToast(
                `Welcome back, ${session.user.name}.`,
            );
        } catch (error) {
            onToast(
                error.message || 'Unable to sign in.',
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSignUp = async (event) => {
        event.preventDefault();

        if (isSubmitting) {
            return;
        }

        setIsSubmitting(true);

        try {
            const csrfToken = await getCsrfToken();

            await signUp({
                name: signUpForm.name,
                email: signUpForm.email,
                password: signUpForm.password,
                csrfToken,
            });

            const loginCsrfToken = await getCsrfToken();

            const session = await signIn({
                email: signUpForm.email,
                password: signUpForm.password,
                csrfToken: loginCsrfToken,
            });

            onAuthenticated(session);

            setSignUpForm(INITIAL_SIGN_UP_FORM);

            onClose();

            onToast(
                `Account created! Welcome, ${session.user.name}.`,
            );
        } catch (error) {
            onToast(
                error.message || 'Unable to create account.',
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
                    event.target.classList.contains('modal')
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
                    aria-label="Close authentication"
                    disabled={isSubmitting}
                >
                    ×
                </button>

                {!isSignUp ? (
                    <div>
                        <h2>Welcome back.</h2>

                        <p>
                            Sign in to save your shelf, follow orders,
                            and make checkout quicker.
                        </p>

                        <form onSubmit={handleSignIn}>
                            <div className="field">
                                <label htmlFor="signin-email">
                                    Email address
                                </label>

                                <input
                                    id="signin-email"
                                    name="email"
                                    required
                                    type="email"
                                    value={signInForm.email}
                                    onChange={handleSignInChange}
                                    placeholder="you@example.com"
                                    autoComplete="email"
                                    disabled={isSubmitting}
                                />
                            </div>

                            <div className="field">
                                <label htmlFor="signin-password">
                                    Password
                                </label>

                                <input
                                    id="signin-password"
                                    name="password"
                                    required
                                    type="password"
                                    value={signInForm.password}
                                    onChange={handleSignInChange}
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                    disabled={isSubmitting}
                                />
                            </div>

                            <button
                                className="primary"
                                type="submit"
                                disabled={isSubmitting}
                            >
                                {isSubmitting
                                    ? 'SIGNING IN...'
                                    : 'SIGN IN →'}
                            </button>
                        </form>

                        <p className="switch">
                            New around here?{' '}

                            <button
                                type="button"
                                onClick={() => setIsSignUp(true)}
                                disabled={isSubmitting}
                            >
                                Create an account
                            </button>
                        </p>
                    </div>
                ) : (
                    <div>
                        <h2>Make it yours.</h2>

                        <p>
                            Create an account for saved favourites
                            and gentler checkouts.
                        </p>

                        <form onSubmit={handleSignUp}>
                            <div className="field">
                                <label htmlFor="signup-name">
                                    Your name
                                </label>

                                <input
                                    id="signup-name"
                                    name="name"
                                    required
                                    value={signUpForm.name}
                                    onChange={handleSignUpChange}
                                    placeholder="Your name"
                                    autoComplete="name"
                                    disabled={isSubmitting}
                                />
                            </div>

                            <div className="field">
                                <label htmlFor="signup-email">
                                    Email address
                                </label>

                                <input
                                    id="signup-email"
                                    name="email"
                                    required
                                    type="email"
                                    value={signUpForm.email}
                                    onChange={handleSignUpChange}
                                    placeholder="you@example.com"
                                    autoComplete="email"
                                    disabled={isSubmitting}
                                />
                            </div>

                            <div className="field">
                                <label htmlFor="signup-password">
                                    Create password
                                </label>

                                <input
                                    id="signup-password"
                                    name="password"
                                    required
                                    type="password"
                                    minLength={8}
                                    value={signUpForm.password}
                                    onChange={handleSignUpChange}
                                    placeholder="Choose something secure"
                                    autoComplete="new-password"
                                    disabled={isSubmitting}
                                />
                            </div>

                            <button
                                className="primary"
                                type="submit"
                                disabled={isSubmitting}
                            >
                                {isSubmitting
                                    ? 'CREATING ACCOUNT...'
                                    : 'CREATE ACCOUNT →'}
                            </button>
                        </form>

                        <p className="switch">
                            Already a member?{' '}

                            <button
                                type="button"
                                onClick={() => setIsSignUp(false)}
                                disabled={isSubmitting}
                            >
                                Sign in
                            </button>
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}