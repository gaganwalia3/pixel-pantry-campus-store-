import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import useCart from './features/cart/useCart';

import {
  getCsrfToken,
  getSession,
  signOut,
} from './features/auth/authStore';

import {
  getPublicProducts,
} from './features/products/productStore';

import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
import Ticker from './components/Ticker';
import CategoriesSection from './components/CategoriesSection';
import CatalogSection from './components/CatalogSection';
import BenefitsSection from './components/BenefitsSection';
import Footer from './components/Footer';

import RequestModal from './components/modals/RequestModal';
import CheckoutModal from './components/modals/CheckoutModal';
import Toast from './components/Toast';

import AuthModal from './features/auth/AuthModal';

import SellerApplicationModal from './features/seller/application/SellerApplicationModal';
import AdminSellerApplications from './features/admin/AdminSellerApplications';
import SellerDashboard from './features/seller/dashboard/SellerDashboard';
import MyOrders from './features/orders/MyOrders';

export default function App() {
  const {
    cart,
    addToCart,
    increaseQuantity,
    decreaseQuantity,
    removeFromCart,
    clearCart,
    itemCount,
  } = useCart();

  const [
    activeCategory,
    setActiveCategory,
  ] = useState('All');

  const [
    searchQuery,
    setSearchQuery,
  ] = useState('');

  const [
    marketplaceProducts,
    setMarketplaceProducts,
  ] = useState([]);

  const [
    productsLoading,
    setProductsLoading,
  ] = useState(true);

  const [
    productsError,
    setProductsError,
  ] = useState('');

  const [authOpen, setAuthOpen] =
    useState(false);

  const [requestOpen, setRequestOpen] =
    useState(false);

  const [checkoutOpen, setCheckoutOpen] =
    useState(false);

  const [
    sellerApplicationOpen,
    setSellerApplicationOpen,
  ] = useState(false);

  const [
    adminPanelOpen,
    setAdminPanelOpen,
  ] = useState(false);

  const [
    sellerDashboardOpen,
    setSellerDashboardOpen,
  ] = useState(false);

  const [
    myOrdersOpen,
    setMyOrdersOpen,
  ] = useState(false);

  const [session, setSession] =
    useState({
      isAuthenticated: false,
      user: null,
    });

  const [toastMsg, setToastMsg] =
    useState('');

  const [toastShow, setToastShow] =
    useState(false);

  /*
   * ============================================================
   * CHECKOUT IDEMPOTENCY
   * ============================================================
   *
   * One idempotency key is kept for the current checkout
   * attempt so that browser/network retries reuse the
   * exact same key.
   *
   * The key is cleared only after a successful checkout.
   *
   * This prevents:
   *
   * - double-click duplicate orders
   * - frontend retries creating duplicates
   * - lost-response retries creating duplicates
   */
  const checkoutIdempotencyKeyRef =
    useRef(null);

  /*
   * Load the current session.
   */
  useEffect(() => {
    const loadSession = async () => {
      const currentSession =
        await getSession();

      setSession(currentSession);
    };

    loadSession();
  }, []);

  /*
   * Load public marketplace products
   * directly from the backend/database.
   */
  useEffect(() => {
    let cancelled = false;

    const loadProducts = async () => {
      try {
        setProductsLoading(true);
        setProductsError('');

        const products =
          await getPublicProducts();

        if (!cancelled) {
          setMarketplaceProducts(
            products,
          );
        }
      } catch (error) {
        console.error(
          'Marketplace products failed to load:',
          error,
        );

        if (!cancelled) {
          setProductsError(
            error.message ||
            'Unable to load marketplace products.',
          );
        }
      } finally {
        if (!cancelled) {
          setProductsLoading(false);
        }
      }
    };

    loadProducts();

    return () => {
      cancelled = true;
    };
  }, []);

  const showToast = (message) => {
    setToastMsg(message);
    setToastShow(true);

    window.setTimeout(() => {
      setToastShow(false);
    }, 2700);
  };

  const handleAuthenticated = (
    authenticatedSession,
  ) => {
    setSession(
      authenticatedSession,
    );
  };

  const handleLogout = async () => {
    try {
      const csrfToken =
        await getCsrfToken();

      await signOut({
        csrfToken,
      });

      setSession({
        isAuthenticated: false,
        user: null,
      });

      setAdminPanelOpen(false);
      setSellerDashboardOpen(false);
      setMyOrdersOpen(false);

      /*
       * A logged-out user must never reuse
       * the previous authenticated checkout key.
       */
      checkoutIdempotencyKeyRef.current =
        null;

      showToast(
        'You have been signed out.',
      );
    } catch (error) {
      showToast(
        error.message ||
        'Unable to sign out.',
      );
    }
  };

  const handleAddToCart = (product) => {
    const result =
      addToCart(product);

    if (!result?.success) {
      showToast(
        result?.message ||
        'Unable to add this product to your bag.',
      );

      return;
    }

    showToast(
      `${product.name} added to your bag`,
    );
  };

  /*
   * ============================================================
   * CREATE ORDER
   * ============================================================
   *
   * Create a real order through the backend.
   *
   * CUSTOMER and SELLER accounts can place
   * marketplace orders.
   *
   * ADMIN accounts cannot place customer orders.
   *
   * The frontend only sends:
   * - customer name
   * - customer phone
   * - product IDs
   * - requested quantities
   *
   * Prices, stock, sellers, totals,
   * payment method and delivery location
   * are enforced by the backend.
   */
  const handlePlaceOrder = async ({
    customerName,
    customerPhone,
  }) => {
    try {
      if (!session?.isAuthenticated) {
        showToast(
          'Please sign in before placing your order.',
        );

        return;
      }

      if (session?.user?.role === 'ADMIN') {
        showToast(
          'Admin accounts cannot place customer orders.',
        );

        return;
      }

      if (cart.length === 0) {
        showToast(
          'Your bag is empty.',
        );

        return;
      }

      /*
       * Generate the idempotency key only once
       * for the current checkout attempt.
       *
       * window.crypto.randomUUID() uses the
       * browser's cryptographically secure RNG.
       */
      if (
        !checkoutIdempotencyKeyRef.current
      ) {
        if (
          !window.crypto ||
          typeof window.crypto.randomUUID !==
          'function'
        ) {
          showToast(
            'Secure checkout is unavailable in this browser.',
          );

          return;
        }

        checkoutIdempotencyKeyRef.current =
          window.crypto.randomUUID();
      }

      const idempotencyKey =
        checkoutIdempotencyKeyRef.current;

      const csrfToken =
        await getCsrfToken();

      const response = await fetch(
        'http://localhost:5000/api/orders',
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type':
              'application/json',
            'X-CSRF-Token':
              csrfToken,
            'Idempotency-Key':
              idempotencyKey,
          },
          body: JSON.stringify({
            customerName,
            customerPhone,
            items: cart.map(
              (item) => ({
                productId:
                  item.productId,
                quantity:
                  item.quantity,
              }),
            ),
          }),
        },
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
          'Unable to place your order.',
        );
      }

      /*
       * The checkout completed successfully.
       *
       * Clear the key so the next checkout receives
       * a completely new idempotency key.
       */
      checkoutIdempotencyKeyRef.current =
        null;

      clearCart();
      setCheckoutOpen(false);

      showToast(
        `Order ${data.order.id} placed successfully!`,
      );
    } catch (error) {
      console.error(
        'Place order failed:',
        error,
      );

      /*
       * IMPORTANT:
       * Do NOT clear the idempotency key here.
       *
       * If the request failed because of a temporary
       * network problem, retrying must reuse the same
       * key so the backend can safely recover the
       * original order instead of creating another one.
       */
      showToast(
        error.message ||
        'Unable to place your order.',
      );
    }
  };

  /*
   * Open a product from My Orders.
   *
   * My Orders stores the product UUID from the
   * order snapshot. The marketplace loads its
   * current product UUID from the database.
   *
   * UUID comparison is therefore case-insensitive.
   */
  const handleOpenProduct = (
    productId,
  ) => {
    setActiveCategory('All');
    setSearchQuery('');

    const targetProduct =
      marketplaceProducts.find(
        (product) =>
          String(product.id).toLowerCase() ===
          String(productId).toLowerCase(),
      );

    if (!targetProduct) {
      showToast(
        'This product is no longer available on the marketplace.',
      );

      return;
    }

    const targetElementId =
      `product-${targetProduct.id}`;

    let attempts = 0;

    const findAndScroll = () => {
      const productElement =
        document.getElementById(
          targetElementId,
        );

      if (productElement) {
        productElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });

        productElement.classList.add(
          'product-focus',
        );

        window.setTimeout(() => {
          productElement.classList.remove(
            'product-focus',
          );
        }, 1800);

        return;
      }

      attempts += 1;

      /*
       * CatalogSection re-renders after the
       * category/search state changes.
       *
       * Retry for a short period instead of
       * incorrectly telling the customer that
       * the product disappeared.
       */
      if (attempts < 20) {
        window.requestAnimationFrame(
          findAndScroll,
        );

        return;
      }

      showToast(
        'This product is no longer available on the marketplace.',
      );
    };

    window.requestAnimationFrame(
      findAndScroll,
    );
  };

  const handleCategorySelect = (
    categoryKey,
  ) => {
    setActiveCategory(categoryKey);
    setSearchQuery('');

    const catalogElement =
      document.getElementById(
        'catalog',
      );

    if (catalogElement) {
      catalogElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  };

  const handleSearch = (query) => {
    setSearchQuery(query);

    if (query) {
      setActiveCategory('All');
    }
  };

  const normalizedSearchQuery =
    searchQuery
      .trim()
      .toLowerCase();

  const filteredProducts =
    marketplaceProducts.filter(
      (product) => {
        const matchesCategory =
          activeCategory === 'All' ||
          product.category ===
          activeCategory;

        const matchesSearch =
          !normalizedSearchQuery ||
          product.name
            .toLowerCase()
            .includes(
              normalizedSearchQuery,
            ) ||
          product.description
            ?.toLowerCase()
            .includes(
              normalizedSearchQuery,
            ) ||
          product.category
            .toLowerCase()
            .includes(
              normalizedSearchQuery,
            ) ||
          product.meta
            .toLowerCase()
            .includes(
              normalizedSearchQuery,
            ) ||
          product.brand?.name
            ?.toLowerCase()
            .includes(
              normalizedSearchQuery,
            ) ||
          product.seller?.shopName
            ?.toLowerCase()
            .includes(
              normalizedSearchQuery,
            );

        return (
          matchesCategory &&
          matchesSearch
        );
      },
    );

  const accountLabel =
    session?.isAuthenticated
      ? `HEY, ${session.user.name}`
      : 'SIGN IN';

  return (
    <>
      <div className="grain"></div>

      <main className="shell">
        <Navbar
          cartCount={itemCount}
          accountLabel={accountLabel}
          isAuthenticated={
            session?.isAuthenticated
          }
          isSeller={
            session?.user?.role ===
            'SELLER'
          }
          isAdmin={
            session?.user?.role ===
            'ADMIN'
          }
          onOpenAuth={() =>
            setAuthOpen(true)
          }
          onLogout={handleLogout}
          onOpenCheckout={() =>
            setCheckoutOpen(true)
          }
          onOpenSellerApplication={() =>
            setSellerApplicationOpen(
              true,
            )
          }
          onOpenSellerDashboard={() =>
            setSellerDashboardOpen(
              true,
            )
          }
          onOpenAdminPanel={() =>
            setAdminPanelOpen(true)
          }
          onOpenMyOrders={() =>
            setMyOrdersOpen(true)
          }
        />

        <HeroSection
          onSearch={handleSearch}
          onOpenRequest={() =>
            setRequestOpen(true)
          }
        />

        <Ticker />

        <CategoriesSection
          onSelectCategory={
            handleCategorySelect
          }
        />

        {productsLoading ? (
          <section
            className="catalog"
            id="catalog"
          >
            <div className="section-top">
              <div>
                <div className="eyebrow">
                  Shelf 001
                </div>

                <h2>
                  Good things, gathered
                </h2>
              </div>

              <span className="small-link">
                LOADING
              </span>
            </div>

            <div className="products">
              <div className="empty">
                Loading the shelf...
              </div>
            </div>
          </section>
        ) : productsError ? (
          <section
            className="catalog"
            id="catalog"
          >
            <div className="section-top">
              <div>
                <div className="eyebrow">
                  Shelf 001
                </div>

                <h2>
                  Good things, gathered
                </h2>
              </div>
            </div>

            <div className="products">
              <div
                className="empty"
                style={{
                  display: 'block',
                }}
              >
                {productsError}
              </div>
            </div>
          </section>
        ) : (
          <CatalogSection
            products={
              filteredProducts
            }
            activeCategory={
              activeCategory
            }
            onSelectCategory={
              handleCategorySelect
            }
            onAddToCart={
              handleAddToCart
            }
            onOpenRequest={() =>
              setRequestOpen(true)
            }
          />
        )}

        <BenefitsSection />

        <Footer />
      </main>

      <AuthModal
        isOpen={authOpen}
        onClose={() =>
          setAuthOpen(false)
        }
        onToast={showToast}
        onAuthenticated={
          handleAuthenticated
        }
      />

      <RequestModal
        isOpen={requestOpen}
        onClose={() =>
          setRequestOpen(false)
        }
        onToast={showToast}
      />

      <CheckoutModal
        isOpen={checkoutOpen}
        onClose={() =>
          setCheckoutOpen(false)
        }
        cart={cart}
        increaseQuantity={
          increaseQuantity
        }
        decreaseQuantity={
          decreaseQuantity
        }
        removeFromCart={
          removeFromCart
        }
        onPlaceOrder={
          handlePlaceOrder
        }
      />

      <SellerApplicationModal
        isOpen={
          sellerApplicationOpen
        }
        onClose={() =>
          setSellerApplicationOpen(
            false,
          )
        }
        onToast={showToast}
      />

      <SellerDashboard
        isOpen={
          sellerDashboardOpen
        }
        onClose={() =>
          setSellerDashboardOpen(
            false,
          )
        }
        onToast={showToast}
      />

      <AdminSellerApplications
        isOpen={adminPanelOpen}
        onClose={() =>
          setAdminPanelOpen(false)
        }
        onToast={showToast}
      />

      <MyOrders
        isOpen={myOrdersOpen}
        onClose={() =>
          setMyOrdersOpen(false)
        }
        session={session}
        onOpenProduct={
          handleOpenProduct
        }
      />

      <Toast
        message={toastMsg}
        visible={toastShow}
      />
    </>
  );
}