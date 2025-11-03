import config from '../../config';
import { useContext, useState, useEffect } from 'react';
import AppContext from '../../appContext';

function StorePicker() {

  const [context, setContext] = useContext(AppContext);
  const [fetched, setFetched] = useState(false);
  const [stores, setStores] = useState([]);
  const [error, setError] = useState(null);
  
  const onChangeStore = (event) => {
    const key = event.target.value;
    if (key && stores.length > 0) {
      const store = stores.find(s => s.key === key);
      if (store) {
        const storeName = store.name[config.locale];
        setContext({ ...context, storeKey: key, storeName });
        sessionStorage.setItem('storeKey', key);
        sessionStorage.setItem('storeName', storeName);
      }
    } else {
      setContext({ ...context, storeKey: null, storeName: null });
      sessionStorage.removeItem('storeKey');
      sessionStorage.removeItem('storeName');
    }
  }

  useEffect(() => {
    if (context.projectKey && context.apiUrl) {
      fetchStores();
    }
  }, [context.projectKey, context.apiUrl]);

  const getAccessToken = async () => {
    const authUrl = context.authUrl || process.env.REACT_APP_AUTH_URL;
    const clientId = context.clientId || process.env.REACT_APP_CLIENT_ID;
    const clientSecret = context.clientSecret || process.env.REACT_APP_CLIENT_SECRET;
    
    if (!authUrl || !clientId || !clientSecret) {
      throw new Error('Missing credentials');
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

  async function fetchStores() {
    if (fetched) return;
    setFetched(true);

    try {
      const projectKey = context.projectKey || process.env.REACT_APP_PROJECT_KEY;
      const apiUrl = context.apiUrl || process.env.REACT_APP_API_URL;
      const storesUrl = `${apiUrl}/${projectKey}/stores?limit=200&sort=name.${config.locale} asc`;
      
      const accessToken = await getAccessToken();
      const response = await fetch(storesUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const isPermissionError = response.status === 403 || response.status === 401;
        setError(isPermissionError ? 'No permission to view stores' : `Failed to fetch stores: ${response.status}`);
        return;
      }
      
      const data = await response.json();
      if (data?.results) {
        setStores(data.results);
      } else {
        setError('No stores found');
      }
    } catch (error) {
      console.error('Error fetching stores:', error);
      setError(error.message);
    }
  };

  const storeOptions = stores.length 
    ? stores.map(s => <option key={s.key} value={s.key}>{s.name[config.locale]}</option>)
    : [];

  const storeKey = context?.storeKey || '';

  return (
    <div>
      Store:&nbsp;&nbsp;  
      <select value={storeKey} onChange={onChangeStore} disabled={error && stores.length === 0}>
        <option value="">(none selected)</option>
        {storeOptions}
      </select>
      {error && <span style={{color: 'orange', marginLeft: '10px'}}>{error}</span>}
    </div>
  );
      
}

export default StorePicker;