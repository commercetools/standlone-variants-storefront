import config from '../../config';
import { Link } from "react-router-dom";
import {formatPrice} from "../../util/priceUtil";


const ProductListEntry = ({product}) => {
  // Handle both regular product projections and standalone variant projections
  // Standalone variant projections have name/slug at top level, regular products have them nested
  let productName = 'Unknown';
  if (product.name) {
    if (typeof product.name === 'string') {
      productName = product.name;
    } else {
      productName = product.name[config.locale] || product.name.en || Object.values(product.name)[0] || 'Unknown';
    }
  } else if (product.masterData?.current?.name) {
    productName = typeof product.masterData.current.name === 'string' 
      ? product.masterData.current.name 
      : product.masterData.current.name[config.locale] || product.masterData.current.name.en || 'Unknown';
  }
  
  const price = product.price || (product.masterVariant?.price);
  // Always use product.id from the embedded product reference, not variant.id
  const productId = product.product?.id;

  return (
    <li>
        {
            price ?
                price.discounted ?
                    <span>
                        <strike>{formatPrice(price)}</strike> {formatPrice(price.discounted)}
                        &nbsp;-&nbsp;
                    </span>
                    :
                    <span>
                        {formatPrice(price)}
                        &nbsp;-&nbsp;
                    </span>
                :
                <span></span>
        }
        {product.sku && <span>(SKU: {product.sku}) &nbsp;</span>}
        <Link to={"/product-detail/"+productId}>
            <strong>{productName}</strong>
        </Link>
    </li>
  )
}

// TODO - ADD DESCRIPTION, proper localization

export default ProductListEntry
