import { useContext, useState, useEffect } from 'react';
import AppContext from '../../appContext';

function CustomerGroupPicker() {
  const [context, setContext] = useContext(AppContext);
  const [customerGroups, setCustomerGroups] = useState([]);
  const [cgFetched, setCGFetched] = useState(false);
  const [error, setError] = useState(null);

  const onChangeCustomerGroup = (event) => {
    const customerGroupId = event.target.value;
    if (customerGroupId && customerGroups.length > 0) {
      const customerGroup = customerGroups.find(c => c.id === customerGroupId);
      if (customerGroup) {
        const customerGroupName = customerGroup.name;
        setContext({
          ...context,
          customerGroupId,
          customerGroupName
        });
        sessionStorage.setItem('customerGroupId', customerGroupId);
        sessionStorage.setItem('customerGroupName', customerGroupName);
      }
    } else {
      setContext({
        ...context,
        customerGroupId: null,
        customerGroupName: null
      });
      sessionStorage.removeItem('customerGroupId');
      sessionStorage.removeItem('customerGroupName');
    }
  }

  useEffect(() => {
    if (context.projectKey && context.apiUrl) {
      fetchCustomerGroups();
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

  async function fetchCustomerGroups() {
    if (cgFetched) return;
    setCGFetched(true);
    
    try {
      const projectKey = context.projectKey || process.env.REACT_APP_PROJECT_KEY;
      const apiUrl = context.apiUrl || process.env.REACT_APP_API_URL;
      const customerGroupsUrl = `${apiUrl}/${projectKey}/customer-groups?limit=200`;
      
      const accessToken = await getAccessToken();
      const response = await fetch(customerGroupsUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const isPermissionError = response.status === 403 || response.status === 401;
        setError(isPermissionError ? 'No permission to view customer groups' : `Failed to fetch customer groups: ${response.status}`);
        return;
      }
      
      const data = await response.json();
      if (data?.results) {
        setCustomerGroups(data.results);
      } else {
        setError('No customer groups found');
      }
    } catch (error) {
      console.error('Error fetching customer groups:', error);
      setError(error.message);
    }
  };

  const customerGroupOptions = customerGroups.length 
    ? customerGroups.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
    : [];

  const selected = context?.customerGroupId || '';

  return (
    <div>
      Customer Group:&nbsp;&nbsp;  
      <select value={selected} onChange={onChangeCustomerGroup} disabled={error && customerGroups.length === 0}>
        <option value="">(none selected)</option>
        {customerGroupOptions}
      </select>
      {error && <span style={{color: 'orange', marginLeft: '10px'}}>{error}</span>}
    </div>
  );
      
}

export default CustomerGroupPicker;