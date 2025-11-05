import { useContext, useState, useEffect } from 'react';
import AppContext from '../../appContext';

function CurrencyPicker() {

  const [context, setContext] = useContext(AppContext);

  const onChangeCurrency = (event) => {
    const currency = event.target.value;
    setContext({ ...context, currency });
    sessionStorage.setItem('currency', currency);
  }

  const [currencies, setCurrencies] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (context.projectKey && context.apiUrl) {
      fetchCurrencies();
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

  async function fetchCurrencies() {
    if (currencies.length || !context.projectKey) return;
    
    try {
      const projectKey = context.projectKey || process.env.REACT_APP_PROJECT_KEY;
      const apiUrl = context.apiUrl || process.env.REACT_APP_API_URL;
      const projectUrl = `${apiUrl}/${projectKey}`;
      
      const accessToken = await getAccessToken();
      const response = await fetch(projectUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        setError(`Failed to fetch project: ${response.status}`);
        return;
      }
      
      const data = await response.json();
      if (data?.currencies) {
        setCurrencies(data.currencies);
      } else {
        setError('No currencies found in project');
      }
    } catch (error) {
      console.error('Error fetching currencies:', error);
      setError(error.message);
    }
  };

  const currencyOptions = currencies.length 
    ? currencies.map(c => <option key={c} value={c}>{c}</option>)
    : [];
  
  const currency = context?.currency || '';

  return (
    <div>
      Currency:&nbsp;&nbsp;  
      <select 
        value={currency} 
        onChange={onChangeCurrency}
        style={{ 
          padding: '5px 10px', 
          fontSize: '14px', 
          minWidth: '150px',
          backgroundColor: '#fff',
          color: '#333',
          border: '1px solid #ccc',
          borderRadius: '4px'
        }}
      >
        <option value="">(none selected)</option>
        {currencyOptions}
      </select>
      {error && <span style={{color: 'red', marginLeft: '10px'}}>Error: {error}</span>}
      {!error && currencies.length === 0 && <span style={{color: 'gray', marginLeft: '10px'}}>Loading...</span>}
    </div>
  );
      
}

export default CurrencyPicker;