import React, {
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

export default function Navbar({
  cartCount,
  accountLabel,
  isAuthenticated,
  isSeller,
  isAdmin,
  onOpenAuth,
  onLogout,
  onOpenCheckout,
  onOpenSellerApplication,
  onOpenSellerDashboard,
  onOpenAdminPanel,
  onOpenMyOrders,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [logoutSubmitting, setLogoutSubmitting] = useState(false);
  const logoutSubmittingRef = useRef(false);

  const accountGreetingRef = useRef(null);
  const mobileProfileButtonRef = useRef(null);
  const logoutReturnFocusRef = useRef(null);
  const logoutCancelRef = useRef(null);
  const logoutConfirmRef = useRef(null);

  const closeMenu = () => setMenuOpen(false);
  const closeProfileMenu = () => setProfileMenuOpen(false);

  const closeAccountAndNavigationMenus = () => {
    setAccountMenuOpen(false);
    closeProfileMenu();
    closeMenu();
  };

  const handleAccountClick = () => {
    if (!isAuthenticated) {
      onOpenAuth();
      return;
    }

    setAccountMenuOpen((open) => !open);
  };

  const handleLogout = (event) => {
    // Remember the visible control so focus can be restored after cancel.
    const isMobileMenuItem = Boolean(
      event.currentTarget.closest('.mobile-profile-menu'),
    );

    logoutReturnFocusRef.current = isMobileMenuItem
      ? mobileProfileButtonRef.current
      : accountGreetingRef.current;

    closeAccountAndNavigationMenus();
    setLogoutConfirmOpen(true);
  };

  const handleCancelLogout = () => {
    if (logoutSubmittingRef.current) return;
    setLogoutConfirmOpen(false);
  };

  const handleConfirmedLogout = async () => {
    if (logoutSubmittingRef.current) return;

    logoutSubmittingRef.current = true;
    setLogoutSubmitting(true);

    try {
      // Keep the existing App-level logout path: it handles CSRF,
      // server-side session invalidation, state cleanup, and error toasts.
      await onLogout();
    } finally {
      logoutSubmittingRef.current = false;
      setLogoutSubmitting(false);
      setLogoutConfirmOpen(false);
    }
  };

  useLayoutEffect(() => {
    if (!logoutConfirmOpen) return undefined;

    const body = document.body;
    const html = document.documentElement;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - html.clientWidth;

    // Portal the dialog to document.body and lock scrolling without fixing
    // body positioning, which can make the page jump vertically.
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';

    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    logoutCancelRef.current?.focus({ preventScroll: true });

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!logoutSubmittingRef.current) setLogoutConfirmOpen(false);
        return;
      }

      if (event.key !== 'Tab') return;

      const cancelButton = logoutCancelRef.current;
      const confirmButton = logoutConfirmRef.current;
      if (!cancelButton || !confirmButton) return;

      if (event.shiftKey && document.activeElement === cancelButton) {
        event.preventDefault();
        confirmButton.focus({ preventScroll: true });
      } else if (
        !event.shiftKey && document.activeElement === confirmButton
      ) {
        event.preventDefault();
        cancelButton.focus({ preventScroll: true });
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      body.style.overflow = previousBodyOverflow;
      html.style.overflow = previousHtmlOverflow;
      body.style.paddingRight = previousBodyPaddingRight;

      const returnFocus = logoutReturnFocusRef.current;
      if (returnFocus instanceof HTMLElement && returnFocus.isConnected) {
        returnFocus.focus({ preventScroll: true });
      }
      logoutReturnFocusRef.current = null;
    };
  }, [logoutConfirmOpen]);

  const handleCheckout = () => {
    closeAccountAndNavigationMenus();
    onOpenCheckout();
  };

  const handleMyOrders = () => {
    closeAccountAndNavigationMenus();
    onOpenMyOrders();
  };

  const handleSellerDashboard = () => {
    closeAccountAndNavigationMenus();
    onOpenSellerDashboard();
  };

  const handleAdminPanel = () => {
    closeAccountAndNavigationMenus();
    onOpenAdminPanel();
  };

  const handleSellerApplication = () => {
    closeMenu();
    closeProfileMenu();
    setAccountMenuOpen(false);
    onOpenSellerApplication();
  };

  const handleMobileProfileClick = () => {
    setMenuOpen(false);

    if (!isAuthenticated) {
      onOpenAuth();
      return;
    }

    setProfileMenuOpen((open) => !open);
  };

  return (
    <>
      <nav className="nav">
        {/* Brand */}
        <a
          href="#home"
          className="brand"
          onClick={() => {
            closeMenu();
            closeProfileMenu();
            setAccountMenuOpen(false);
          }}
          aria-label="SUPER Campus home"
        >
          <span className="super-campus-logo">
            <span className="logo-super">SUPER</span>
            <span className="logo-campus">Campus</span>
          </span>
        </a>

        {/* Desktop links */}
        <div className="nav-links">
          <a href="#catalog">SHOP</a>
          <a href="#categories">CATEGORIES</a>
          <a href="#categories">BRANDS</a>
          <button type="button" onClick={handleSellerApplication}>
            SELL WITH US
          </button>
        </div>

        {/* Account and bag actions */}
        <div className="nav-actions">
          {isAuthenticated ? (
            <div className="account-area">
              <button
                ref={accountGreetingRef}
                type="button"
                className="account-greeting"
                onClick={handleAccountClick}
                aria-expanded={accountMenuOpen}
                aria-haspopup="menu"
                aria-controls={accountMenuOpen ? 'desktop-account-menu' : undefined}
              >
                {accountLabel}
              </button>

              {accountMenuOpen && (
                <div
                  id="desktop-account-menu"
                  className="account-menu"
                  role="menu"
                  aria-label="Account menu"
                >
                  {!isAdmin && (
                    <button type="button" role="menuitem" onClick={handleMyOrders}>
                      MY ORDERS
                    </button>
                  )}

                  {isSeller && (
                    <button type="button" role="menuitem" onClick={handleSellerDashboard}>
                      SELLER DASHBOARD
                    </button>
                  )}

                  {isAdmin && (
                    <button type="button" role="menuitem" onClick={handleAdminPanel}>
                      ADMIN PANEL
                    </button>
                  )}

                  <button type="button" role="menuitem" onClick={handleLogout}>
                    LOG OUT
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              className="desktop-sign-in-button"
              onClick={onOpenAuth}
            >
              SIGN IN
            </button>
          )}

          {/* Mobile profile trigger */}
          <button
            ref={mobileProfileButtonRef}
            type="button"
            className="mobile-profile-button"
            hidden={!isAuthenticated}
            onClick={handleMobileProfileClick}
            aria-label={
              isAuthenticated
                ? 'Open profile menu'
                : 'Sign in'
            }
            aria-expanded={profileMenuOpen}
            aria-haspopup="menu"
            aria-controls={profileMenuOpen ? 'mobile-profile-menu' : undefined}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none">
              <circle cx="12" cy="8" r="3.5" />
              <path d="M5 20c.7-3.2 3.1-5 7-5s6.3 1.8 7 5" />
            </svg>
          </button>

          {/* Bag */}
          <button
            type="button"
            className="bag-button"
            onClick={handleCheckout}
            aria-label={`Open bag${cartCount > 0 ? ` with ${cartCount} items` : ''}`}
          >
            <span>BAG</span>
            {cartCount > 0 && <span className="bag-count">{cartCount}</span>}
          </button>

          {/* Mobile navigation toggle */}
          <button
            type="button"
            className="menu-toggle"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => {
              setProfileMenuOpen(false);
              setAccountMenuOpen(false);
              setMenuOpen((open) => !open);
            }}
          >
            {menuOpen ? '×' : '☰'}
          </button>
        </div>

        {/* Mobile profile menu */}
        <div
          id="mobile-profile-menu"
          className={`mobile-profile-menu ${profileMenuOpen ? 'open' : ''}`}
          role="menu"
          aria-label="Mobile account menu"
          hidden={!profileMenuOpen}
        >
          {isAuthenticated ? (
            <>
              <div className="mobile-profile-header">
                <span className="mobile-profile-avatar">
                  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none">
                    <circle cx="12" cy="8" r="3.5" />
                    <path d="M5 20c.7-3.2 3.1-5 7-5s6.3 1.8 7 5" />
                  </svg>
                </span>
                <span>{accountLabel}</span>
              </div>

              {!isAdmin && (
                <button type="button" role="menuitem" onClick={handleMyOrders}>
                  MY ORDERS
                </button>
              )}

              {isSeller && (
                <button type="button" role="menuitem" onClick={handleSellerDashboard}>
                  SELLER DASHBOARD
                </button>
              )}

              {isAdmin && (
                <button type="button" role="menuitem" onClick={handleAdminPanel}>
                  ADMIN PANEL
                </button>
              )}

              <button type="button" role="menuitem" onClick={handleLogout}>
                LOG OUT
              </button>
            </>
          ) : (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                closeProfileMenu();
                onOpenAuth();
              }}
            >
              SIGN IN
            </button>
          )}
        </div>

        {/* Mobile navigation menu */}
        <div className={`mobile-menu ${menuOpen ? 'open' : ''}`} hidden={!menuOpen}>
          <a href="#catalog" onClick={closeMenu}>SHOP</a>
          <a href="#categories" onClick={closeMenu}>CATEGORIES</a>
          <a href="#categories" onClick={closeMenu}>BRANDS</a>
          <button type="button" onClick={handleSellerApplication}>SELL WITH US</button>
        </div>
      </nav>

      {/* Render the dialog in document.body so parent overflow/stacking contexts
          cannot clip it. The server-side logout callback remains unchanged. */}
      {logoutConfirmOpen && createPortal(
        <div
          className="logout-confirm-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !logoutSubmitting) {
              handleCancelLogout();
            }
          }}
        >
          <section
            className="logout-confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="logout-confirm-title"
            aria-describedby="logout-confirm-description"
          >
            <div className="logout-confirm-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M10 17l5-5-5-5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M15 12H3"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <path
                  d="M12 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <div className="logout-confirm-eyebrow">ACCOUNT SESSION</div>
            <h2 id="logout-confirm-title">Leaving already?</h2>
            <p id="logout-confirm-description">
              Are you sure you want to log out of SUPER Campus? You&apos;ll need to sign in again to access your account.
            </p>

            <div className="logout-confirm-actions">
              <button
                ref={logoutCancelRef}
                type="button"
                className="logout-confirm-cancel"
                onClick={handleCancelLogout}
                disabled={logoutSubmitting}
              >
                Stay signed in
              </button>
              <button
                ref={logoutConfirmRef}
                type="button"
                className="logout-confirm-submit"
                onClick={handleConfirmedLogout}
                disabled={logoutSubmitting}
              >
                {logoutSubmitting ? 'Signing out…' : 'Log out'}
              </button>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
