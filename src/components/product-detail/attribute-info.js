import config from '../../config';

const VERBOSE = false;

const AttributeInfo = ({attr}) => {

  const name = attr.name;

  let value = JSON.stringify(attr.value,null,'\t');
  VERBOSE && console.log('attr value type', typeof attr.value);
  if(typeof attr.value === 'object' && attr.value.label !== undefined && typeof attr.value.label === 'object') {
    // Try config.locale first, then 'en', then first available key
    value = attr.value.label[config.locale] || attr.value.label['en'] || Object.values(attr.value.label)[0];
  }
  if(typeof attr.value == 'boolean') {
    value = attr.value ? 'true' : 'false';
  }
  return (
    <span>&nbsp;{ name }: {value}<br></br></span>
  )
}

export default AttributeInfo

