
export function setQueryArgs() {
  /* Depending on the context settings, we may tack on additional price selection parameters.
    The primary price selection parameter is always currency
    (see https://docs.commercetools.com/api/projects/products#price-selection)
    If currency is found, we add additional parameters.
  */
  const currency = sessionStorage.getItem('currency');
  const country = sessionStorage.getItem('country');
  const channelId = sessionStorage.getItem('channelId');
  const customerGroupId = sessionStorage.getItem('customerGroupId');
  const storeKey = sessionStorage.getItem('storeKey');

  const queryArgs = {};

  if(currency) {
    queryArgs.priceCurrency=currency;
    if(country) {
      queryArgs.priceCountry=country;
    }
    if(channelId) {
      queryArgs.priceChannel=channelId;
    }
    if(customerGroupId) {
      queryArgs.priceCustomerGroup=customerGroupId;
    }
  }
  if(storeKey) {
    queryArgs.storeProjection=storeKey;
  }
  return queryArgs;
}
