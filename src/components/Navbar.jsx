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
  const [menuOpen, setMenuOpen] =
    useState(false);

  const [accountMenuOpen, setAccountMenuOpen] =
    useState(false);

  const [profileMenuOpen, setProfileMenuOpen] =
    useState(false);

  const closeMenu = () => {
    setMenuOpen(false);
  };

  const closeProfileMenu = () => {
    setProfileMenuOpen(false);
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
    closeProfileMenu();
    closeMenu();

    await onLogout();
  };

  const handleCheckout = () => {
    setAccountMenuOpen(false);
    closeProfileMenu();
    closeMenu();

    onOpenCheckout();
  };

  const handleMyOrders = () => {
    setAccountMenuOpen(false);
    closeProfileMenu();
    closeMenu();

    onOpenMyOrders();
  };

  const handleSellerDashboard = () => {
    setAccountMenuOpen(false);
    closeProfileMenu();
    closeMenu();

    onOpenSellerDashboard();
  };

  const handleAdminPanel = () => {
    setAccountMenuOpen(false);
    closeProfileMenu();
    closeMenu();

    onOpenAdminPanel();
  };

  const handleSellerApplication = () => {
    closeMenu();
    closeProfileMenu();

    onOpenSellerApplication();
  };

  const handleMobileProfileClick = () => {
    setMenuOpen(false);

    if (!isAuthenticated) {
      onOpenAuth();
      return;
    }

    setProfileMenuOpen(
      (open) => !open,
    );
  };

  return (
    <nav className="nav">
      {/* =====================================================
          BRAND
          ===================================================== */}
      <a
        href="#home"
        className="brand"
        onClick={() => {
          closeMenu();
          closeProfileMenu();
        }}
        aria-label="SUPER Campus home"
      >
        <span className="super-campus-logo">
          <span className="logo-super">
            SUPER
          </span>

          <span className="logo-campus">
            Campus
          </span>
        </span>
      </a>

      {/* =====================================================
          DESKTOP LINKS
          ===================================================== */}
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
          onClick={
            handleSellerApplication
          }
        >
          SELL WITH US
        </button>
      </div>

      {/* =====================================================
          NAV ACTIONS
          ===================================================== */}
      <div className="nav-actions">

        {/* ---------------------------------------------------
            DESKTOP ACCOUNT
            --------------------------------------------------- */}
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
            onClick={onOpenAuth}
          >
            SIGN IN
          </button>
        )}

        {/* ---------------------------------------------------
            MOBILE PROFILE BUTTON
            --------------------------------------------------- */}
        <button
          type="button"
          className="mobile-profile-button"
          onClick={
            handleMobileProfileClick
          }
          aria-label={
            isAuthenticated
              ? 'Open profile menu'
              : 'Sign in'
          }
          aria-expanded={
            profileMenuOpen
          }
          aria-haspopup="menu"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              cx="12"
              cy="8"
              r="3.5"
            />

            <path
              d="M5 20c.7-3.2 3.1-5 7-5s6.3 1.8 7 5"
            />
          </svg>
        </button>

        {/* ---------------------------------------------------
            BAG
            --------------------------------------------------- */}
        <button
          type="button"
          className="bag-button"
          onClick={handleCheckout}
          aria-label={
            `Open bag${cartCount > 0
              ? ` with ${cartCount} items`
              : ''
            }`
          }
        >
          <span>BAG</span>

          {cartCount > 0 && (
            <span className="bag-count">
              {cartCount}
            </span>
          )}
        </button>

        {/* ---------------------------------------------------
            HAMBURGER
            --------------------------------------------------- */}
        <button
          type="button"
          className="menu-toggle"
          aria-label={
            menuOpen
              ? 'Close menu'
              : 'Open menu'
          }
          aria-expanded={menuOpen}
          onClick={() => {
            setProfileMenuOpen(false);

            setMenuOpen(
              (open) => !open,
            );
          }}
        >
          {menuOpen ? '×' : '☰'}
        </button>
      </div>

      {/* =====================================================
          MOBILE PROFILE MENU
          ===================================================== */}
      <div
        className={`mobile-profile-menu ${profileMenuOpen
            ? 'open'
            : ''
          }`}
        role="menu"
      >
        {isAuthenticated ? (
          <>
            <div className="mobile-profile-header">
              <span className="mobile-profile-avatar">
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    cx="12"
                    cy="8"
                    r="3.5"
                  />

                  <path
                    d="M5 20c.7-3.2 3.1-5 7-5s6.3 1.8 7 5"
                  />
                </svg>
              </span>

              <span>
                {accountLabel}
              </span>
            </div>

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

      {/* =====================================================
          MOBILE NAVIGATION MENU
          ===================================================== */}
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
          onClick={
            handleSellerApplication
          }
        >
          SELL WITH US
        </button>
      </div>
    </nav>
  );
}