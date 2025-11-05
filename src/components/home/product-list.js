import { useEffect, useState, useCallback, useContext } from 'react';
import ProductListEntry from './product-list-entry';
import AppContext from '../../appContext';

const ProductList = (props) => {
  const [context] = useContext(AppContext);
  const [products, setProducts] = useState([]);

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

  const getProducts = useCallback(async (searchStr) => {
    if (!context.projectKey || !context.apiUrl) {
      console.warn('Project key or API URL not set. Please configure on home page.');
      setProducts([]);
      return;
    }

    try {
      const projectKey = context.projectKey;
      const apiUrl = context.apiUrl;
      
      // Build query parameters
      const priceCurrency = props.scoped?.currency || 'EUR';
      const queryArgs = {
        staged: false,
        limit: 500, // Fetch many variants to ensure we get ~100 unique products after grouping
        priceCurrency: priceCurrency,
      };

      if (searchStr) {
        queryArgs.where = `name.en="${searchStr}"`;
      }

      // USD prices require country=US, so automatically set it for USD currency
      if (priceCurrency === 'USD') {
        queryArgs.priceCountry = props.scoped?.country || 'US';
      } else if (props.scoped?.country) {
        queryArgs.priceCountry = props.scoped.country;
      }

      // Get access token and fetch variants
      const accessToken = await getAccessToken();
      const url = `${apiUrl}/${projectKey}/standalone-variant-projections?${new URLSearchParams(queryArgs).toString()}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data?.results) {
        // Group variants by product ID - show one variant per product (max 100 products)
        const productsMap = new Map();
        data.results.forEach((variant) => {
          const productId = variant.product?.id;
          if (productId && !productsMap.has(productId) && productsMap.size < 100) {
            productsMap.set(productId, variant);
          }
        });
        
        setProducts(Array.from(productsMap.values()));
      } else {
        setProducts([]);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
    }
  }, [props.scoped, context]);

  useEffect(() => {
    // Load products on mount and when search/scoped changes
    getProducts(props.search || '');
  }, [props.search, getProducts]);

  if (products.length === 0) {
    return <div>no results</div>;
  }

  return (
    <div>
      <ul>
        {products.map(product => (
          <ProductListEntry 
            key={product.id || `${product.product?.id}-${product.sku}`} 
            product={product}
          />
        ))}
      </ul>
    </div>
  );
}

export default ProductList;
