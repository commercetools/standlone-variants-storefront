import config from '../../config';
import { useContext, useState, useEffect } from 'react';
import AppContext from '../../appContext';

function ChannelPicker() {

  const [context, setContext] = useContext(AppContext);

  const [channels, setChannels] = useState([]);
  const [fetched, setFetched] = useState(false);
  const [error, setError] = useState(null);

  const locale = config.locale;

  const onChangeChannel = (event) => {
    const channelId = event.target.value;
    if (channelId && channels.length > 0) {
      const channel = channels.find(c => c.id === channelId);
      if (channel) {
        const channelName = channel.name[locale];
        setContext({ ...context, channelId, channelName });
        sessionStorage.setItem('channelId', channelId);
        sessionStorage.setItem('channelName', channelName);
      }
    } else {
      setContext({ ...context, channelId: null, channelName: '' });
      sessionStorage.removeItem('channelId');
      sessionStorage.removeItem('channelName');
    }
  }
  
  useEffect(() => {
    if (context.projectKey && context.apiUrl) {
      fetchChannels();
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

  async function fetchChannels() {
    if (fetched) return;
    setFetched(true);
    
    try {
      const projectKey = context.projectKey || process.env.REACT_APP_PROJECT_KEY;
      const apiUrl = context.apiUrl || process.env.REACT_APP_API_URL;
      const whereClause = encodeURIComponent('roles contains all ("ProductDistribution")');
      const channelsUrl = `${apiUrl}/${projectKey}/channels?where=${whereClause}&limit=200&sort=name.${locale} asc`;
      
      const accessToken = await getAccessToken();
      const response = await fetch(channelsUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const isPermissionError = response.status === 403 || response.status === 401;
        setError(isPermissionError ? 'No permission to view channels' : `Failed to fetch channels: ${response.status}`);
        return;
      }
      
      const data = await response.json();
      if (data?.results) {
        setChannels(data.results);
      } else {
        setError('No channels found');
      }
    } catch (error) {
      console.error('Error fetching channels:', error);
      setError(error.message);
    }
  };

  const channelOptions = channels.length 
    ? channels.map(c => <option key={c.id} value={c.id}>{c.name?.[config.locale]}</option>)
    : [];

  const selectedChannel = context?.channelId || '';

  return (
    <div>
      Channel:&nbsp;&nbsp;  
      <select value={selectedChannel} onChange={onChangeChannel} disabled={error && channels.length === 0}>
        <option value="">(none selected)</option>
        {channelOptions}
      </select>
      {error && <span style={{color: 'orange', marginLeft: '10px'}}>{error}</span>}
    </div>
  );
      
}

export default ChannelPicker;