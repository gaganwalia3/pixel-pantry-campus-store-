import React, {
  useState,
} from 'react';

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
  const [menuOpen, setMenuOpen] =
    useState(false);

  const [accountMenuOpen, setAccountMenuOpen] =
    useState(false);

  const closeMenu = () => {
    setMenuOpen(false);
  };

  const handleSellerApplication = () => {
    closeMenu();
    onOpenSellerApplication();
  };

  const handleAuth = () => {
    closeMenu();

    if (!isAuthenticated) {
      onOpenAuth();
    }
  };

  const handleAccountClick = () => {
    if (!isAuthenticated) {
      onOpenAuth();
      return;
    }

    setAccountMenuOpen(
      (open) => !open,
    );
  };

  const handleLogout = async () => {
    setAccountMenuOpen(false);
    closeMenu();

    await onLogout();
  };

  const handleCheckout = () => {
    closeMenu();
    setAccountMenuOpen(false);
    onOpenCheckout();
  };

  const handleMyOrders = () => {
    setAccountMenuOpen(false);
    closeMenu();
    onOpenMyOrders();
  };

  const handleSellerDashboard = () => {
    setAccountMenuOpen(false);
    closeMenu();
    onOpenSellerDashboard();
  };

  const handleAdminPanel = () => {
    setAccountMenuOpen(false);
    closeMenu();
    onOpenAdminPanel();
  };

  return (
    <nav className="nav">
      <a
        href="#"
        className="brand"
        onClick={closeMenu}
      >
        <span className="brand-mark">
          <i></i>
          <i></i>
          <i></i>
          <i></i>
          <i></i>
          <i></i>
          <i></i>
          <i></i>
          <i></i>
          <i></i>
          <i></i>
        </span>

        <span className="brand-name">
          PIXEL PANTRY
        </span>

        <span className="brand-tagline">
          EVERYDAY ESSENTIALS
        </span>
      </a>

      <div className="nav-links">
        <a href="#catalog">
          CATALOG
        </a>

        <a href="#categories">
          CATEGORIES
        </a>

        <button
          type="button"
          onClick={
            handleSellerApplication
          }
        >
          SELL WITH US
        </button>
      </div>

      <div className="nav-actions">
        {isAuthenticated ? (
          <div className="account-area">
            <button
              type="button"
              className="account-greeting"
              onClick={
                handleAccountClick
              }
              aria-expanded={
                accountMenuOpen
              }
              aria-haspopup="menu"
            >
              {accountLabel}
            </button>

            {accountMenuOpen && (
              <div
                className="account-menu"
                role="menu"
              >
                {!isAdmin && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={
                      handleMyOrders
                    }
                  >
                    MY ORDERS
                  </button>
                )}

                {isSeller && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={
                      handleSellerDashboard
                    }
                  >
                    SELLER DASHBOARD
                  </button>
                )}

                {isAdmin && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={
                      handleAdminPanel
                    }
                  >
                    ADMIN PANEL
                  </button>
                )}

                <button
                  type="button"
                  role="menuitem"
                  onClick={
                    handleLogout
                  }
                >
                  LOG OUT
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={handleAuth}
          >
            SIGN IN
          </button>
        )}

        <button
          type="button"
          onClick={
            handleCheckout
          }
          aria-label={`Open bag${cartCount > 0
            ? ` with ${cartCount} items`
            : ''
            }`}
        >
          BAG

          {cartCount > 0 && (
            <span className="bag-count">
              {cartCount}
            </span>
          )}
        </button>

        <button
          type="button"
          className="menu-toggle"
          aria-label={
            menuOpen
              ? 'Close menu'
              : 'Open menu'
          }
          aria-expanded={menuOpen}
          onClick={() =>
            setMenuOpen(
              (open) => !open,
            )
          }
        >
          {menuOpen ? '×' : '☰'}
        </button>
      </div>

      <div
        className={`mobile-menu ${menuOpen ? 'open' : ''
          }`}
      >
        <a
          href="#catalog"
          onClick={closeMenu}
        >
          CATALOG
        </a>

        <a
          href="#categories"
          onClick={closeMenu}
        >
          CATEGORIES
        </a>

        <button
          type="button"
          onClick={
            handleSellerApplication
          }
        >
          SELL WITH US
        </button>

        {isAuthenticated ? (
          <>
            <div className="mobile-account-greeting">
              {accountLabel}
            </div>

            {!isAdmin && (
              <button
                type="button"
                onClick={
                  handleMyOrders
                }
              >
                MY ORDERS
              </button>
            )}

            {isSeller && (
              <button
                type="button"
                onClick={
                  handleSellerDashboard
                }
              >
                SELLER DASHBOARD
              </button>
            )}

            {isAdmin && (
              <button
                type="button"
                onClick={
                  handleAdminPanel
                }
              >
                ADMIN PANEL
              </button>
            )}

            <button
              type="button"
              onClick={
                handleLogout
              }
            >
              LOG OUT
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={handleAuth}
          >
            SIGN IN
          </button>
        )}

        <button
          type="button"
          onClick={
            handleCheckout
          }
        >
          BAG

          {cartCount > 0 && (
            <span className="bag-count">
              {cartCount}
            </span>
          )}
        </button>
      </div>
    </nav>
  );
}