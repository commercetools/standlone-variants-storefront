import { useContext, useState, useEffect } from 'react';
import AppContext from '../../appContext';

function CountryPicker() {

  const [context, setContext] = useContext(AppContext);
  
  const onChangeCountry = (event) => {
    const country = event.target.value;
    setContext({ ...context, country });
    sessionStorage.setItem('country', country);
  }

  const [countries, setCountries] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (context.projectKey && context.apiUrl) {
      fetchCountries();
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

  async function fetchCountries() {
    if (countries.length) return;
    
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
      if (data?.countries) {
        setCountries(data.countries);
      } else {
        setError('No countries found in project');
      }
    } catch (error) {
      console.error('Error fetching countries:', error);
      setError(error.message);
    }
  };

  const countryOptions = countries.length 
    ? countries.map(c => <option key={c} value={c}>{c}</option>)
    : [];
  
  const selected = context?.country || '';

  return (
    <div>
      Country:&nbsp;&nbsp;  
      <select value={selected} onChange={onChangeCountry}>
        <option value="">(none selected)</option>
        {countryOptions}
      </select>
      {error && <span style={{color: 'red', marginLeft: '10px'}}>Error: {error}</span>}
    </div>
  );
      
}

export default CountryPicker;