import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';

const AttributeSelector = ({ productType, variants, selectedVariant, onVariantChange, onFetchVariantById, onQueryVariantByAttributes }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { id } = useParams();
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('');
  const [noMatchMessage, setNoMatchMessage] = useState('');

  // Extract enum values from product type for dropdowns
  const getEnumValues = (attributeName) => {
    if (!productType || !productType.attributes) {
      return [];
    }
    
    const attr = productType.attributes.find(a => a.name === attributeName);
    if (!attr || !attr.type) {
      return [];
    }

    // Handle enum type
    if (attr.type.name === 'enum' && attr.type.values) {
      return attr.type.values.map(v => ({
        key: v.key,
        label: v.label || v.key
      }));
    }

    // Handle lenum (localized enum) type
    if (attr.type.name === 'lenum' && attr.type.values) {
      return attr.type.values.map(v => ({
        key: v.key,
        label: v.label?.en || v.label || v.key
      }));
    }

    return [];
  };

  // For size, we still extract from variants since it's text type, not enum
  const getSizeOptions = () => {
    if (!variants || variants.length === 0) {
      return [];
    }
    const values = new Set();
    variants.forEach(variant => {
      const attr = variant.attributes?.find(a => a.name === 'size');
      if (attr) {
        values.add(String(attr.value));
      }
    });
    
    // Sort sizes: numeric sizes first (sorted numerically), then text sizes (sorted alphabetically)
    return Array.from(values).sort((a, b) => {
      const numA = parseFloat(a);
      const numB = parseFloat(b);
      const isNumA = !isNaN(numA) && isFinite(numA);
      const isNumB = !isNaN(numB) && isFinite(numB);
      
      if (isNumA && isNumB) {
        return numA - numB;
      }
      if (isNumA) return -1;
      if (isNumB) return 1;
      return a.localeCompare(b);
    });
  };

  const sizeOptions = getSizeOptions();
  const colorOptions = getEnumValues('color');
  const styleOptions = getEnumValues('style');

  // Helper to extract enum key from variant attribute value
  // Value can be: string (the key), or object {key: "...", label: {...}}
  const extractEnumKey = (value) => {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value.key) return value.key;
    return String(value);
  };

  // Initialize selected attributes from current variant
  useEffect(() => {
    if (selectedVariant) {
      const sizeAttr = selectedVariant.attributes?.find(a => a.name === 'size');
      const colorAttr = selectedVariant.attributes?.find(a => a.name === 'color');
      const styleAttr = selectedVariant.attributes?.find(a => a.name === 'style');
      
      setSelectedSize(sizeAttr ? String(sizeAttr.value) : '');
      // For enum types, extract the key
      setSelectedColor(colorAttr ? extractEnumKey(colorAttr.value) : '');
      setSelectedStyle(styleAttr ? extractEnumKey(styleAttr.value) : '');
      setNoMatchMessage('');
    }
  }, [selectedVariant]);

  // Find matching variant based on selected attributes
  const findMatchingVariant = (size, color, style) => {
    if (!size && !color && !style) return null;

    // Debug logging
    console.log('Finding variant with:', { size, color, style });
    console.log('Available variants:', variants.length);
    
    const match = variants.find(variant => {
      const variantSize = variant.attributes?.find(a => a.name === 'size');
      const variantColor = variant.attributes?.find(a => a.name === 'color');
      const variantStyle = variant.attributes?.find(a => a.name === 'style');
      
      // Size is text type, compare as string
      const sizeMatch = !size || (variantSize && String(variantSize.value) === size);
      
      // Color and style are enum types, extract key from value for comparison
      const colorKey = variantColor ? extractEnumKey(variantColor.value) : null;
      const colorMatch = !color || (colorKey === color);
      
      const styleKey = variantStyle ? extractEnumKey(variantStyle.value) : null;
      const styleMatch = !style || (styleKey === style);
      
      if (color && colorKey) {
        console.log(`  Variant ${variant.id?.variantId || variant.id}: colorKey="${colorKey}", color="${color}", match=${colorKey === color}`);
      }
      
      return sizeMatch && colorMatch && styleMatch;
    });
    
    console.log('Match found:', match ? (match.id?.variantId || match.id) : 'none');
    return match;
  };

  const handleAttributeChange = (attributeName, value) => {
    setNoMatchMessage('');
    
    if (attributeName === 'size') {
      setSelectedSize(value);
    } else if (attributeName === 'color') {
      setSelectedColor(value);
    } else if (attributeName === 'style') {
      setSelectedStyle(value);
    }

    // Always query by attributes to get the variant in the current store context
    const newSize = attributeName === 'size' ? value : selectedSize;
    const newColor = attributeName === 'color' ? value : selectedColor;
    const newStyle = attributeName === 'style' ? value : selectedStyle;
    
    // Only query if at least one attribute is selected
    if (newSize || newColor || newStyle) {
      if (onQueryVariantByAttributes) {
        console.log('Querying store for variant with attributes:', { newSize, newColor, newStyle });
        onQueryVariantByAttributes(newSize, newColor, newStyle);
      } else {
        // Fallback: try to find in memory if query function not available
        const matchingVariant = findMatchingVariant(newSize, newColor, newStyle);
        if (matchingVariant) {
          const variantId = matchingVariant.id?.variantId || matchingVariant.id;
          const productId = matchingVariant.product?.id;
          
          if (productId && variantId) {
            const newParams = new URLSearchParams(searchParams);
            newParams.set('variant', variantId);
            navigate(`/product-detail/${id}?${newParams.toString()}`, { replace: true });
            
            if (onFetchVariantById) {
              onFetchVariantById(variantId, productId);
            }
            
            if (onVariantChange) {
              onVariantChange(variantId);
            }
          }
        } else {
          setNoMatchMessage('No variant available for this combination');
        }
      }
    }
  };

  if (sizeOptions.length === 0 && colorOptions.length === 0 && styleOptions.length === 0) {
    return null; // Don't show selector if no size/color/style attributes
  }

  return (
    <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
      <h3>Select Attributes</h3>
      <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
        {sizeOptions.length > 0 && (
          <div>
            <label htmlFor="size-selector" style={{ marginRight: '10px', fontWeight: 'bold' }}>
              Size:
            </label>
            <select
              id="size-selector"
              value={selectedSize}
              onChange={(e) => handleAttributeChange('size', e.target.value)}
              style={{ padding: '5px 10px', fontSize: '14px', minWidth: '120px' }}
            >
              <option value="">Select size</option>
              {sizeOptions.map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
        )}
        
        {colorOptions.length > 0 && (
          <div>
            <label htmlFor="color-selector" style={{ marginRight: '10px', fontWeight: 'bold' }}>
              Color:
            </label>
            <select
              id="color-selector"
              value={selectedColor}
              onChange={(e) => handleAttributeChange('color', e.target.value)}
              style={{ padding: '5px 10px', fontSize: '14px', minWidth: '120px' }}
            >
              <option value="">Select color</option>
              {colorOptions.map(color => (
                <option key={color.key} value={color.key}>{color.label}</option>
              ))}
            </select>
          </div>
        )}
        
        {styleOptions.length > 0 && (
          <div>
            <label htmlFor="style-selector" style={{ marginRight: '10px', fontWeight: 'bold' }}>
              Style:
            </label>
            <select
              id="style-selector"
              value={selectedStyle}
              onChange={(e) => handleAttributeChange('style', e.target.value)}
              style={{ padding: '5px 10px', fontSize: '14px', minWidth: '120px' }}
            >
              <option value="">Select style</option>
              {styleOptions.map(style => (
                <option key={style.key} value={style.key}>{style.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      {noMatchMessage && (
        <div style={{ marginTop: '10px', color: 'orange', fontWeight: 'bold' }}>
          {noMatchMessage}
        </div>
      )}
    </div>
  );
};

export default AttributeSelector;

