import config from '../../config';
import AttributeInfo from './attribute-info';
import { useContext, useState } from 'react';
import PriceInfo from './price-info';
import { formatDiscount, formatPrice } from '../../util/priceUtil';
import { Link, useNavigate } from "react-router-dom";
import AppContext from '../../appContext.js';
import { Container, Row, Col } from 'react-bootstrap';
import { addToCart } from '../../util/cart-util'

const VERBOSE = false;



const VariantInfo = ({ priceMode, variant }) => {

  const [context] = useContext(AppContext);

  const [showCustom, setShowCustom] = useState(false);

  const [customType, setCustomType] = useState('');
  const [customFieldName, setCustomFieldName] = useState('');
  const [customFieldValue, setCustomFieldValue] = useState('');

  const navigate = useNavigate();

  const callAddToCart = async () => {
    const productId = context.productId;
    let custom = {}
    if (showCustom) {
      custom = {
        type: {
          key: customType
        },
        fields: {
          [customFieldName]: customFieldValue
        }
      }
    }
    const result = await addToCart(productId, variant.id, custom);
    if (result) {
      console.log('redirect to cart');
      navigate('/cart');
    } else {
      //window.location.reload();
    }
  }


  const toggleAddCustomFields = (event) => {
    setShowCustom(event.target.checked == true);
  }


  let priceStr = '';
  let strikePriceStr = '';
  let discountStr = '';
  // Check for price in variant.price (selected price) or variant.currentPrice
  const price = variant.price || variant.currentPrice;
  if (price?.discounted) {
    strikePriceStr = formatPrice(price);
    priceStr = formatPrice(price.discounted);
    discountStr = formatDiscount(price.discounted.discount.obj);
  }
  else if (price) {
    priceStr = formatPrice(price);
  }

  VERBOSE && console.log('variant', variant);
  return (
    <li>
      {/* Images, SKU, and Variant Key are shown separately in Variant Information section, not here */}
      {priceMode == 'Embedded'
        ?
        <div>
          {variant.price
            ? <span>
              Price (using price selection): {
                variant.price?.discounted ?
                  <span>
                    <strike>{strikePriceStr}</strike> {priceStr}<br />
                    <em>{discountStr} off</em><br />
                    Discount: <Link to={"/discount-detail/" + variant.price.discounted.discount.id}>{variant.price.discounted.discount.obj.name[config.locale]}</Link>
                  </span>
                  :
                  <span>{priceStr}</span>
              }
              <br></br>
              <input type="checkbox" onChange={toggleAddCustomFields} /> Add Custom Fields <br></br>
              {showCustom &&
                <div className="indent">
                  <Container fluid="false">
                    <Row>
                      <Col xs={1}>Type key:</Col>
                      <Col><input value={customType} onChange={e => setCustomType(e.target.value)} /></Col>
                    </Row>
                    <Row>
                      <Col xs={1}>Field:</Col>
                      <Col><input value={customFieldName} onChange={e => setCustomFieldName(e.target.value)} /></Col>
                    </Row>
                    <Row>
                      <Col xs={1}>Value:</Col>
                      <Col><input value={customFieldValue} onChange={e => setCustomFieldValue(e.target.value)} /></Col>
                    </Row>
                  </Container>
                </div>

              }
              <button type="button" onClick={callAddToCart}>Add to Cart</button>
            </span>
            :
            <div>
              Prices:<br></br>
              <small>All prices displayed.  To use Price Selection logic, go to <Link to="/context">Context</Link><br></br>
                and select a currency (required), and one or more additional options.</small>
              <table border="1" cellSpacing="0">
                <thead>
                  <tr>
                    <td>Currency</td>
                    <td>Country</td>
                    <td>Channel</td>
                    <td>Customer Group</td>
                    <td>Price</td>
                    <td>Discount Info</td>
                  </tr>
                </thead>
                <tbody>
                  {variant.price
                    ? <PriceInfo price={variant.price} />
                    : variant.prices.map((price, index) => <PriceInfo key={index} price={price} />)
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
        :
        <div>
          {price ? (
            <div>
              <h3>Price: {priceStr}</h3>
              {strikePriceStr && (
                <div>
                  <strike>{strikePriceStr}</strike>
                  {discountStr && <span> - {discountStr} off</span>}
                </div>
              )}
              {context.currency ? (
                <button type="button" onClick={callAddToCart}>Add to Cart</button>
              ) : (
                <p><b>To add to cart, first select a currency in the <Link to="/context">Context page</Link></b></p>
              )}
            </div>
          ) : (
            <div>
              <p>Price not available. Please select a currency to see prices.</p>
              {context.currency ? (
                <button type="button" onClick={callAddToCart}>Add to Cart</button>
              ) : (
                <p><b>To add to cart, first select a currency in the <Link to="/context">Context page</Link></b></p>
              )}
            </div>
          )}
        </div>
      }
      <p></p>
      {variant.attributes && variant.attributes.length > 0 && (
        <>
          <h4>Attributes:</h4> {variant.attributes.map(attr => <AttributeInfo key={attr.name} attr={attr} />)} <br></br>
        </>
      )}
      <p></p>
    </li>
  );
}

export default VariantInfo;
