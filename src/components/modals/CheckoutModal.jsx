import React, { useState } from 'react';

export default function CheckoutModal({
  isOpen,
  onClose,
  cart,
  increaseQuantity,
  decreaseQuantity,
  removeFromCart,
  onPlaceOrder,
}) {
  const [customerName, setCustomerName] =
    useState('');

  const [customerPhone, setCustomerPhone] =
    useState('');

  if (!isOpen) return null;

  const total = cart.reduce((sum, item) => {
    return (
      sum +
      Number(item.price) * item.quantity
    );
  }, 0);

  const fmt = (number) =>
    '₹' +
    Number(number).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const handleSubmit = (event) => {
    event.preventDefault();

    onPlaceOrder({
      customerName:
        customerName.trim(),
      customerPhone:
        customerPhone.trim(),
    });
  };

  return (
    <div
      className={`modal ${isOpen ? 'show' : ''}`}
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
          aria-label="Close checkout"
        >
          ×
        </button>

        <h2>Your bag.</h2>

        <p>
          {cart.length === 0
            ? 'Your bag is waiting for its first good thing.'
            : 'Almost there. Enter your delivery details below.'}
        </p>

        {cart.length > 0 && (
          <div>
            <div id="checkoutItems">
              {cart.map((item) => (
                <div
                  key={item.productId}
                  className="checkout-product"
                >
                  <div>
                    <span>
                      {item.name}
                    </span>

                    <div
                      style={{
                        display: 'flex',
                        alignItems:
                          'center',
                        gap: '10px',
                        marginTop:
                          '8px',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          decreaseQuantity(
                            item.productId,
                          )
                        }
                        aria-label={`Decrease quantity of ${item.name}`}
                      >
                        −
                      </button>

                      <strong>
                        {item.quantity}
                      </strong>

                      <button
                        type="button"
                        onClick={() =>
                          increaseQuantity(
                            item.productId,
                          )
                        }
                        aria-label={`Increase quantity of ${item.name}`}
                      >
                        +
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          removeFromCart(
                            item.productId,
                          )
                        }
                        aria-label={`Remove ${item.name} from bag`}
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <b>
                    {fmt(
                      Number(
                        item.price,
                      ) *
                      item.quantity,
                    )}
                  </b>
                </div>
              ))}

              <div className="checkout-product">
                <strong>Total</strong>

                <strong>
                  {fmt(total)}
                </strong>
              </div>
            </div>

            <form
              id="orderForm"
              onSubmit={handleSubmit}
            >
              <div className="field">
                <label htmlFor="checkout-name">
                  Full name
                </label>

                <input
                  id="checkout-name"
                  type="text"
                  value={customerName}
                  onChange={(event) =>
                    setCustomerName(
                      event.target.value,
                    )
                  }
                  required
                  maxLength={100}
                  autoComplete="name"
                  placeholder="Your name"
                />
              </div>

              <div className="field">
                <label htmlFor="checkout-phone">
                  Phone number
                </label>

                <input
                  id="checkout-phone"
                  type="tel"
                  value={customerPhone}
                  onChange={(event) =>
                    setCustomerPhone(
                      event.target.value,
                    )
                  }
                  required
                  maxLength={20}
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="Your phone number"
                />
              </div>

              <div className="field">
                <label>
                  Delivery location
                </label>

                <input
                  type="text"
                  value="Square One, Chitkara University"
                  readOnly
                />
              </div>

              <div className="cod">
                <b>₹</b>

                <span>
                  <strong>
                    Cash on delivery
                  </strong>
                  <br />
                  Pay only when your order arrives.
                </span>
              </div>

              <button
                className="primary"
                type="submit"
              >
                PLACE COD ORDER →
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}