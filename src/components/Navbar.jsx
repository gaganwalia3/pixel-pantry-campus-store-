import React, { useState } from 'react';

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
  const [accountMenuOpen, setAccountMenuOpen] =
    useState(false);

  const closeMenu = () => {
    setMenuOpen(false);
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
    setAccountMenuOpen(false);
    closeMenu();
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

  const handleSellerApplication = () => {
    closeMenu();
    onOpenSellerApplication();
  };

  return (
    <nav className="nav">
      <a
        href="#home"
        className="brand"
        onClick={closeMenu}
        aria-label="SUPER Daily home"
      >
        <span className="super-daily-logo">
          <span className="logo-super">
            SUPER
          </span>
          <span className="logo-daily">
            Daily
          </span>
        </span>
      </a>

      <div className="nav-links">
        <a href="#catalog">
          SHOP
        </a>

        <a href="#categories">
          CATEGORIES
        </a>

        <a href="#categories">
          BRANDS
        </a>

        <button
          type="button"
          onClick={handleSellerApplication}
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
              onClick={handleAccountClick}
              aria-expanded={accountMenuOpen}
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
                    onClick={handleMyOrders}
                  >
                    MY ORDERS
                  </button>
                )}

                {isSeller && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleSellerDashboard}
                  >
                    SELLER DASHBOARD
                  </button>
                )}

                {isAdmin && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleAdminPanel}
                  >
                    ADMIN PANEL
                  </button>
                )}

                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                >
                  LOG OUT
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenAuth}
          >
            SIGN IN
          </button>
        )}

        <button
          type="button"
          className="bag-button"
          onClick={handleCheckout}
          aria-label={`Open bag${cartCount > 0
              ? ` with ${cartCount} items`
              : ''
            }`}
        >
          <span className="bag-icon">
            🛍
          </span>
          <span>BAG</span>

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
          SHOP
        </a>

        <a
          href="#categories"
          onClick={closeMenu}
        >
          CATEGORIES
        </a>

        <a
          href="#categories"
          onClick={closeMenu}
        >
          BRANDS
        </a>

        <button
          type="button"
          onClick={handleSellerApplication}
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
                onClick={handleMyOrders}
              >
                MY ORDERS
              </button>
            )}

            {isSeller && (
              <button
                type="button"
                onClick={handleSellerDashboard}
              >
                SELLER DASHBOARD
              </button>
            )}

            {isAdmin && (
              <button
                type="button"
                onClick={handleAdminPanel}
              >
                ADMIN PANEL
              </button>
            )}

            <button
              type="button"
              onClick={handleLogout}
            >
              LOG OUT
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => {
              closeMenu();
              onOpenAuth();
            }}
          >
            SIGN IN
          </button>
        )}

        <button
          type="button"
          onClick={handleCheckout}
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
