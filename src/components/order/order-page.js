import { useEffect, useState } from 'react';
import ContextDisplay from '../context/context-display';
import { Container, Row, Col} from 'react-bootstrap';
import { apiRoot } from '../../commercetools';

const VERBOSE=true;

const OrderPage = () => {

  let [order, setOrder] = useState(null);
  let [fetched, setFetched] = useState(false);

  useEffect(() => {
    getCurrentOrder();
  });

  const getCurrentOrder = async() => {
    if(fetched)
      return order;
    setFetched(true);
    setOrder(await fetchOrder());
  }


  const fetchOrder = async() => {
    let orderId = sessionStorage.getItem('orderId');
    if(!orderId)
      return null;

    let res = await apiRoot
      .orders()
      .withId({ID: orderId})
      .get({
        queryArgs: {
          expand: [
            'lineItems[*].variant',
            'lineItems[*].discountedPricePerQuantity[*].discountedPrice.includedDiscounts[*].discount'
          ]
        }
      })
      .execute();

    if(res?.body) {
      return res.body;
    }
  }

  if(!order) {
    return (
      <Container fluid>
        <Row>
          <Col>
            <p style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              No current order.
            </p>
          </Col>
        </Row>
      </Container>
    )
  }

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString();
  };

  const formatMoney = (price) => {
    if (!price) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: price.currencyCode
    }).format(price.centAmount / 100);
  };

  console.log(order);

  return (
    <div>
      <ContextDisplay />

      <Container fluid style={{ marginTop: '20px' }}>
        {/* Order Header */}
        <Row style={{ marginBottom: '20px' }}>
          <Col>
            <h3>Order Details</h3>
          </Col>
        </Row>

        {/* Order Information Card */}
        <Row style={{ marginBottom: '30px' }}>
          <Col>
            <div style={{
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '20px',
              backgroundColor: '#f9f9f9'
            }}>
              <h4 style={{ marginBottom: '15px' }}>Order Information</h4>
              <Row>
                <Col md={6}>
                  <p><strong>Order ID:</strong> {order.id}</p>
                  <p><strong>Order Number:</strong> {order.orderNumber || 'N/A'}</p>
                  <p><strong>Order State:</strong> <span style={{
                    padding: '4px 8px',
                    backgroundColor: order.orderState === 'Complete' ? '#d4edda' : '#fff3cd',
                    borderRadius: '4px',
                    fontWeight: 'bold'
                  }}>{order.orderState}</span></p>
                  <p><strong>Payment State:</strong> {order.paymentState || 'N/A'}</p>
                  <p><strong>Shipment State:</strong> {order.shipmentState || 'N/A'}</p>
                </Col>
                <Col md={6}>
                  <p><strong>Created At:</strong> {formatDate(order.createdAt)}</p>
                  <p><strong>Last Modified:</strong> {formatDate(order.lastModifiedAt)}</p>
                  <p><strong>Version:</strong> {order.version}</p>
                  <p><strong>Customer Email:</strong> {order.customerEmail || 'N/A'}</p>
                </Col>
              </Row>
            </div>
          </Col>
        </Row>

        {/* Shipping Address */}
        {order.shippingAddress && (
          <Row style={{ marginBottom: '30px' }}>
            <Col>
              <div style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '20px',
                backgroundColor: '#f9f9f9'
              }}>
                <h4 style={{ marginBottom: '15px' }}>Shipping Address</h4>
                <p>{order.shippingAddress.firstName} {order.shippingAddress.lastName}</p>
                {order.shippingAddress.streetName && <p>{order.shippingAddress.streetName}</p>}
                {order.shippingAddress.city && <p>{order.shippingAddress.city}, {order.shippingAddress.postalCode}</p>}
                {order.shippingAddress.country && <p>{order.shippingAddress.country}</p>}
                {order.shippingAddress.email && <p>Email: {order.shippingAddress.email}</p>}
                {order.shippingAddress.phone && <p>Phone: {order.shippingAddress.phone}</p>}
              </div>
            </Col>
          </Row>
        )}

        {/* Line Items */}
        <Row style={{ marginBottom: '30px' }}>
          <Col>
            <h4 style={{ marginBottom: '15px' }}>Order Items</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd' }}>
              <thead style={{ backgroundColor: '#f5f5f5' }}>
                <tr>
                  <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Product</th>
                  <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>SKU</th>
                  <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>Quantity</th>
                  <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'right' }}>Unit Price</th>
                  <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'right' }}>Total Price</th>
                </tr>
              </thead>
              <tbody>
                {order.lineItems.map((lineItem, index) => {
                  const productName = lineItem.name?.en || lineItem.name || 'Unknown Product';
                  return (
                    <tr key={index}>
                      <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                        {productName}
                        {lineItem.variant?.sku && (
                          <div style={{ fontSize: '0.85em', color: '#666' }}>
                            Variant: {lineItem.variant.sku}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                        {lineItem.variant?.sku || 'N/A'}
                      </td>
                      <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>
                        {lineItem.quantity}
                      </td>
                      <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'right' }}>
                        {formatMoney(lineItem.price.value)}
                        {lineItem.price.discounted && (
                          <div style={{ fontSize: '0.85em', color: '#dc3545' }}>
                            <strike>{formatMoney(lineItem.price.value)}</strike>
                            <br/>
                            {formatMoney(lineItem.price.discounted.value)}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'right' }}>
                        {formatMoney(lineItem.totalPrice)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Col>
        </Row>

        {/* Order Totals */}
        <Row style={{ marginBottom: '30px' }}>
          <Col md={{ span: 6, offset: 6 }}>
            <div style={{
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '20px',
              backgroundColor: '#f9f9f9'
            }}>
              <h4 style={{ marginBottom: '15px' }}>Order Summary</h4>

              {order.taxedPrice && (
                <>
                  <Row style={{ marginBottom: '10px' }}>
                    <Col><strong>Subtotal:</strong></Col>
                    <Col style={{ textAlign: 'right' }}>
                      {formatMoney({
                        centAmount: order.taxedPrice.totalNet.centAmount,
                        currencyCode: order.totalPrice.currencyCode
                      })}
                    </Col>
                  </Row>
                  <Row style={{ marginBottom: '10px' }}>
                    <Col><strong>Tax:</strong></Col>
                    <Col style={{ textAlign: 'right' }}>
                      {formatMoney({
                        centAmount: order.taxedPrice.totalTax.centAmount,
                        currencyCode: order.totalPrice.currencyCode
                      })}
                    </Col>
                  </Row>
                </>
              )}

              {order.shippingInfo && (
                <Row style={{ marginBottom: '10px' }}>
                  <Col><strong>Shipping:</strong></Col>
                  <Col style={{ textAlign: 'right' }}>
                    {formatMoney(order.shippingInfo.price)}
                  </Col>
                </Row>
              )}

              <hr />

              <Row>
                <Col><h5>Total:</h5></Col>
                <Col style={{ textAlign: 'right' }}>
                  <h5>{formatMoney(order.totalPrice)}</h5>
                </Col>
              </Row>
            </div>
          </Col>
        </Row>

        {/* Custom Fields (if any) */}
        {order.custom && (
          <Row style={{ marginBottom: '30px' }}>
            <Col>
              <div style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '20px',
                backgroundColor: '#f9f9f9'
              }}>
                <h4 style={{ marginBottom: '15px' }}>Custom Fields</h4>
                <pre style={{
                  backgroundColor: '#fff',
                  padding: '10px',
                  borderRadius: '4px',
                  fontSize: '0.9em'
                }}>
                  {JSON.stringify(order.custom, null, 2)}
                </pre>
              </div>
            </Col>
          </Row>
        )}
      </Container>
    </div>
  )
}

export default OrderPage;
