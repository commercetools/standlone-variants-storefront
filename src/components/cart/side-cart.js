import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCart, updateCart } from '../../util/cart-util';
import { formatPrice } from '../../util/priceUtil';
import LineItemInfo from './line-item-info';
import LineItemPriceInfo from './line-item-price-info';
import AppContext from '../../appContext';

const SideCart = ({ isOpen, onClose }) => {
  const [context] = useContext(AppContext);
  const [cart, setCart] = useState(null);
  const [fetched, setFetched] = useState(false);
  const navigate = useNavigate();
  const currency = sessionStorage.getItem('currency') || context.currency || 'EUR';

  useEffect(() => {
    if (isOpen) {
      getCurrentCart();
    }
  }, [isOpen, cart]); // Include cart in dependencies to refresh when cart changes

  const getCurrentCart = async () => {
    if (fetched && cart) return cart;
    setFetched(true);
    const currentCart = await getCart();
    setCart(currentCart);
    setFetched(false); // Reset to allow refresh
  };

  const updateCartAndRefresh = async (action) => {
    const updatedCart = await updateCart(action);
    setCart(updatedCart);
    setFetched(false); // Allow refresh
  };

  const incrementQuantity = async (lineItem) => {
    const action = {
      action: 'changeLineItemQuantity',
      lineItemId: lineItem.id,
      quantity: lineItem.quantity + 1
    };
    if (lineItem.priceMode === 'ExternalPrice') {
      action.externalPrice = lineItem.price.value;
    }
    updateCartAndRefresh(action);
  };

  const decrementQuantity = async (lineItem) => {
    const action = {
      action: 'changeLineItemQuantity',
      lineItemId: lineItem.id,
      quantity: lineItem.quantity - 1
    };
    if (lineItem.priceMode === 'ExternalPrice') {
      action.externalPrice = lineItem.price.value;
    }
    updateCartAndRefresh(action);
  };

  const removeLineItem = async (lineItem) => {
    updateCartAndRefresh({
      action: 'removeLineItem',
      lineItemId: lineItem.id
    });
  };

  const getTotalDiscountAmount = (cart) => {
    let total = {
      centAmount: 0,
      currencyCode: currency
    };
    if (!cart) {
      return total;
    }
    cart.lineItems?.forEach(item => {
      item.discountedPricePerQuantity?.forEach(dppq => {
        dppq.discountedPrice.includedDiscounts?.forEach(included => {
          total.centAmount += included.discountedAmount.centAmount * dppq.quantity;
        });
      });
    });
    return total;
  };

  const totalDiscounts = cart ? getTotalDiscountAmount(cart) : null;
  const itemCount = cart?.lineItems?.length || 0;
  const totalItems = cart?.lineItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 999,
          transition: 'opacity 0.3s ease'
        }}
      />
      
      {/* Side Cart Panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '400px',
          maxWidth: '90vw',
          height: '100vh',
          backgroundColor: '#fff',
          boxShadow: '-2px 0 8px rgba(0,0,0,0.2)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px',
            borderBottom: '1px solid #ddd',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#f8f9fa'
          }}
        >
          <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
            🛒 Cart {totalItems > 0 && `(${totalItems})`}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#666',
              padding: '0 10px'
            }}
          >
            ×
          </button>
        </div>

        {/* Cart Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px'
          }}
        >
          {!cart ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666' }}>
              <p>No cart found.</p>
              <p style={{ fontSize: '14px' }}>Add items to your cart to see them here.</p>
            </div>
          ) : cart.error ? (
            <div style={{ color: 'red', padding: '20px' }}>
              <strong>Error:</strong> {cart.error}
            </div>
          ) : itemCount === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666' }}>
              <p style={{ fontSize: '18px', marginBottom: '10px' }}>Your cart is empty</p>
              <p style={{ fontSize: '14px' }}>Add items to your cart to see them here.</p>
            </div>
          ) : (
            <>
              {/* Line Items */}
              <div style={{ marginBottom: '20px' }}>
                {cart.lineItems.map((lineItem, index) => (
                  <div
                    key={index}
                    style={{
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                      padding: '15px',
                      marginBottom: '15px',
                      backgroundColor: '#fff'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '10px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                          {lineItem.name?.['en'] || lineItem.name || lineItem.productId}
                        </div>
                        {lineItem.variant?.sku && (
                          <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>
                            SKU: {lineItem.variant.sku}
                          </div>
                        )}
                        <div style={{ fontSize: '14px', marginTop: '5px' }}>
                          <LineItemPriceInfo price={lineItem.price} />
                        </div>
                      </div>
                      <button
                        onClick={() => removeLineItem(lineItem)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#dc3545',
                          cursor: 'pointer',
                          fontSize: '18px',
                          padding: '0 5px'
                        }}
                        title="Remove item"
                      >
                        ×
                      </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button
                        onClick={() => decrementQuantity(lineItem)}
                        style={{
                          width: '30px',
                          height: '30px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          backgroundColor: '#fff',
                          cursor: 'pointer',
                          fontSize: '18px'
                        }}
                      >
                        −
                      </button>
                      <span style={{ minWidth: '30px', textAlign: 'center', fontWeight: 'bold' }}>
                        {lineItem.quantity}
                      </span>
                      <button
                        onClick={() => incrementQuantity(lineItem)}
                        style={{
                          width: '30px',
                          height: '30px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          backgroundColor: '#fff',
                          cursor: 'pointer',
                          fontSize: '18px'
                        }}
                      >
                        +
                      </button>
                      <div style={{ marginLeft: 'auto', fontWeight: 'bold', fontSize: '16px' }}>
                        {formatPrice({
                          value: {
                            centAmount: (lineItem.totalPrice?.centAmount || (lineItem.price?.value?.centAmount || 0) * lineItem.quantity),
                            currencyCode: currency
                          }
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              {totalDiscounts && totalDiscounts.centAmount > 0 && (
                <div style={{ marginBottom: '15px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontWeight: 'bold' }}>Total Discounts:</span>
                    <LineItemPriceInfo price={totalDiscounts} />
                  </div>
                </div>
              )}

              {cart.totalPrice && (
                <div style={{ padding: '15px', backgroundColor: '#f0f8ff', borderRadius: '8px', border: '2px solid #007bff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '18px' }}>Total:</span>
                    <LineItemPriceInfo price={cart.totalPrice} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {cart && itemCount > 0 && (
          <div
            style={{
              padding: '20px',
              borderTop: '1px solid #ddd',
              backgroundColor: '#f8f9fa'
            }}
          >
            <button
              onClick={() => {
                navigate('/cart');
                onClose();
              }}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer',
                marginBottom: '10px'
              }}
            >
              View Full Cart
            </button>
            <button
              onClick={() => {
                navigate('/cart');
                onClose();
              }}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Checkout
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default SideCart;

