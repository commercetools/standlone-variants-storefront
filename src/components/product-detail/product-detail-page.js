import config from '../../config';
import { useEffect, useState, useContext } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import VariantInfo from './variant-info';
import ContextDisplay from '../context/context-display';
import AppContext from '../../appContext';
import { setQueryArgs } from '../../util/searchUtil';
import { formatPrice } from '../../util/priceUtil';

const ProductDetailPage = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const variantId = searchParams.get('variant');

  const [context, setContext] = useContext(AppContext);
  const [product, setProduct] = useState(null);
  const [otherVariants, setOtherVariants] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Sync context from sessionStorage to display current values
    setContext((prevContext) => ({
      ...prevContext,
      currency: sessionStorage.getItem('currency') || prevContext.currency || '',
      country: sessionStorage.getItem('country') || prevContext.country || '',
      channelId: sessionStorage.getItem('channelId') || prevContext.channelId || '',
      channelName: sessionStorage.getItem('channelName') || prevContext.channelName || '',
      storeKey: sessionStorage.getItem('storeKey') || prevContext.storeKey || '',
      storeName: sessionStorage.getItem('storeName') || prevContext.storeName || '',
      customerGroupId: sessionStorage.getItem('customerGroupId') || prevContext.customerGroupId || '',
      customerGroupName: sessionStorage.getItem('customerGroupName') || prevContext.customerGroupName || '',
    }));

    // Reset and fetch when product ID or variant ID changes
    setProduct(null);
    setOtherVariants([]);
    fetchProduct(id, variantId);
  }, [id, variantId, setContext]);

  const getAccessToken = async () => {
    const authUrl = context.authUrl || process.env.REACT_APP_AUTH_URL;
    const clientId = context.clientId || process.env.REACT_APP_CLIENT_ID;
    const clientSecret = context.clientSecret || process.env.REACT_APP_CLIENT_SECRET;

    if (!authUrl || !clientId || !clientSecret) {
      throw new Error('Missing credentials. Please configure project settings on the home page.');
    }

    const credentials = btoa(`${clientId}:${clientSecret}`);
    const response = await fetch(`${authUrl}/oauth/token?grant_type=client_credentials`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`Auth failed: ${response.status}`);
    }

    const data = await response.json();
    return data.access_token;
  };

  const findVariantById = (variants, variantId) => {
    const variantIdStr = variantId.toString();
    return variants.find(v => {
      const vid = v.id?.variantId || v.id;
      return vid === variantIdStr || String(vid) === variantIdStr;
    });
  };

  const fetchProduct = async (productId, requestedVariantId) => {
    if (!productId || productId === 'undefined') {
      return;
    }

    if (productId !== context.productId) {
      setContext({ ...context, productId });
    }

    if (!context.projectKey || !context.apiUrl) {
      setError('Missing project configuration. Please configure on the home page.');
      return;
    }

    try {
      const projectKey = context.projectKey;
      const apiUrl = context.apiUrl;
      const queryArgs = setQueryArgs();

      // Fetch all variants for this product to find the requested one
      const whereClause = encodeURIComponent(`product(id="${productId}")`);
      const priceCurrency = queryArgs.priceCurrency || 'EUR';
      const url = `${apiUrl}/${projectKey}/standalone-variant-projections?where=${whereClause}&staged=false&limit=100&priceCurrency=${priceCurrency}`;

      const accessToken = await getAccessToken();
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        setError(`API Error: ${response.status} - ${errorText}`);
        return;
      }

      const data = await response.json();

      if (data?.results?.length > 0) {
        // Find the requested variant or use the first one
        let selectedVariant = data.results[0];

        if (requestedVariantId) {
          const requested = findVariantById(data.results, requestedVariantId);
          if (requested) {
            selectedVariant = requested;
          }
        }

        // Get other variants (excluding the selected one, limit to 5)
        const selectedId = selectedVariant.id?.variantId || selectedVariant.id;
        const others = data.results
          .filter(v => {
            const vid = v.id?.variantId || v.id;
            return vid !== selectedId;
          })
          .slice(0, 5);

        setProduct(selectedVariant);
        setOtherVariants(others);
      } else {
        setError(`No standalone variants found for product ID: ${productId}`);
      }
    } catch (error) {
      console.error('Error fetching product:', error);
      setError(error.message);
    }
  };

  const getLocalizedText = (text, fallback = '') => {
    if (!text) return fallback;
    if (typeof text === 'string') return text;
    return text[config.locale] || text.en || fallback;
  };

  if (!product) {
    return <div>No product selected</div>;
  }

  const productName = getLocalizedText(product.name, 'Unknown');
  const productDescription = getLocalizedText(product.description, '');

  const variantTileStyle = {
    border: '1px solid #ccc',
    padding: '15px',
    borderRadius: '8px',
    width: '200px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
  };

  const handleVariantTileHover = (e, isEntering) => {
    if (isEntering) {
      e.currentTarget.style.borderColor = '#007bff';
      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
      e.currentTarget.style.transform = 'translateY(-2px)';
    } else {
      e.currentTarget.style.borderColor = '#ccc';
      e.currentTarget.style.boxShadow = 'none';
      e.currentTarget.style.transform = 'translateY(0)';
    }
  };

  return (
    <div>
      <ContextDisplay />
      <h1>{productName}</h1>
      {error && <h5 style={{ color: 'red' }}>{error}</h5>}

      {product.sku && (
        <div>
          <strong>SKU:</strong> {product.sku}
        </div>
      )}

      <h3>Variant Details:</h3>
      <VariantInfo priceMode="Standalone" variant={product} />

      <h3>Description</h3>
      <p>{productDescription}</p>

      {product.attributes?.length > 0 && (
        <div>
          <h3>Attributes:</h3>
          <ul>
            {product.attributes.map((attr, idx) => (
              <li key={idx}>
                <strong>{attr.name}:</strong> {String(attr.value)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {product.images?.length > 0 && (
        <div>
          <h3>Images:</h3>
          <ul>
            {product.images.map((img, idx) => (
              <li key={idx}>
                <img src={img.url} alt={productName} style={{ maxWidth: '200px' }} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {otherVariants?.length > 0 && (
        <div>
          <h3>Other Variants:</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
            {otherVariants.map((variant) => {
              const variantName = getLocalizedText(variant.name, 'Unknown');
              const variantImage = variant.images?.[0]?.url;
              const variantProductId = variant.product?.id;
              const variantIdForUrl = variant.id?.variantId || variant.id;

              return (
                <Link
                  key={variant.id}
                  to={`/product-detail/${variantProductId}?variant=${variantIdForUrl}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div
                    style={variantTileStyle}
                    onMouseEnter={(e) => handleVariantTileHover(e, true)}
                    onMouseLeave={(e) => handleVariantTileHover(e, false)}
                  >
                    {variantImage && (
                      <img
                        src={variantImage}
                        alt={variantName}
                        style={{
                          width: '100%',
                          maxHeight: '150px',
                          objectFit: 'contain',
                          marginBottom: '10px'
                        }}
                      />
                    )}
                    <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                      {variantName}
                    </div>
                    {variant.sku && (
                      <div style={{ fontSize: '0.9em', color: '#666', marginBottom: '5px' }}>
                        SKU: {variant.sku}
                      </div>
                    )}
                    {variant.price?.value && (
                      <div style={{ fontSize: '1.1em', fontWeight: 'bold', marginTop: '10px' }}>
                        {formatPrice(variant.price)}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductDetailPage;
