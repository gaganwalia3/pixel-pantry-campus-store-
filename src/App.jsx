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
  getPublicBrands,
  getPublicCategories,
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

const API_URL =
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000';

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

  /*
   * ============================================================
   * MARKETPLACE FILTER STATE
   * ============================================================
   *
   * Empty string means no filter.
   *
   * Categories and brands are identified by their
   * database slugs.
   */
  const [
    activeCategory,
    setActiveCategory,
  ] = useState('');

  const [
    activeBrand,
    setActiveBrand,
  ] = useState('');

  const [
    searchQuery,
    setSearchQuery,
  ] = useState('');

  const [
    debouncedSearchQuery,
    setDebouncedSearchQuery,
  ] = useState('');

  /*
   * ============================================================
   * MARKETPLACE DATA
   * ============================================================
   */
  const [
    categories,
    setCategories,
  ] = useState([]);

  const [
    brands,
    setBrands,
  ] = useState([]);

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

  const [
    catalogDefinitionsError,
    setCatalogDefinitionsError,
  ] = useState('');

  /*
   * ============================================================
   * MODAL STATE
   * ============================================================
   */
  const [
    authOpen,
    setAuthOpen,
  ] = useState(false);

  const [
    requestOpen,
    setRequestOpen,
  ] = useState(false);

  const [
    checkoutOpen,
    setCheckoutOpen,
  ] = useState(false);

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

  /*
   * ============================================================
   * SESSION
   * ============================================================
   */
  const [
    session,
    setSession,
  ] = useState({
    isAuthenticated: false,
    user: null,
  });

  /*
   * ============================================================
   * TOAST
   * ============================================================
   */
  const [
    toastMsg,
    setToastMsg,
  ] = useState('');

  const [
    toastShow,
    setToastShow,
  ] = useState(false);

  /*
   * ============================================================
   * CHECKOUT IDEMPOTENCY
   * ============================================================
   *
   * One idempotency key is kept for the current checkout
   * attempt so browser/network retries reuse the exact same key.
   *
   * The key is cleared only after successful checkout.
   */
  const checkoutIdempotencyKeyRef =
    useRef(null);

  /*
   * ============================================================
   * SEARCH DEBOUNCE
   * ============================================================
   *
   * Search input updates immediately for the UI.
   *
   * Marketplace requests wait 300ms after the user stops typing.
   */
  useEffect(() => {
    const timer =
      window.setTimeout(() => {
        setDebouncedSearchQuery(
          searchQuery.trim(),
        );
      }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  /*
   * ============================================================
   * LOAD SESSION
   * ============================================================
   */
  useEffect(() => {
    const loadSession =
      async () => {
        const currentSession =
          await getSession();

        setSession(
          currentSession,
        );
      };

    loadSession();
  }, []);

  /*
   * ============================================================
   * LOAD CATEGORIES + BRANDS
   * ============================================================
   *
   * These are catalog definitions and are loaded directly
   * from the database through the public API.
   *
   * No category or brand list is hardcoded in the frontend.
   */
  useEffect(() => {
    let cancelled = false;

    const loadCatalogDefinitions =
      async () => {
        try {
          setCatalogDefinitionsError(
            '',
          );

          const [
            loadedCategories,
            loadedBrands,
          ] = await Promise.all([
            getPublicCategories(),
            getPublicBrands(),
          ]);

          if (cancelled) {
            return;
          }

          setCategories(
            loadedCategories,
          );

          setBrands(
            loadedBrands,
          );
        } catch (error) {
          console.error(
            'Catalog definitions failed to load:',
            error,
          );

          if (!cancelled) {
            setCatalogDefinitionsError(
              error.message ||
              'Unable to load marketplace categories and brands.',
            );
          }
        }
      };

    loadCatalogDefinitions();

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * ============================================================
   * LOAD MARKETPLACE PRODUCTS
   * ============================================================
   *
   * Filtering is performed by the backend/database.
   *
   * The frontend does not download a complete catalog and
   * perform its own category/brand/search filtering.
   *
   * Category and brand changes apply immediately.
   *
   * Search is represented by debouncedSearchQuery so the
   * backend is not called on every keystroke.
   */
  useEffect(() => {
    let cancelled = false;

    const loadProducts =
      async () => {
        try {
          setProductsLoading(
            true,
          );

          setProductsError(
            '',
          );

          const products =
            await getPublicProducts({
              category:
                activeCategory,
              brand:
                activeBrand,
              search:
                debouncedSearchQuery,
            });

          if (cancelled) {
            return;
          }

          setMarketplaceProducts(
            products,
          );
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
            setProductsLoading(
              false,
            );
          }
        }
      };

    loadProducts();

    return () => {
      cancelled = true;
    };
  }, [
    activeCategory,
    activeBrand,
    debouncedSearchQuery,
  ]);

  /*
   * ============================================================
   * TOAST
   * ============================================================
   */
  const showToast = (
    message,
  ) => {
    setToastMsg(message);
    setToastShow(true);

    window.setTimeout(() => {
      setToastShow(false);
    }, 2700);
  };

  /*
   * ============================================================
   * AUTHENTICATION
   * ============================================================
   */
  const handleAuthenticated = (
    authenticatedSession,
  ) => {
    setSession(
      authenticatedSession,
    );
  };

  const handleLogout =
    async () => {
      try {
        const csrfToken =
          await getCsrfToken();

        await signOut({
          csrfToken,
        });

        setSession({
          isAuthenticated:
            false,
          user: null,
        });

        setAdminPanelOpen(
          false,
        );

        setSellerDashboardOpen(
          false,
        );

        setMyOrdersOpen(
          false,
        );

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

  /*
   * ============================================================
   * CART
   * ============================================================
   */
  const handleAddToCart = (
    product,
  ) => {
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
      if (
        !session?.isAuthenticated
      ) {
        showToast(
          'Please sign in before placing your order.',
        );

        return;
      }

      if (
        session?.user?.role ===
        'ADMIN'
      ) {
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
       */
      if (
        !checkoutIdempotencyKeyRef.current
      ) {
        if (
          !window.crypto ||
          typeof window.crypto
            .randomUUID !==
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

      const response =
        await fetch(
          `${API_URL}/api/orders`,
          {
            method: 'POST',
            credentials:
              'include',
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

      setCheckoutOpen(
        false,
      );

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
   * ============================================================
   * OPEN PRODUCT FROM MY ORDERS
   * ============================================================
   */
  const handleOpenProduct = (
    productId,
  ) => {
    setActiveCategory('');
    setActiveBrand('');
    setSearchQuery('');
    setDebouncedSearchQuery('');

    const targetProduct =
      marketplaceProducts.find(
        (product) =>
          String(product.id)
            .toLowerCase() ===
          String(productId)
            .toLowerCase(),
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
        productElement.scrollIntoView(
          {
            behavior: 'smooth',
            block: 'center',
          },
        );

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

  /*
   * ============================================================
   * CATEGORY FILTER
   * ============================================================
   */
  const handleCategorySelect = (
    categorySlug,
  ) => {
    setActiveCategory(
      categorySlug,
    );

    setActiveBrand('');
    setSearchQuery('');
    setDebouncedSearchQuery('');

    const catalogElement =
      document.getElementById(
        'catalog',
      );

    if (catalogElement) {
      catalogElement.scrollIntoView(
        {
          behavior: 'smooth',
          block: 'start',
        },
      );
    }
  };

  /*
   * ============================================================
   * BRAND FILTER
   * ============================================================
   */
  const handleBrandSelect = (
    brandSlug,
  ) => {
    setActiveBrand(
      brandSlug,
    );

    setActiveCategory('');
    setSearchQuery('');
    setDebouncedSearchQuery('');

    const catalogElement =
      document.getElementById(
        'catalog',
      );

    if (catalogElement) {
      catalogElement.scrollIntoView(
        {
          behavior: 'smooth',
          block: 'start',
        },
      );
    }
  };

  /*
   * ============================================================
   * SEARCH
   * ============================================================
   *
   * Search is handled by the backend/database.
   *
   * The input state updates immediately.
   * The marketplace request uses the debounced value.
   */
  const handleSearch = (
    query,
  ) => {
    setSearchQuery(query);
    setActiveCategory('');
    setActiveBrand('');
  };

  /*
   * ============================================================
   * ACCOUNT LABEL
   * ============================================================
   */
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
          accountLabel={
            accountLabel
          }
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
          onLogout={
            handleLogout
          }
          onOpenCheckout={() =>
            setCheckoutOpen(
              true,
            )
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
            setAdminPanelOpen(
              true,
            )
          }
          onOpenMyOrders={() =>
            setMyOrdersOpen(
              true,
            )
          }
        />

        <HeroSection
          onSearch={
            handleSearch
          }
          onOpenRequest={() =>
            setRequestOpen(true)
          }
        />

        <Ticker />

        {catalogDefinitionsError ? (
          <section
            id="categories"
            className="categories-section"
          >
            <div className="section-top">
              <div>
                <div className="eyebrow">
                  Find your corner
                </div>

                <h2>
                  Shop by brand
                </h2>
              </div>

              <span className="small-link">
                UNAVAILABLE
              </span>
            </div>

            <div className="empty">
              {catalogDefinitionsError}
            </div>
          </section>
        ) : (
          <CategoriesSection
            brands={brands}
            onSelectBrand={
              handleBrandSelect
            }
          />
        )}

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
                  display:
                    'block',
                }}
              >
                {productsError}
              </div>
            </div>
          </section>
        ) : (
          <CatalogSection
            products={
              marketplaceProducts
            }
            categories={
              categories
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
              setRequestOpen(
                true,
              )
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
        onToast={
          showToast
        }
        onAuthenticated={
          handleAuthenticated
        }
      />

      <RequestModal
        isOpen={requestOpen}
        onClose={() =>
          setRequestOpen(false)
        }
        onToast={
          showToast
        }
      />

      <CheckoutModal
        isOpen={
          checkoutOpen
        }
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
        onToast={
          showToast
        }
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
        onToast={
          showToast
        }
      />

      <AdminSellerApplications
        isOpen={
          adminPanelOpen
        }
        onClose={() =>
          setAdminPanelOpen(
            false,
          )
        }
        onToast={
          showToast
        }
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