import config from '../../config';
import { useEffect, useState, useContext, useCallback } from 'react';
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import VariantInfo from './variant-info';
import AttributeSelector from './attribute-selector';
import CurrencyPicker from '../context/currency-picker';
import CountryPicker from '../context/country-picker';
import ChannelPicker from '../context/channel-picker';
import StorePicker from '../context/store-picker';
import CustomerGroupPicker from '../context/customer-group-picker';
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
  const [allVariants, setAllVariants] = useState([]); // All variants including selected one
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const variantsPerPage = 10;
  const navigate = useNavigate();
  const [apiCallInfo, setApiCallInfo] = useState(null);
  const [showApiInfo, setShowApiInfo] = useState(false);

  const getAccessToken = useCallback(async () => {
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
  }, [context.authUrl, context.clientId, context.clientSecret]);

  const findVariantById = useCallback((variants, variantId) => {
    const variantIdStr = variantId.toString();
    return variants.find(v => {
      const vid = v.id?.variantId || v.id;
      return vid === variantIdStr || String(vid) === variantIdStr;
    });
  }, []);

  const fetchProduct = useCallback(async (productId, requestedVariantId) => {
    if (!productId || productId === 'undefined') {
      return;
    }

    // Get fresh context values for this fetch
    const currentContext = context;
    
    if (!currentContext.projectKey || !currentContext.apiUrl) {
      setError('Missing project configuration. Please configure on the home page.');
      return;
    }

    try {
      setError(null); // Clear any previous errors
      
      const projectKey = currentContext.projectKey;
      const apiUrl = currentContext.apiUrl;
    const queryArgs = setQueryArgs();

      // Use in-store variant projections endpoint
      // Default to 'default' store if no store is selected
      const storeKey = currentContext.storeKey || 'default';
      const whereClause = encodeURIComponent(`product(id="${productId}")`);
      const priceCurrency = currentContext.currency || queryArgs.priceCurrency || 'EUR';
      
      // Build query parameters for price selection
      const queryParams = [];
      queryParams.push(`where=${whereClause}`);
      queryParams.push('staged=false');
      queryParams.push('limit=500');
      queryParams.push(`priceCurrency=${encodeURIComponent(priceCurrency)}`);
      
      // Add optional price selection parameters
      // USD prices require country=US, so automatically set it for USD currency
      if (priceCurrency === 'USD') {
        // For USD, use explicitly selected country or default to US
        queryParams.push(`priceCountry=${encodeURIComponent(currentContext.country || 'US')}`);
      } else if (currentContext.country) {
        // For other currencies, use selected country if available
        queryParams.push(`priceCountry=${encodeURIComponent(currentContext.country)}`);
      }
      if (currentContext.channelId) {
        queryParams.push(`priceChannel=${encodeURIComponent(currentContext.channelId)}`);
      }
      if (currentContext.customerGroupId) {
        queryParams.push(`priceCustomerGroup=${encodeURIComponent(currentContext.customerGroupId)}`);
      }
      
      // Use in-store endpoint: /in-store/key={storeKey}/standalone-variant-projections
      const url = `${apiUrl}/${projectKey}/in-store/key=${storeKey}/standalone-variant-projections?${queryParams.join('&')}`;

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
      
      // Store API call information for display
      setApiCallInfo({
        endpoint: `/in-store/key=${storeKey}/standalone-variant-projections`,
        method: 'GET',
        fullUrl: url,
        queryParams: queryParams,
        status: response.status,
        totalVariants: data.total || 0,
        variantsReturned: data.results?.length || 0,
        headers: {
          'Authorization': `Bearer ${accessToken.substring(0, 20)}...`,
          'Content-Type': 'application/json'
        }
      });

      if (data?.results?.length > 0) {
        // Find the requested variant or use the first one
        let selectedVariant = data.results[0];

        if (requestedVariantId) {
          const requested = findVariantById(data.results, requestedVariantId);
          if (requested) {
            selectedVariant = requested;
          }
        }

        // Get all other variants (excluding the selected one, no limit - will paginate later)
        const selectedId = selectedVariant.id?.variantId || selectedVariant.id;
        const others = data.results.filter(v => {
          const vid = v.id?.variantId || v.id;
          return vid !== selectedId;
        });

        setProduct(selectedVariant);
        setOtherVariants(others);
        setAllVariants(data.results); // Store all variants for attribute selector
        setCurrentPage(1); // Reset to first page when product changes

        // Update URL with variant ID if not present (always have a variant in URL)
        if (!requestedVariantId && selectedId) {
          const newParams = new URLSearchParams(searchParams);
          newParams.set('variant', selectedId);
          navigate(`/product-detail/${productId}?${newParams.toString()}`, { replace: true });
        }
      } else {
        setError(`No standalone variants found for product ID: ${productId}`);
      }
    } catch (error) {
      console.error('Error fetching product:', error);
      setError(error.message);
    }
  }, [context, getAccessToken, findVariantById, searchParams, navigate]);

  useEffect(() => {
    // Sync context from sessionStorage to display current values
    setContext((prevContext) => ({
      ...prevContext,
      currency: sessionStorage.getItem('currency') || prevContext.currency || '',
      country: sessionStorage.getItem('country') || prevContext.country || '',
      channelId: sessionStorage.getItem('channelId') || prevContext.channelId || '',
      channelName: sessionStorage.getItem('channelName') || prevContext.channelName || '',
      storeKey: sessionStorage.getItem('storeKey') || prevContext.storeKey || 'default',
      storeName: sessionStorage.getItem('storeName') || prevContext.storeName || '',
      customerGroupId: sessionStorage.getItem('customerGroupId') || prevContext.customerGroupId || '',
      customerGroupName: sessionStorage.getItem('customerGroupName') || prevContext.customerGroupName || '',
    }));
  }, [setContext]);

  // Initial fetch and refetch when product ID or variant ID changes
  useEffect(() => {
    if (id) {
      // Reset and fetch when product ID or variant ID changes
      setProduct(null);
      setOtherVariants([]);
      setAllVariants([]);
      setError(null);
      fetchProduct(id, variantId);
    }
  }, [id, variantId, fetchProduct]);

  // Refetch when context changes (store, currency, etc.)
  useEffect(() => {
    if (id) {
      // Always refetch when context changes to get updated prices/variants
      // Reset state first to show loading state
      setProduct(null);
      setOtherVariants([]);
      setAllVariants([]);
      setError(null);
      // Then fetch with new context
      fetchProduct(id, variantId);
    }
  }, [context.storeKey, context.currency, context.country, context.channelId, context.customerGroupId, id, variantId, fetchProduct]);

  // Handle variant change from attribute selector
  const handleVariantChange = (variantId) => {
    // Update URL with new variant
    const newParams = new URLSearchParams(searchParams);
    newParams.set('variant', variantId);
    navigate(`/product-detail/${id}?${newParams.toString()}`, { replace: true });
    // fetchProduct will be called by the useEffect watching variantId
  };

  const getLocalizedText = (text, fallback = '') => {
    if (!text) return fallback;
    if (typeof text === 'string') return text;
    return text[config.locale] || text.en || fallback;
  };

  const getAttributeValue = (variant, attributeName) => {
    const attr = variant.attributes?.find(a => a.name === attributeName);
    return attr ? String(attr.value) : null;
  };

  // Sort variants by size attribute (if available)
  const sortedVariants = [...otherVariants].sort((a, b) => {
    const sizeA = getAttributeValue(a, 'size');
    const sizeB = getAttributeValue(b, 'size');
    
    if (!sizeA && !sizeB) return 0;
    if (!sizeA) return 1;
    if (!sizeB) return -1;
    
    // Try to sort numerically if both are numbers
    const numA = parseFloat(sizeA);
    const numB = parseFloat(sizeB);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    
    // Otherwise sort alphabetically
    return sizeA.localeCompare(sizeB);
  });

  // Pagination logic
  const totalPages = Math.ceil(sortedVariants.length / variantsPerPage);
  const startIndex = (currentPage - 1) * variantsPerPage;
  const endIndex = startIndex + variantsPerPage;
  const paginatedVariants = sortedVariants.slice(startIndex, endIndex);

  if (!product) {
    return <div>No product selected</div>;
  }

  const productName = getLocalizedText(product.name, 'Unknown');
  const productDescription = getLocalizedText(product.description, '');

  const variantTileStyle = {
    border: '2px solid #e0e0e0',
    padding: '15px',
    borderRadius: '8px',
    width: '200px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    backgroundColor: '#fff',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  };

  const handleVariantTileHover = (e, isEntering) => {
    if (isEntering) {
      e.currentTarget.style.borderColor = '#007bff';
      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,123,255,0.2)';
      e.currentTarget.style.transform = 'translateY(-4px)';
    } else {
      e.currentTarget.style.borderColor = '#e0e0e0';
      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
      e.currentTarget.style.transform = 'translateY(0)';
    }
  };


  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      {/* Context Dropdowns at Top */}
      <div style={{ 
        marginBottom: '30px', 
        padding: '20px', 
        border: '1px solid #ddd', 
        borderRadius: '8px', 
        backgroundColor: '#f9f9f9',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
      }}>
        <h3 style={{ marginBottom: '15px', color: '#333', fontSize: '20px' }}>Context</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '25px', alignItems: 'center' }}>
          <CurrencyPicker />
          <CountryPicker />
          <ChannelPicker />
          <StorePicker />
          <CustomerGroupPicker />
        </div>
      </div>

      {error && <h5 style={{ color: 'red' }}>{error}</h5>}

      {/* API Info Card */}
      {apiCallInfo && (
        <div style={{ 
          marginBottom: '30px', 
          padding: '20px', 
          border: '2px solid #007bff', 
          borderRadius: '8px', 
          backgroundColor: '#f0f8ff',
          boxShadow: '0 2px 8px rgba(0,123,255,0.15)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: 0, color: '#007bff', fontSize: '18px', fontWeight: 'bold' }}>
              📡 API Call Information
            </h3>
            <button
              onClick={() => setShowApiInfo(!showApiInfo)}
              style={{
                padding: '5px 10px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              {showApiInfo ? '▼ Hide' : '▶ Show'}
            </button>
          </div>
          
          {showApiInfo && (
            <div style={{ fontSize: '14px', color: '#333' }}>
              <div style={{ marginBottom: '12px' }}>
                <strong style={{ color: '#007bff' }}>Endpoint:</strong>
                <code style={{ 
                  display: 'block', 
                  marginTop: '5px', 
                  padding: '8px', 
                  backgroundColor: '#fff', 
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  wordBreak: 'break-all'
                }}>
                  {apiCallInfo.method} {apiCallInfo.endpoint}
                </code>
              </div>
              
              <div style={{ marginBottom: '12px' }}>
                <strong style={{ color: '#007bff' }}>Full URL:</strong>
                <code style={{ 
                  display: 'block', 
                  marginTop: '5px', 
                  padding: '8px', 
                  backgroundColor: '#fff', 
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  wordBreak: 'break-all',
                  maxHeight: '100px',
                  overflow: 'auto'
                }}>
                  {apiCallInfo.fullUrl}
                </code>
              </div>
              
              <div style={{ marginBottom: '12px' }}>
                <strong style={{ color: '#007bff' }}>Query Parameters:</strong>
                <div style={{ 
                  marginTop: '5px', 
                  padding: '8px', 
                  backgroundColor: '#fff', 
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  fontFamily: 'monospace',
                  fontSize: '12px'
                }}>
                  {apiCallInfo.queryParams.map((param, idx) => {
                    const [key, value] = param.split('=');
                    return (
                      <div key={idx} style={{ marginBottom: '4px' }}>
                        <span style={{ color: '#28a745', fontWeight: 'bold' }}>{decodeURIComponent(key)}</span>
                        <span style={{ color: '#666' }}> = </span>
                        <span style={{ color: '#dc3545' }}>{decodeURIComponent(value || '')}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '20px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <div>
                  <strong style={{ color: '#007bff' }}>Status:</strong>
                  <span style={{ marginLeft: '5px', color: apiCallInfo.status === 200 ? '#28a745' : '#dc3545' }}>
                    {apiCallInfo.status}
                  </span>
                </div>
                <div>
                  <strong style={{ color: '#007bff' }}>Total Variants:</strong>
                  <span style={{ marginLeft: '5px' }}>{apiCallInfo.totalVariants}</span>
                </div>
                <div>
                  <strong style={{ color: '#007bff' }}>Variants Returned:</strong>
                  <span style={{ marginLeft: '5px' }}>{apiCallInfo.variantsReturned}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Product Information Section */}
      <div style={{ 
        marginBottom: '30px', 
        padding: '25px', 
        border: '1px solid #ddd', 
        borderRadius: '8px',
        backgroundColor: '#fff',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
      }}>
        <h2 style={{ marginBottom: '15px', color: '#333', fontSize: '24px' }}>Product Information</h2>
        <h1 style={{ marginBottom: '15px', color: '#222', fontSize: '32px' }}>{productName}</h1>
        {productDescription && (
          <div style={{ marginTop: '15px' }}>
            <h3 style={{ marginBottom: '10px', color: '#555', fontSize: '18px' }}>Description</h3>
            <p style={{ color: '#666', lineHeight: '1.6' }}>{productDescription}</p>
          </div>
        )}
      </div>

      {/* Attribute Selector */}
      {allVariants.length > 0 && (
        <AttributeSelector
          variants={allVariants}
          selectedVariant={product}
          onVariantChange={handleVariantChange}
        />
      )}

      {/* Variant Information Section */}
      <div style={{ 
        marginBottom: '30px', 
        padding: '25px', 
        border: '1px solid #ddd', 
        borderRadius: '8px',
        backgroundColor: '#fff',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
      }}>
        <h2 style={{ marginBottom: '20px', color: '#333', fontSize: '24px' }}>Variant Information</h2>
        {product.sku && (
          <div style={{ marginBottom: '10px', fontSize: '16px' }}>
            <strong style={{ color: '#555' }}>SKU:</strong> <span style={{ color: '#333' }}>{product.sku}</span>
          </div>
        )}
        {product.key && (
          <div style={{ marginBottom: '10px', fontSize: '16px' }}>
            <strong style={{ color: '#555' }}>Variant Key:</strong> <span style={{ color: '#333' }}>{product.key}</span>
          </div>
        )}

        {product.images?.length > 0 && (() => {
          // Color name to hex mapping for CSS borders - all 18 colors from product-type.json
          const colorToHex = (colorName) => {
            const colorMap = {
              'black': '#000000',
              'grey': '#808080',
              'gray': '#808080', // Alias for grey
              'beige': '#F5F5DC',
              'white': '#FFFFFF',
              'blue': '#0000FF',
              'brown': '#A52A2A',
              'turquoise': '#40E0D0',
              'petrol': '#005F6A',
              'green': '#008000',
              'red': '#FF0000',
              'purple': '#800080',
              'pink': '#FFC0CB',
              'orange': '#FFA500',
              'yellow': '#FFFF00',
              'oliv': '#808000',
              'gold': '#FFD700',
              'silver': '#C0C0C0',
              'multicolored': '#FF00FF' // Magenta for multicolored
            };
            return colorMap[colorName?.toLowerCase()] || '#CCCCCC';
          };

          const colorValue = getAttributeValue(product, 'color');
          const borderColor = colorValue ? colorToHex(colorValue) : '#e0e0e0';

          return (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ marginBottom: '15px', color: '#555', fontSize: '18px' }}>Images:</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
                {product.images.map((img, idx) => (
                  <img 
                    key={idx} 
                    src={img.url} 
                    alt={productName} 
                    style={{ 
                      maxWidth: '250px', 
                      maxHeight: '250px',
                      borderRadius: '8px',
                      border: `3px solid ${borderColor}`,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      objectFit: 'contain'
                    }} 
                  />
                ))}
              </div>
            </div>
          );
        })()}

        <VariantInfo priceMode="Standalone" variant={product} />
      </div>

      {otherVariants?.length > 0 && (
        <div style={{ 
          marginTop: '30px', 
          padding: '25px', 
          border: '1px solid #ddd', 
          borderRadius: '8px',
          backgroundColor: '#fff',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
        }}>
          <h2 style={{ marginBottom: '20px', color: '#333', fontSize: '24px' }}>Other Variants ({otherVariants.length})</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginBottom: '20px' }}>
            {paginatedVariants.map((variant, idx) => {
              const variantName = getLocalizedText(variant.name, 'Unknown');
              const variantImage = variant.images?.[0]?.url;
              const variantProductId = variant.product?.id;
              const variantIdForUrl = variant.id?.variantId || variant.id;
              const sizeValue = getAttributeValue(variant, 'size');
              const colorValue = getAttributeValue(variant, 'color');
              const styleValue = getAttributeValue(variant, 'style');

              // Color name to hex mapping for CSS borders - all 18 colors from product-type.json
              const colorToHex = (colorName) => {
                const colorMap = {
                  'black': '#000000',
                  'grey': '#808080',
                  'gray': '#808080', // Alias for grey
                  'beige': '#F5F5DC',
                  'white': '#FFFFFF',
                  'blue': '#0000FF',
                  'brown': '#A52A2A',
                  'turquoise': '#40E0D0',
                  'petrol': '#005F6A',
                  'green': '#008000',
                  'red': '#FF0000',
                  'purple': '#800080',
                  'pink': '#FFC0CB',
                  'orange': '#FFA500',
                  'yellow': '#FFFF00',
                  'oliv': '#808000',
                  'gold': '#FFD700',
                  'silver': '#C0C0C0',
                  'multicolored': '#FF00FF' // Magenta for multicolored
                };
                return colorMap[colorName?.toLowerCase()] || '#CCCCCC';
              };

              const borderColor = colorValue ? colorToHex(colorValue) : '#e0e0e0';

              return (
                <Link
                  key={variantIdForUrl || variant.id || idx}
                  to={`/product-detail/${variantProductId}?variant=${variantIdForUrl}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div
                    style={{
                      ...variantTileStyle,
                      borderColor: borderColor,
                      borderWidth: '3px'
                    }}
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
                    {sizeValue && (
                      <div style={{ fontSize: '0.9em', color: '#666', marginBottom: '5px' }}>
                        Size: {sizeValue}
                      </div>
                    )}
                    {colorValue && (
                      <div style={{ fontSize: '0.9em', color: '#666', marginBottom: '5px' }}>
                        Color: {colorValue}
                      </div>
                    )}
                    {styleValue && (
                      <div style={{ fontSize: '0.9em', color: '#666', marginBottom: '5px' }}>
                        Style: {styleValue}
                      </div>
                    )}
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
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '15px', 
              justifyContent: 'center',
              marginTop: '20px',
              paddingTop: '20px',
              borderTop: '1px solid #eee'
            }}>
              <button 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                style={{ 
                  padding: '10px 20px', 
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer', 
                  opacity: currentPage === 1 ? 0.5 : 1,
                  backgroundColor: currentPage === 1 ? '#ccc' : '#007bff',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (currentPage !== 1) {
                    e.currentTarget.style.backgroundColor = '#0056b3';
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentPage !== 1) {
                    e.currentTarget.style.backgroundColor = '#007bff';
                  }
                }}
              >
                Previous
              </button>
              <span style={{ 
                padding: '0 15px',
                fontSize: '16px',
                fontWeight: 'bold',
                color: '#333'
              }}>
                Page {currentPage} of {totalPages}
              </span>
              <button 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                style={{ 
                  padding: '10px 20px', 
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', 
                  opacity: currentPage === totalPages ? 0.5 : 1,
                  backgroundColor: currentPage === totalPages ? '#ccc' : '#007bff',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (currentPage !== totalPages) {
                    e.currentTarget.style.backgroundColor = '#0056b3';
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentPage !== totalPages) {
                    e.currentTarget.style.backgroundColor = '#007bff';
                  }
                }}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ProductDetailPage;
