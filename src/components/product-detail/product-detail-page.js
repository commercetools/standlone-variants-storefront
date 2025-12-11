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
  const [productType, setProductType] = useState(null); // Product type for dropdowns
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const navigate = useNavigate();
  const [apiCallInfo, setApiCallInfo] = useState(null); // For other variants query
  const [showApiInfo, setShowApiInfo] = useState(false);
  const [variantByIdApiInfo, setVariantByIdApiInfo] = useState(null); // For main variant by ID
  const [showVariantByIdApiInfo, setShowVariantByIdApiInfo] = useState(false);
  const [productTypeApiInfo, setProductTypeApiInfo] = useState(null); // For product type
  const [showProductTypeApiInfo, setShowProductTypeApiInfo] = useState(false);
  const [queryByAttributesApiInfo, setQueryByAttributesApiInfo] = useState(null); // For query by attributes
  const [showQueryByAttributesApiInfo, setShowQueryByAttributesApiInfo] = useState(false);
  const [variantMatrix, setVariantMatrix] = useState(null); // For variant matrix selector
  const [variantMatrixApiInfo, setVariantMatrixApiInfo] = useState(null); // For variant matrix API call
  const [showVariantMatrixApiInfo, setShowVariantMatrixApiInfo] = useState(false);

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

  // Fetch variant by ID using in-store endpoint
  const fetchVariantById = useCallback(async (variantId) => {
    if (!variantId) {
      throw new Error('Variant ID is required');
    }

    const currentContext = context;
    if (!currentContext.projectKey || !currentContext.apiUrl) {
      throw new Error('Missing project configuration. Please configure on the home page.');
    }

    const projectKey = currentContext.projectKey;
    const apiUrl = currentContext.apiUrl;
    const storeKey = currentContext.storeKey || 'default';
    const priceCurrency = currentContext.currency || 'EUR';

    // Build query parameters for price selection
    const queryParams = [];
    queryParams.push('staged=false');
    queryParams.push(`priceCurrency=${encodeURIComponent(priceCurrency)}`);
    queryParams.push('expand=price.discounted.discount');

    if (priceCurrency === 'USD') {
      queryParams.push(`priceCountry=${encodeURIComponent(currentContext.country || 'US')}`);
    } else if (currentContext.country) {
      queryParams.push(`priceCountry=${encodeURIComponent(currentContext.country)}`);
    }
    if (currentContext.channelId) {
      queryParams.push(`priceChannel=${encodeURIComponent(currentContext.channelId)}`);
    }
    if (currentContext.customerGroupId) {
      queryParams.push(`priceCustomerGroup=${encodeURIComponent(currentContext.customerGroupId)}`);
    }

    const url = `${apiUrl}/${projectKey}/in-store/key=${storeKey}/standalone-variant-projections/${variantId}${queryParams.length > 0 ? '?' + queryParams.join('&') : ''}`;

    const accessToken = await getAccessToken();
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    // Store API call information
    setVariantByIdApiInfo({
      endpoint: `/in-store/key=${storeKey}/standalone-variant-projections/${variantId}`,
      method: 'GET',
      fullUrl: url,
      queryParams: queryParams,
      status: response.status,
      headers: {
        'Authorization': `Bearer ${accessToken.substring(0, 20)}...`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch variant: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }, [context, getAccessToken]);

  // Fetch product type by key (hardcoded as "main" for now)
  const fetchProductType = useCallback(async (productTypeKey = 'main') => {
    const currentContext = context;
    if (!currentContext.projectKey || !currentContext.apiUrl) {
      throw new Error('Missing project configuration. Please configure on the home page.');
    }

    const projectKey = currentContext.projectKey;
    const apiUrl = currentContext.apiUrl;
    const url = `${apiUrl}/${projectKey}/product-types/key=${productTypeKey}`;

    const accessToken = await getAccessToken();
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    // Store API call information
    setProductTypeApiInfo({
      endpoint: `/product-types/key=${productTypeKey}`,
      method: 'GET',
      fullUrl: url,
      queryParams: [],
      status: response.status,
      headers: {
        'Authorization': `Bearer ${accessToken.substring(0, 20)}...`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch product type: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }, [context, getAccessToken]);

  // Fetch other variants (for tiles display)
  const fetchOtherVariants = useCallback(async (productId, excludeVariantId) => {
    const currentContext = context;
    if (!currentContext.projectKey || !currentContext.apiUrl) {
      throw new Error('Missing project configuration. Please configure on the home page.');
    }

    const projectKey = currentContext.projectKey;
    const apiUrl = currentContext.apiUrl;
    const storeKey = currentContext.storeKey || 'default';
    const whereClause = encodeURIComponent(`product(id="${productId}")`);
    const priceCurrency = currentContext.currency || 'EUR';

    // Build query parameters for price selection
    const queryParams = [];
    queryParams.push(`where=${whereClause}`);
    queryParams.push('staged=false');
    queryParams.push('limit=500');
    queryParams.push(`priceCurrency=${encodeURIComponent(priceCurrency)}`);

    // Add optional price selection parameters
    if (priceCurrency === 'USD') {
      queryParams.push(`priceCountry=${encodeURIComponent(currentContext.country || 'US')}`);
    } else if (currentContext.country) {
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
      throw new Error(`API Error: ${response.status} - ${errorText}`);
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

    // Filter out the excluded variant
    if (excludeVariantId && data?.results) {
      const excludeIdStr = excludeVariantId.toString();
      data.results = data.results.filter(v => {
        const vid = v.id?.variantId || v.id;
        return vid !== excludeIdStr && String(vid) !== excludeIdStr;
      });
    }

    return data.results || [];
  }, [context, getAccessToken]);

  // Fetch variant matrix for color/size selector
  const fetchVariantMatrix = useCallback(async (productId) => {
    const currentContext = context;
    if (!currentContext.projectKey || !currentContext.apiUrl) {
      throw new Error('Missing project configuration. Please configure on the home page.');
    }

    const projectKey = currentContext.projectKey;
    const apiUrl = currentContext.apiUrl;

    // Build query parameters
    const queryParams = [];
    queryParams.push('filter[attributes]=color');
    queryParams.push('filter[attributes]=size');
    queryParams.push('staged=false');

    const url = `${apiUrl}/${projectKey}/variant-matrix/${productId}?${queryParams.join('&')}`;

    const accessToken = await getAccessToken();
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    // Store API call information for display
    setVariantMatrixApiInfo({
      endpoint: `/variant-matrix/${productId}`,
      method: 'GET',
      fullUrl: url,
      queryParams: queryParams,
      status: response.status,
      headers: {
        'Authorization': `Bearer ${accessToken.substring(0, 20)}...`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch variant matrix: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }, [context, getAccessToken]);

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

    // Variant ID is required - if not provided, we can't proceed
    if (!requestedVariantId) {
      setError('Variant ID is required. Please provide a variant ID in the URL.');
      return;
    }

    try {
      setError(null); // Clear any previous errors

      // Step 1: Fetch the main variant by ID
      const selectedVariant = await fetchVariantById(requestedVariantId);
      setProduct(selectedVariant);

      // Step 2: Fetch product type (hardcoded as "main" for now)
      const productTypeData = await fetchProductType('main');
      setProductType(productTypeData);

      // Step 3: Fetch other variants for tiles display
      const otherVariantsList = await fetchOtherVariants(productId, requestedVariantId);
      setOtherVariants(otherVariantsList);

      // Store all variants (including selected) for attribute selector matching
      setAllVariants([selectedVariant, ...otherVariantsList]);
      setCurrentPage(1); // Reset to first page when product changes

      // Step 4: Fetch variant matrix for color/size selector
      const variantMatrixData = await fetchVariantMatrix(productId);
      setVariantMatrix(variantMatrixData);

    } catch (error) {
      console.error('Error fetching product:', error);
      setError(error.message);
    }
  }, [context, fetchVariantById, fetchProductType, fetchOtherVariants, fetchVariantMatrix]);

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
      setVariantMatrix(null);
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
      setVariantMatrix(null);
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

  // Color name to hex mapping for CSS - all 18 colors from product-type.json
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

  // Get product name and description from product if available, otherwise use first variant or empty
  const productName = product ? getLocalizedText(product.name, 'Unknown') : (allVariants.length > 0 ? getLocalizedText(allVariants[0]?.name, 'Unknown') : 'Unknown');
  const productDescription = product ? getLocalizedText(product.description, '') : (allVariants.length > 0 ? getLocalizedText(allVariants[0]?.description, '') : '');


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
      {productType && allVariants.length > 0 && (
        <div>
          {/* Product Type API Info Card */}
          {productTypeApiInfo && (
            <div style={{
              marginBottom: '20px',
              padding: '15px',
              border: '2px solid #28a745',
              borderRadius: '8px',
              backgroundColor: '#f0fff4',
              boxShadow: '0 2px 8px rgba(40,167,69,0.15)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4 style={{ margin: 0, color: '#28a745', fontSize: '16px', fontWeight: 'bold' }}>
                  📋 Product Type API Call
                </h4>
                <button
                  onClick={() => setShowProductTypeApiInfo(!showProductTypeApiInfo)}
                  style={{
                    padding: '5px 10px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '11px'
                  }}
                >
                  {showProductTypeApiInfo ? '▼ Hide' : '▶ Show'}
                </button>
              </div>

              {showProductTypeApiInfo && (
                <div style={{ fontSize: '13px', color: '#333' }}>
                  <div style={{ marginBottom: '8px' }}>
                    <strong style={{ color: '#28a745' }}>Endpoint:</strong>
                    <code style={{
                      display: 'block',
                      marginTop: '3px',
                      padding: '6px',
                      backgroundColor: '#fff',
                      borderRadius: '4px',
                      border: '1px solid #ddd',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      wordBreak: 'break-all'
                    }}>
                      {productTypeApiInfo.method} {productTypeApiInfo.endpoint}
                    </code>
                  </div>


                  <div>
                    <strong style={{ color: '#28a745' }}>Status:</strong>
                    <span style={{ marginLeft: '5px', color: productTypeApiInfo.status === 200 ? '#28a745' : '#dc3545' }}>
                      {productTypeApiInfo.status}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
          <AttributeSelector
            productType={productType}
            variants={allVariants}
            selectedVariant={product}
            onVariantChange={handleVariantChange}
            onFetchVariantById={async (variantId, productId) => {
              try {
                // Fetch the variant by ID immediately
                const selectedVariant = await fetchVariantById(variantId);
                setProduct(selectedVariant);

                // Refetch other variants to update the list
                const otherVariantsList = await fetchOtherVariants(productId, variantId);
                setOtherVariants(otherVariantsList);
                setAllVariants([selectedVariant, ...otherVariantsList]);
                setCurrentPage(1);
              } catch (error) {
                console.error('Error fetching variant by ID:', error);
                setError(error.message);
              }
            }}
            onQueryVariantByAttributes={async (size, color, style) => {
              try {
                // Use productId from product if available, otherwise from URL params or allVariants
                const productId = product?.product?.id || id || (allVariants.length > 0 ? allVariants[0]?.product?.id : null);
                if (!productId) {
                  setError('Product ID not available');
                  return;
                }

                // Build a query to find variants matching the attribute combination
                const currentContext = context;
                const projectKey = currentContext.projectKey;
                const apiUrl = currentContext.apiUrl;
                const storeKey = currentContext.storeKey || 'default';
                const priceCurrency = currentContext.currency || 'EUR';

                // Build where clause with attribute filters
                // For standalone variant projections, attributes are at the top level
                // Format: attributes(name="..." and value="...") and attributes(name="..." and value(key="..."))
                const whereConditions = [];

                // Always include product filter
                whereConditions.push(`product(id="${productId}")`);

                // Add attribute conditions - each attribute is a separate attributes() predicate
                // Only add attribute conditions if they have non-empty values
                if (size && size.trim() !== '') {
                  // Size is text type - use value directly
                  whereConditions.push(`attributes(name="size" and value="${size}")`);
                }
                if (color && color.trim() !== '') {
                  // Color is lenum type - but in standalone variant projections, enum values are stored as plain strings
                  // Use value="..." directly (not value(key="..."))
                  whereConditions.push(`attributes(name="color" and value="${color}")`);
                }
                if (style && style.trim() !== '') {
                  // Style is enum type - but in standalone variant projections, enum values are stored as plain strings
                  // Use value="..." directly (not value(key="..."))
                  whereConditions.push(`attributes(name="style" and value="${style}")`);
                }

                const whereClause = whereConditions.join(' and ');

                // Debug logging
                console.log('Query by attributes:', { size, color, style, productId, whereClause });

                // Build query parameters
                const queryParams = [];
                queryParams.push(`where=${encodeURIComponent(whereClause)}`);
                queryParams.push('staged=false');
                queryParams.push('limit=1'); // Just need one match
                queryParams.push(`priceCurrency=${encodeURIComponent(priceCurrency)}`);
                queryParams.push('expand=price.discounted.discount');

                if (priceCurrency === 'USD') {
                  queryParams.push(`priceCountry=${encodeURIComponent(currentContext.country || 'US')}`);
                } else if (currentContext.country) {
                  queryParams.push(`priceCountry=${encodeURIComponent(currentContext.country)}`);
                }
                if (currentContext.channelId) {
                  queryParams.push(`priceChannel=${encodeURIComponent(currentContext.channelId)}`);
                }
                if (currentContext.customerGroupId) {
                  queryParams.push(`priceCustomerGroup=${encodeURIComponent(currentContext.customerGroupId)}`);
                }

                const url = `${apiUrl}/${projectKey}/in-store/key=${storeKey}/standalone-variant-projections?${queryParams.join('&')}`;

                const accessToken = await getAccessToken();
                const response = await fetch(url, {
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                  }
                });

                // Clear the by ID API info since we're querying by attributes instead
                setVariantByIdApiInfo(null);

                // Store API call information for query by attributes
                const responseClone = response.clone();
                const dataForInfo = await responseClone.json().catch(() => ({}));
                setQueryByAttributesApiInfo({
                  endpoint: `/in-store/key=${storeKey}/standalone-variant-projections`,
                  method: 'GET',
                  fullUrl: url,
                  queryParams: queryParams,
                  status: response.status,
                  totalVariants: dataForInfo.total || 0,
                  variantsReturned: dataForInfo.results?.length || 0,
                  headers: {
                    'Authorization': `Bearer ${accessToken.substring(0, 20)}...`,
                    'Content-Type': 'application/json'
                  }
                });

                if (response.ok) {
                  const data = await response.json();
                  console.log('Query response:', {
                    total: data?.total,
                    resultsCount: data?.results?.length,
                    results: data?.results?.map(r => ({
                      id: r.id?.variantId || r.id,
                      sku: r.sku,
                      attributes: r.attributes?.map(a => ({ name: a.name, value: a.value }))
                    }))
                  });

                  if (data?.results?.length > 0) {
                    // Found a match! Use the variant data directly from the query result
                    const foundVariant = data.results[0];
                    const variantId = foundVariant.id?.variantId || foundVariant.id;
                    const foundProductId = foundVariant.product?.id;

                    console.log('Found variant:', { variantId, foundProductId, variant: foundVariant });

                    if (variantId && foundProductId) {
                      // Update URL
                      const newParams = new URLSearchParams(searchParams);
                      newParams.set('variant', variantId);
                      navigate(`/product-detail/${foundProductId}?${newParams.toString()}`, { replace: true });

                      // Use the variant data directly from the query - no need to fetch by ID again!
                      setProduct(foundVariant);

                      // Refetch other variants
                      const otherVariantsList = await fetchOtherVariants(foundProductId, variantId);
                      setOtherVariants(otherVariantsList);
                      setAllVariants([foundVariant, ...otherVariantsList]);
                      setCurrentPage(1);
                      setError(null); // Clear any previous errors
                    } else {
                      console.error('Variant found but missing ID or product ID:', foundVariant);
                      setError('Variant found but missing required IDs');
                    }
                  } else {
                    // No variant found - clear only the main product variant but keep other sections
                    console.log('No variants found in query response');
                    setProduct(null);
                    // Keep otherVariants and allVariants for display
                    // setOtherVariants([]);
                    // setAllVariants([]);
                    setError(`Variant does not exist for this combination in the current store`);
                  }
                } else {
                  const errorText = await response.text();
                  // Clear product state on API error too
                  setProduct(null);
                  setOtherVariants([]);
                  setAllVariants([]);
                  setError(`Failed to query variants: ${response.status} - ${errorText}`);
                }
              } catch (error) {
                console.error('Error querying variant by attributes:', error);
                setError(error.message);
              }
            }}
          />
        </div>
      )}

      {/* Main Variant by ID API Info Card */}
      {variantByIdApiInfo && (
        <div style={{
          marginBottom: '30px',
          padding: '20px',
          border: '2px solid #ff9800',
          borderRadius: '8px',
          backgroundColor: '#fff8e1',
          boxShadow: '0 2px 8px rgba(255,152,0,0.15)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: 0, color: '#ff9800', fontSize: '18px', fontWeight: 'bold' }}>
              🎯 Main Variant by ID API Call
            </h3>
            <button
              onClick={() => setShowVariantByIdApiInfo(!showVariantByIdApiInfo)}
              style={{
                padding: '5px 10px',
                backgroundColor: '#ff9800',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              {showVariantByIdApiInfo ? '▼ Hide' : '▶ Show'}
            </button>
          </div>

          {showVariantByIdApiInfo && (
            <div style={{ fontSize: '14px', color: '#333' }}>
              <div style={{ marginBottom: '12px' }}>
                <strong style={{ color: '#ff9800' }}>Endpoint:</strong>
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
                  {variantByIdApiInfo.method} {variantByIdApiInfo.endpoint}
                </code>
              </div>


              <div style={{ marginBottom: '12px' }}>
                <strong style={{ color: '#ff9800' }}>Query Parameters:</strong>
                <div style={{
                  marginTop: '5px',
                  padding: '8px',
                  backgroundColor: '#fff',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  fontFamily: 'monospace',
                  fontSize: '12px'
                }}>
                  {variantByIdApiInfo.queryParams.length > 0 ? (
                    variantByIdApiInfo.queryParams.map((param, idx) => {
                      const [key, value] = param.split('=');
                      return (
                        <div key={idx} style={{ marginBottom: '4px' }}>
                          <span style={{ color: '#28a745', fontWeight: 'bold' }}>{decodeURIComponent(key)}</span>
                          <span style={{ color: '#666' }}> = </span>
                          <span style={{ color: '#dc3545' }}>{decodeURIComponent(value || '')}</span>
                        </div>
                      );
                    })
                  ) : (
                    <span style={{ color: '#666', fontStyle: 'italic' }}>None</span>
                  )}
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <strong style={{ color: '#ff9800' }}>Status:</strong>
                <span style={{ marginLeft: '5px', color: variantByIdApiInfo.status === 200 ? '#28a745' : '#dc3545' }}>
                  {variantByIdApiInfo.status}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Query by Attributes API Info Card */}
      {queryByAttributesApiInfo && (
        <div style={{
          marginBottom: '30px',
          padding: '20px',
          border: '2px solid #9c27b0',
          borderRadius: '8px',
          backgroundColor: '#f3e5f5',
          boxShadow: '0 2px 8px rgba(156,39,176,0.15)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: 0, color: '#9c27b0', fontSize: '18px', fontWeight: 'bold' }}>
              🔍 Query by Attributes API Call
            </h3>
            <button
              onClick={() => setShowQueryByAttributesApiInfo(!showQueryByAttributesApiInfo)}
              style={{
                padding: '5px 10px',
                backgroundColor: '#9c27b0',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              {showQueryByAttributesApiInfo ? '▼ Hide' : '▶ Show'}
            </button>
          </div>

          {showQueryByAttributesApiInfo && (
            <div style={{ fontSize: '14px', color: '#333' }}>
              <div style={{ marginBottom: '12px' }}>
                <strong style={{ color: '#9c27b0' }}>Endpoint:</strong>
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
                  {queryByAttributesApiInfo.method} {queryByAttributesApiInfo.endpoint}
                </code>
              </div>


              <div style={{ marginBottom: '12px' }}>
                <strong style={{ color: '#9c27b0' }}>Query Parameters:</strong>
                <div style={{
                  marginTop: '5px',
                  padding: '8px',
                  backgroundColor: '#fff',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  fontFamily: 'monospace',
                  fontSize: '12px'
                }}>
                  {queryByAttributesApiInfo.queryParams.map((param, idx) => {
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
                  <strong style={{ color: '#9c27b0' }}>Status:</strong>
                  <span style={{ marginLeft: '5px', color: queryByAttributesApiInfo.status === 200 ? '#28a745' : '#dc3545' }}>
                    {queryByAttributesApiInfo.status}
                  </span>
                </div>
                <div>
                  <strong style={{ color: '#9c27b0' }}>Total Variants:</strong>
                  <span style={{ marginLeft: '5px' }}>{queryByAttributesApiInfo.totalVariants}</span>
                </div>
                <div>
                  <strong style={{ color: '#9c27b0' }}>Variants Returned:</strong>
                  <span style={{ marginLeft: '5px' }}>{queryByAttributesApiInfo.variantsReturned}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Variant Information Section */}
      {product ? (
        <div style={{
          marginBottom: '30px',
          padding: '25px',
          border: '1px solid #ddd',
          borderRadius: '8px',
          backgroundColor: '#fff',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
        }}>
          <h2 style={{ marginBottom: '20px', color: '#333', fontSize: '24px' }}>Variant Information</h2>
          <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
            {/* Left Column: Basic info, images, price */}
            <div style={{ flex: '1', minWidth: '300px' }}>
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
              {(!product.availability || !product.availability.isOnStock) && (
                <div style={{ marginBottom: '10px', fontSize: '16px' }}>
                  <strong style={{ color: '#EB1A0B' }}>Out of Stock</strong>
                </div>
              )}
              {product.availability && product.availability.isOnStock && (
                <div style={{ marginBottom: '10px', fontSize: '16px' }}>
                  <strong style={{ color: '#1bce00' }}>In Stock</strong>
                    <div style={{ marginBottom: '10px', fontSize: '16px' }}>
                      <strong style={{ color: '#555' }}>Quantity:</strong> <span style={{ color: '#333' }}>{product.availability.availableQuantity}</span>
                    </div>
                </div>
              )}
              {product.images?.length > 0 && (() => {
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

              <VariantInfo priceMode="Standalone" variant={product} showAttributes={false} />
            </div>

            {/* Right Column: Attributes */}
            {product.attributes && product.attributes.length > 0 && (
              <div style={{
                flex: '1',
                minWidth: '250px',
                padding: '15px',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                border: '1px solid #e9ecef'
              }}>
                <h3 style={{ marginBottom: '15px', color: '#555', fontSize: '18px' }}>Attributes</h3>
                <div style={{ fontSize: '14px', lineHeight: '1.8' }}>
                  {product.attributes.map(attr => {
                    let value = JSON.stringify(attr.value, null, '\t');
                    if (typeof attr.value === 'object' && attr.value?.label !== undefined && typeof attr.value.label === 'object') {
                      value = attr.value.label[config.locale] || attr.value.label['en'] || Object.values(attr.value.label)[0];
                    } else if (typeof attr.value === 'boolean') {
                      value = attr.value ? 'true' : 'false';
                    }
                    return (
                      <div key={attr.name} style={{ marginBottom: '8px' }}>
                        <strong style={{ color: '#555' }}>{attr.name}:</strong>{' '}
                        <span style={{ color: '#333' }}>{value}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{
          marginBottom: '30px',
          padding: '25px',
          border: '1px solid #ddd',
          borderRadius: '8px',
          backgroundColor: '#fff',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
        }}>
          <h2 style={{ marginBottom: '20px', color: '#333', fontSize: '24px' }}>Variant Information</h2>
          {error && (
            <div style={{
              padding: '15px',
              backgroundColor: '#fff3cd',
              border: '1px solid #ffc107',
              borderRadius: '5px',
              color: '#856404'
            }}>
              <strong>⚠️ </strong>{error}
            </div>
          )}
        </div>
      )}


      {/* Variant Matrix Selector */}
      {variantMatrix && variantMatrix.variants?.length > 0 && (() => {
        // Extract current color and size from selected variant
        const getCurrentColor = () => {
          if (!product) return null;
          const colorAttr = product.attributes?.find(a => a.name === 'color');
          if (!colorAttr) return null;
          // Handle both string and object format
          if (typeof colorAttr.value === 'string') return colorAttr.value;
          return colorAttr.value?.key || null;
        };

        const getCurrentSize = () => {
          if (!product) return null;
          const sizeAttr = product.attributes?.find(a => a.name === 'size');
          return sizeAttr ? String(sizeAttr.value) : null;
        };

        const currentColor = getCurrentColor();
        const currentSize = getCurrentSize();

        // Extract unique colors from variant matrix (only colors that have variants)
        const getUniqueColors = () => {
          const colorsMap = new Map();
          variantMatrix.variants.forEach(v => {
            const colorAttr = v.attributes?.color;
            if (colorAttr) {
              const key = colorAttr.key;
              const label = colorAttr.label?.en || colorAttr.label || key;
              if (!colorsMap.has(key)) {
                colorsMap.set(key, { key, label });
              }
            }
          });
          return Array.from(colorsMap.values());
        };

        // Extract unique sizes from variant matrix (only sizes that have variants)
        const getUniqueSizes = () => {
          const sizesSet = new Set();
          variantMatrix.variants.forEach(v => {
            const sizeAttr = v.attributes?.size;
            if (sizeAttr) {
              sizesSet.add(String(sizeAttr));
            }
          });
          // Sort sizes numerically when possible
          return Array.from(sizesSet).sort((a, b) => {
            const numA = parseFloat(a);
            const numB = parseFloat(b);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return a.localeCompare(b);
          });
        };

        const uniqueColors = getUniqueColors();
        const uniqueSizes = getUniqueSizes();

        // Find variant by color and size from variant matrix
        const findVariantByColorAndSize = (colorKey, size) => {
          return variantMatrix.variants.find(v => {
            const vColor = v.attributes?.color?.key;
            const vSize = v.attributes?.size ? String(v.attributes.size) : null;
            return vColor === colorKey && vSize === size;
          });
        };

        // Check if a variant is in stock
        const isInStock = (variant) => {
          return variant && variant.availableQuantity !== null && variant.availableQuantity > 0;
        };

        // Check if a color has any in-stock variant with the current size
        const isColorAvailableForCurrentSize = (colorKey) => {
          const variant = findVariantByColorAndSize(colorKey, currentSize);
          return variant ? isInStock(variant) : false;
        };

        // Check if a size has any in-stock variant with the current color
        const isSizeAvailableForCurrentColor = (size) => {
          const variant = findVariantByColorAndSize(currentColor, size);
          return variant ? isInStock(variant) : false;
        };

        // Check if a color/size combination exists (regardless of stock)
        const doesColorSizeCombinationExist = (colorKey, size) => {
          return !!findVariantByColorAndSize(colorKey, size);
        };

        // Get available sizes for a color (for display purposes)
        const getAvailableSizesForColor = (colorKey) => {
          return variantMatrix.variants
            .filter(v => v.attributes?.color?.key === colorKey)
            .map(v => ({
              size: String(v.attributes?.size || ''),
              inStock: isInStock(v)
            }));
        };

        // Get available colors for a size (for display purposes)
        const getAvailableColorsForSize = (size) => {
          return variantMatrix.variants
            .filter(v => String(v.attributes?.size || '') === size)
            .map(v => ({
              colorKey: v.attributes?.color?.key,
              inStock: isInStock(v)
            }));
        };

        // Handle color click
        const handleColorClick = (colorKey) => {
          // Try to find variant with (clicked color + current size)
          let targetVariant = findVariantByColorAndSize(colorKey, currentSize);

          // If not found, try to find any variant with clicked color
          if (!targetVariant) {
            targetVariant = variantMatrix.variants.find(v => v.attributes?.color?.key === colorKey);
          }

          if (targetVariant) {
            const newVariantId = targetVariant.id;
            const productId = variantMatrix.productId;
            navigate(`/product-detail/${productId}?variant=${newVariantId}`, { replace: true, preventScrollReset: true });
          }
        };

        // Handle size click
        const handleSizeClick = (size) => {
          // Try to find variant with (current color + clicked size)
          let targetVariant = findVariantByColorAndSize(currentColor, size);

          // If not found, try to find any variant with clicked size
          if (!targetVariant) {
            targetVariant = variantMatrix.variants.find(v => String(v.attributes?.size || '') === size);
          }

          if (targetVariant) {
            const newVariantId = targetVariant.id;
            const productId = variantMatrix.productId;
            navigate(`/product-detail/${productId}?variant=${newVariantId}`, { replace: true, preventScrollReset: true });
          }
        };

        return (
          <div style={{
            marginTop: '30px',
            padding: '25px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            backgroundColor: '#fff',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
          }}>
            <h2 style={{ marginBottom: '20px', color: '#333', fontSize: '24px' }}>
              Variant Selector ({variantMatrix.variants.length} variants)
            </h2>

            {/* Variant Matrix API Info Card */}
            {variantMatrixApiInfo && (
              <div style={{
                marginBottom: '20px',
                padding: '15px',
                border: '2px solid #17a2b8',
                borderRadius: '8px',
                backgroundColor: '#e7f6f8',
                boxShadow: '0 2px 8px rgba(23,162,184,0.15)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h4 style={{ margin: 0, color: '#17a2b8', fontSize: '16px', fontWeight: 'bold' }}>
                    🔲 Variant Matrix API Call
                  </h4>
                  <button
                    onClick={() => setShowVariantMatrixApiInfo(!showVariantMatrixApiInfo)}
                    style={{
                      padding: '5px 10px',
                      backgroundColor: '#17a2b8',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '11px'
                    }}
                  >
                    {showVariantMatrixApiInfo ? '▼ Hide' : '▶ Show'}
                  </button>
                </div>

                {showVariantMatrixApiInfo && (
                  <div style={{ fontSize: '13px', color: '#333' }}>
                    <div style={{ marginBottom: '8px' }}>
                      <strong style={{ color: '#17a2b8' }}>Endpoint:</strong>
                      <code style={{
                        display: 'block',
                        marginTop: '3px',
                        padding: '6px',
                        backgroundColor: '#fff',
                        borderRadius: '4px',
                        border: '1px solid #ddd',
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        wordBreak: 'break-all'
                      }}>
                        {variantMatrixApiInfo.method} {variantMatrixApiInfo.endpoint}
                      </code>
                    </div>

                    <div style={{ marginBottom: '8px' }}>
                      <strong style={{ color: '#17a2b8' }}>Query Parameters:</strong>
                      <div style={{
                        marginTop: '3px',
                        padding: '6px',
                        backgroundColor: '#fff',
                        borderRadius: '4px',
                        border: '1px solid #ddd',
                        fontFamily: 'monospace',
                        fontSize: '11px'
                      }}>
                        {variantMatrixApiInfo.queryParams.map((param, idx) => (
                          <div key={idx}>{param}</div>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                      <div>
                        <strong style={{ color: '#17a2b8' }}>Status:</strong>
                        <span style={{ marginLeft: '5px', color: variantMatrixApiInfo.status === 200 ? '#28a745' : '#dc3545' }}>
                          {variantMatrixApiInfo.status}
                        </span>
                      </div>
                      <div>
                        <strong style={{ color: '#17a2b8' }}>Variants:</strong>
                        <span style={{ marginLeft: '5px' }}>{variantMatrix.variants.length}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Color Selector */}
            {uniqueColors.length > 0 && (
              <div style={{ marginBottom: '25px' }}>
                <h3 style={{ marginBottom: '15px', color: '#555', fontSize: '18px' }}>
                  Color
                  {currentColor && <span style={{ fontWeight: 'normal', marginLeft: '10px', color: '#888' }}>
                    (selected: {currentColor})
                  </span>}
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {uniqueColors.map(color => {
                    const isSelected = color.key === currentColor;
                    const combinationExists = currentSize ? doesColorSizeCombinationExist(color.key, currentSize) : true;
                    const isAvailable = currentSize ? isColorAvailableForCurrentSize(color.key) : true;
                    const availableSizes = getAvailableSizesForColor(color.key);
                    const hasAnyStock = availableSizes.some(s => s.inStock);
                    const hexColor = colorToHex(color.key);

                    // Determine if we should show strike-through
                    // Strike through if: combination exists but out of stock, OR no stock at all for this color
                    const showStrikeThrough = !hasAnyStock || (combinationExists && !isAvailable);

                    return (
                      <button
                        key={color.key}
                        onClick={() => handleColorClick(color.key)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '10px 15px',
                          border: isSelected ? '3px solid #007bff' : '2px solid #ddd',
                          borderRadius: '8px',
                          backgroundColor: isSelected ? '#e3f2fd' : '#fff',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          textDecoration: showStrikeThrough ? 'line-through' : 'none',
                          opacity: showStrikeThrough ? 0.6 : 1,
                          boxShadow: isSelected ? '0 2px 8px rgba(0,123,255,0.25)' : 'none'
                        }}
                        title={`${color.label} - ${availableSizes.filter(s => s.inStock).length}/${availableSizes.length} sizes in stock`}
                      >
                        <span style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: hexColor,
                          border: hexColor === '#FFFFFF' ? '1px solid #ccc' : '1px solid transparent',
                          display: 'inline-block'
                        }}></span>
                        <span style={{
                          fontSize: '14px',
                          fontWeight: isSelected ? 'bold' : 'normal',
                          color: showStrikeThrough ? '#999' : '#333'
                        }}>
                          {color.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Size Selector */}
            {uniqueSizes.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ marginBottom: '15px', color: '#555', fontSize: '18px' }}>
                  Size
                  {currentSize && <span style={{ fontWeight: 'normal', marginLeft: '10px', color: '#888' }}>
                    (selected: {currentSize})
                  </span>}
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {uniqueSizes.map(size => {
                    const isSelected = size === currentSize;
                    const combinationExists = currentColor ? doesColorSizeCombinationExist(currentColor, size) : true;
                    const isAvailable = currentColor ? isSizeAvailableForCurrentColor(size) : true;
                    const availableColors = getAvailableColorsForSize(size);
                    const hasAnyStock = availableColors.some(c => c.inStock);

                    // Strike through if: combination exists but out of stock, OR no stock at all for this size
                    const showStrikeThrough = !hasAnyStock || (combinationExists && !isAvailable);

                    return (
                      <button
                        key={size}
                        onClick={() => handleSizeClick(size)}
                        style={{
                          padding: '10px 20px',
                          border: isSelected ? '3px solid #007bff' : '2px solid #ddd',
                          borderRadius: '8px',
                          backgroundColor: isSelected ? '#e3f2fd' : '#fff',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          textDecoration: showStrikeThrough ? 'line-through' : 'none',
                          opacity: showStrikeThrough ? 0.6 : 1,
                          fontSize: '14px',
                          fontWeight: isSelected ? 'bold' : 'normal',
                          color: showStrikeThrough ? '#999' : '#333',
                          minWidth: '50px',
                          boxShadow: isSelected ? '0 2px 8px rgba(0,123,255,0.25)' : 'none'
                        }}
                        title={`Size ${size} - ${availableColors.filter(c => c.inStock).length}/${availableColors.length} colors in stock`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Show current combination availability */}
            {currentColor && currentSize && (
              <div style={{
                marginTop: '20px',
                padding: '15px',
                borderRadius: '8px',
                backgroundColor: doesColorSizeCombinationExist(currentColor, currentSize)
                  ? (isColorAvailableForCurrentSize(currentColor) ? '#d4edda' : '#fff3cd')
                  : '#f8d7da',
                border: '1px solid',
                borderColor: doesColorSizeCombinationExist(currentColor, currentSize)
                  ? (isColorAvailableForCurrentSize(currentColor) ? '#c3e6cb' : '#ffc107')
                  : '#f5c6cb'
              }}>
                {doesColorSizeCombinationExist(currentColor, currentSize) ? (
                  isColorAvailableForCurrentSize(currentColor) ? (
                    <span style={{ color: '#155724' }}>
                      ✓ {currentColor} / Size {currentSize} is <strong>in stock</strong>
                      {(() => {
                        const variant = findVariantByColorAndSize(currentColor, currentSize);
                        return variant ? ` (${variant.availableQuantity} available)` : '';
                      })()}
                    </span>
                  ) : (
                    <span style={{ color: '#856404' }}>
                      ⚠ {currentColor} / Size {currentSize} is <strong>out of stock</strong>
                    </span>
                  )
                ) : (
                  <span style={{ color: '#721c24' }}>
                    ✗ {currentColor} / Size {currentSize} combination <strong>does not exist</strong>
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

export default ProductDetailPage;
