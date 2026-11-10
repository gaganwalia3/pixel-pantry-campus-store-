
import React, { useEffect, useState } from 'react';

import {
    getCsrfToken,
    signIn,
    signUp,
    verifyOtp,
    resendOtp,
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
const API_BASE_URL = import.meta.env.DEV
    ? 'http://localhost:5000'
    : 'https://campus-store-backend-dyy4.onrender.com';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

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

    const [stage, setStage] = useState('credentials');
    const [challengeId, setChallengeId] = useState('');
    const [otp, setOtp] = useState('');
    const [otpEmail, setOtpEmail] = useState('');
    const [resendCooldown, setResendCooldown] = useState(0);
    const handleGoogleSignIn = () => {
        if (isSubmitting) return;

        window.location.assign(
            `${API_BASE_URL}/api/auth/google`
        );
    };
    useEffect(() => {
        if (stage !== 'otp' || resendCooldown <= 0) {
            return undefined;
        }

        const timer = window.setTimeout(() => {
            setResendCooldown((current) =>
                Math.max(0, current - 1),
            );
        }, 1000);

        return () => window.clearTimeout(timer);
    }, [stage, resendCooldown]);

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

    const beginOtpStage = ({
        challenge,
        email,
        successMessage,
    }) => {
        setChallengeId(challenge.challengeId);
        setOtpEmail(email);
        setOtp('');
        setStage('otp');
        setResendCooldown(RESEND_COOLDOWN_SECONDS);

        if (successMessage) {
            onToast(successMessage);
        }
    };

    const handleSignIn = async (event) => {
        event.preventDefault();

        if (isSubmitting) {
            return;
        }

        setIsSubmitting(true);

        try {
            const csrfToken = await getCsrfToken();

            const result = await signIn({
                email: signInForm.email,
                password: signInForm.password,
                csrfToken,
            });

            if (!result.requiresOtp || !result.challengeId) {
                throw new Error(
                    'The server did not start email verification.',
                );
            }

            beginOtpStage({
                challenge: result,
                email: signInForm.email,
                successMessage:
                    'Verification code sent to your email.',
            });
        } catch (error) {
            onToast(error.message || 'Unable to sign in.');
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

            const result = await signUp({
                name: signUpForm.name,
                email: signUpForm.email,
                password: signUpForm.password,
                csrfToken,
            });

            if (!result.requiresOtp || !result.challengeId) {
                throw new Error(
                    'The server did not start email verification.',
                );
            }

            beginOtpStage({
                challenge: result,
                email: signUpForm.email,
                successMessage:
                    'Verification code sent to your email.',
            });
        } catch (error) {
            onToast(
                error.message || 'Unable to create account.',
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleOtpChange = (event) => {
        const value = event.target.value
            .replace(/\D/g, '')
            .slice(0, OTP_LENGTH);

        setOtp(value);
    };

    const handleVerifyOtp = async (event) => {
        event.preventDefault();

        if (isSubmitting || otp.length !== OTP_LENGTH) {
            return;
        }

        setIsSubmitting(true);

        try {
            const csrfToken = await getCsrfToken();

            const session = await verifyOtp({
                challengeId,
                otp,
                csrfToken,
            });

            if (!session.success || !session.user) {
                throw new Error(
                    'Email verification was not completed.',
                );
            }

            onAuthenticated({
                isAuthenticated: true,
                user: session.user,
            });

            setSignInForm(INITIAL_SIGN_IN_FORM);
            setSignUpForm(INITIAL_SIGN_UP_FORM);
            setOtp('');
            setChallengeId('');
            setOtpEmail('');
            setStage('credentials');

            onClose();

            onToast(
                isSignUp
                    ? `Account created! Welcome, ${session.user.name}.`
                    : `Welcome back, ${session.user.name}.`,
            );
        } catch (error) {
            onToast(
                error.message || 'Unable to verify the code.',
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResendOtp = async () => {
        if (
            isSubmitting ||
            resendCooldown > 0 ||
            !challengeId
        ) {
            return;
        }

        setIsSubmitting(true);

        try {
            const csrfToken = await getCsrfToken();

            await resendOtp({
                challengeId,
                csrfToken,
            });

            setOtp('');
            setResendCooldown(RESEND_COOLDOWN_SECONDS);

            onToast('A new verification code has been sent.');
        } catch (error) {
            onToast(
                error.message ||
                'Unable to resend the verification code.',
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleBackToCredentials = () => {
        if (isSubmitting) {
            return;
        }

        setStage('credentials');
        setChallengeId('');
        setOtp('');
        setOtpEmail('');
        setResendCooldown(0);
    };

    const handleClose = () => {
        if (isSubmitting) {
            return;
        }

        onClose();
    };

    return (
        <div
            className="modal show"
            onClick={(event) => {
                if (
                    event.target.classList.contains('modal') &&
                    !isSubmitting
                ) {
                    onClose();
                }
            }}
        >
            <div className="modal-card auth-modal-card">
                <button
                    className="close"
                    type="button"
                    onClick={handleClose}
                    aria-label="Close authentication"
                    disabled={isSubmitting}
                >
                    ×
                </button>

                {stage === 'otp' ? (
                    <div>
                        <h2>Check your email.</h2>

                        <p>
                            We sent a six-digit verification code to{' '}
                            <strong>{otpEmail}</strong>.
                        </p>

                        <form onSubmit={handleVerifyOtp}>
                            <div className="field">
                                <label htmlFor="auth-otp">
                                    Verification code
                                </label>

                                <input
                                    id="auth-otp"
                                    name="otp"
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    pattern="[0-9]{6}"
                                    maxLength={OTP_LENGTH}
                                    required
                                    value={otp}
                                    onChange={handleOtpChange}
                                    placeholder="000000"
                                    disabled={isSubmitting}
                                    aria-describedby="otp-help"
                                />

                                <small id="otp-help">
                                    Enter the six-digit code. It expires
                                    after 10 minutes.
                                </small>
                            </div>

                            <button
                                className="primary"
                                type="submit"
                                disabled={
                                    isSubmitting ||
                                    otp.length !== OTP_LENGTH
                                }
                            >
                                {isSubmitting
                                    ? 'VERIFYING...'
                                    : 'VERIFY EMAIL →'}
                            </button>
                        </form>

                        <p className="switch">
                            {resendCooldown > 0 ? (
                                <>
                                    Resend code in{' '}
                                    <strong>
                                        {resendCooldown}s
                                    </strong>
                                </>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleResendOtp}
                                    disabled={isSubmitting}
                                >
                                    Resend verification code
                                </button>
                            )}
                        </p>

                        <p className="switch">
                            <button
                                type="button"
                                onClick={handleBackToCredentials}
                                disabled={isSubmitting}
                            >
                                Back
                            </button>
                        </p>
                    </div>
                ) : !isSignUp ? (
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

                        <div className="auth-divider">
                            <span>OR</span>
                        </div>
                        <button
                            type="button"
                            className="google-auth-button"
                            onClick={handleGoogleSignIn}
                            disabled={isSubmitting}
                        >
                            <svg
                                className="google-icon"
                                viewBox="0 0 48 48"
                                aria-hidden="true"
                            >
                                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
                                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.76 7.18l7.73 6C44.42 37.91 46.98 31.84 46.98 24.55Z" />
                                <path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.52 2.56 10.78l7.97-6.19Z" />
                                <path fill="#34A853" d="M24 48c6.48 0 11.94-2.13 15.91-5.8l-7.73-6c-2.14 1.45-4.89 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
                            </svg>

                            Continue with Google
                        </button>

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
                                    maxLength={128}
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

                        <div className="auth-divider">
                            <span>OR</span>
                        </div>
                        <button
                            type="button"
                            className="google-auth-button"
                            onClick={handleGoogleSignIn}
                            disabled={isSubmitting}
                        >
                            <svg
                                className="google-icon"
                                viewBox="0 0 48 48"
                                aria-hidden="true"
                            >
                                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
                                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.76 7.18l7.73 6C44.42 37.91 46.98 31.84 46.98 24.55Z" />
                                <path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.52 2.56 10.78l7.97-6.19Z" />
                                <path fill="#34A853" d="M24 48c6.48 0 11.94-2.13 15.91-5.8l-7.73-6c-2.14 1.45-4.89 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
                            </svg>

                            Continue with Google
                        </button>

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
