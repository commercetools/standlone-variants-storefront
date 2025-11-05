import { useState, useContext, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import SearchInput from './search-input';
import ProductList from './product-list';
import ContextDisplay from '../context/context-display';
import AppContext from '../../appContext';
import config from '../../config';
import { initializeClients } from '../../commercetools';

function HomePage() {
  const [context, setContext] = useContext(AppContext);
  const [searchParams, setSearchParams] = useSearchParams();
  const [isSubmitted, setSubmitted] = useState(false);
  const [search, setSearch] = useState('');
  const [scoped, setScoped] = useState(false);
  const hasAutoConnected = useRef(false);

  // Get credentials from URL params, context, or env vars
  const getInitialValue = (paramName, contextKey, envVar) => {
    const urlParam = searchParams.get(paramName);
    if (urlParam) {
      try {
        return decodeURIComponent(urlParam);
      } catch {
        return urlParam;
      }
    }
    return context[contextKey] || process.env[envVar] || '';
  };

  // Form fields for credentials
  const [projectKey, setProjectKey] = useState(() => getInitialValue('projectKey', 'projectKey', 'REACT_APP_PROJECT_KEY'));
  const [clientId, setClientId] = useState(() => getInitialValue('clientId', 'clientId', 'REACT_APP_CLIENT_ID'));
  const [clientSecret, setClientSecret] = useState(() => getInitialValue('clientSecret', 'clientSecret', ''));
  const [authUrl, setAuthUrl] = useState(() => getInitialValue('authUrl', 'authUrl', 'REACT_APP_AUTH_URL'));
  const [apiUrl, setApiUrl] = useState(() => getInitialValue('apiUrl', 'apiUrl', 'REACT_APP_API_URL'));

  // Auto-connect if URL parameters are provided (only projectKey, clientId, clientSecret)
  useEffect(() => {
    // Only run once on mount
    if (hasAutoConnected.current) {
      return;
    }

    const urlProjectKey = searchParams.get('projectKey');
    const urlClientId = searchParams.get('clientId');
    const urlClientSecret = searchParams.get('clientSecret');

    // Check if we have all required URL parameters
    if (urlProjectKey && urlClientId && urlClientSecret) {
      hasAutoConnected.current = true;

      // Decode URL parameters
      try {
        const decodedProjectKey = decodeURIComponent(urlProjectKey);
        const decodedClientId = decodeURIComponent(urlClientId);
        const decodedClientSecret = decodeURIComponent(urlClientSecret);

        // Use env vars or context for authUrl and apiUrl
        const authUrlToUse = context.authUrl || process.env.REACT_APP_AUTH_URL || '';
        const apiUrlToUse = context.apiUrl || process.env.REACT_APP_API_URL || '';

        // Update form fields
        setProjectKey(decodedProjectKey);
        setClientId(decodedClientId);
        setClientSecret(decodedClientSecret);
        setAuthUrl(authUrlToUse);
        setApiUrl(apiUrlToUse);

        // Auto-connect
        const newContext = {
          ...context,
          projectKey: decodedProjectKey,
          clientId: decodedClientId,
          clientSecret: decodedClientSecret,
          authUrl: authUrlToUse,
          apiUrl: apiUrlToUse
        };
        setContext(newContext);
        sessionStorage.setItem('projectKey', decodedProjectKey);
        sessionStorage.setItem('clientId', decodedClientId);
        sessionStorage.setItem('clientSecret', decodedClientSecret);
        sessionStorage.setItem('authUrl', authUrlToUse);
        sessionStorage.setItem('apiUrl', apiUrlToUse);
        
        // Initialize commercetools clients
        try {
          const result = initializeClients({
            projectKey: decodedProjectKey,
            clientId: decodedClientId,
            clientSecret: decodedClientSecret,
            authUrl: authUrlToUse,
            apiUrl: apiUrlToUse
          });
          if (result) {
            console.log('commercetools clients initialized successfully from URL parameters');
          } else {
            console.error('Failed to initialize commercetools clients from URL parameters');
          }
        } catch (error) {
          console.error('Error initializing commercetools clients from URL parameters:', error);
        }

        // Optionally clean URL after connecting (remove sensitive params)
        // Uncomment the line below if you want to remove params from URL after connection
        // setSearchParams({});
      } catch (error) {
        console.error('Error parsing URL parameters:', error);
      }
    }
  }, [searchParams, context, setContext]); // Include dependencies to satisfy React hooks rules

  const onChangeSearch = (event) => {
    setSearch(event.target.value);
    setSubmitted(false);
  }

  const onSubmit = () => {
    setSubmitted(true);
  }

  const onSetScoped = (event) => {
    setScoped(event.target.checked === true);
  }

  const onConnect = () => {
    // Save credentials to context and sessionStorage
    const newContext = {
      ...context,
      projectKey,
      clientId,
      clientSecret,
      authUrl,
      apiUrl
    };
    setContext(newContext);
    sessionStorage.setItem('projectKey', projectKey);
    sessionStorage.setItem('clientId', clientId);
    sessionStorage.setItem('clientSecret', clientSecret);
    sessionStorage.setItem('authUrl', authUrl);
    sessionStorage.setItem('apiUrl', apiUrl);
    
    // Initialize commercetools clients with the new configuration
    try {
      const result = initializeClients({
        projectKey,
        clientId,
        clientSecret,
        authUrl,
        apiUrl
      });
      if (result) {
        console.log('commercetools clients initialized successfully');
        // Force re-render to update components
        window.location.reload();
      } else {
        console.error('Failed to initialize commercetools clients');
        alert('Failed to initialize clients. Please check your configuration.');
      }
    } catch (error) {
      console.error('Error initializing commercetools clients:', error);
      alert('Error initializing clients: ' + error.message);
    }
  }
  
  // Initialize from sessionStorage on mount if available
  useEffect(() => {
    const storedProjectKey = sessionStorage.getItem('projectKey');
    const storedClientId = sessionStorage.getItem('clientId');
    const storedClientSecret = sessionStorage.getItem('clientSecret');
    const storedAuthUrl = sessionStorage.getItem('authUrl');
    const storedApiUrl = sessionStorage.getItem('apiUrl');
    
    if (storedProjectKey && storedClientId && storedClientSecret && storedAuthUrl && storedApiUrl) {
      try {
        initializeClients({
          projectKey: storedProjectKey,
          clientId: storedClientId,
          clientSecret: storedClientSecret,
          authUrl: storedAuthUrl,
          apiUrl: storedApiUrl
        });
      } catch (error) {
        console.error('Error initializing from sessionStorage:', error);
      }
    }
  }, []);


  const displayProjectKey = context.projectKey || process.env.REACT_APP_PROJECT_KEY || '(not set)';

  return (
    <div className="App">
      <ContextDisplay />

      <div style={{ border: '1px solid #ccc', padding: '15px', marginBottom: '20px', borderRadius: '5px' }}>
        <h3>Configuration</h3>
        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Project Key:
            <input
              type="text"
              value={projectKey}
              onChange={(e) => setProjectKey(e.target.value)}
              placeholder="e.g. sv-poc-1000-abc123"
              style={{ marginLeft: '10px', width: '300px', padding: '5px' }}
            />
          </label>
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Client ID:
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="e.g. sphere-prototype-internal.1.0"
              style={{ marginLeft: '10px', width: '300px', padding: '5px' }}
            />
          </label>
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Client Secret:
            <input
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="Enter client secret"
              style={{ marginLeft: '10px', width: '300px', padding: '5px' }}
            />
          </label>
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Auth URL:
            <input
              type="text"
              value={authUrl}
              onChange={(e) => setAuthUrl(e.target.value)}
              placeholder="https://...auth...commercetools.com"
              style={{ marginLeft: '10px', width: '400px', padding: '5px' }}
            />
          </label>
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            API URL:
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://...api...commercetools.com"
              style={{ marginLeft: '10px', width: '400px', padding: '5px' }}
            />
          </label>
        </div>
        <button
          onClick={onConnect}
          style={{
            padding: '8px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            marginTop: '10px'
          }}
        >
          Connect
        </button>
      </div>

      <span className="small">
        Connected to commercetools project: <strong>{displayProjectKey}</strong><br />
        Locale: {config.locale}
      </span>
      <hr></hr>
      Enter search string to search for products:
      <p />&nbsp;
      <SearchInput onChange={onChangeSearch} onSubmit={onSubmit} />
      <input type="checkbox" onChange={onSetScoped} /> Use Scoped Pricing <br></br>
      <ProductList search={isSubmitted ? search : ''} scoped={scoped} />
    </div>
  );
}

export default HomePage;