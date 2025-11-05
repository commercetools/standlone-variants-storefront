import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';

const AttributeSelector = ({ variants, selectedVariant, onVariantChange }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { id } = useParams();
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('');
  const [noMatchMessage, setNoMatchMessage] = useState('');

  // Extract unique attribute values
  const getUniqueAttributeValues = (attributeName) => {
    const values = new Set();
    variants.forEach(variant => {
      const attr = variant.attributes?.find(a => a.name === attributeName);
      if (attr) {
        values.add(String(attr.value));
      }
    });
    return Array.from(values).sort();
  };

  const sizeOptions = getUniqueAttributeValues('size');
  const colorOptions = getUniqueAttributeValues('color');
  const styleOptions = getUniqueAttributeValues('style');

  // Initialize selected attributes from current variant
  useEffect(() => {
    if (selectedVariant) {
      const sizeAttr = selectedVariant.attributes?.find(a => a.name === 'size');
      const colorAttr = selectedVariant.attributes?.find(a => a.name === 'color');
      const styleAttr = selectedVariant.attributes?.find(a => a.name === 'style');
      setSelectedSize(sizeAttr ? String(sizeAttr.value) : '');
      setSelectedColor(colorAttr ? String(colorAttr.value) : '');
      setSelectedStyle(styleAttr ? String(styleAttr.value) : '');
      setNoMatchMessage('');
    }
  }, [selectedVariant]);

  // Find matching variant based on selected attributes
  const findMatchingVariant = (size, color, style) => {
    if (!size && !color && !style) return null;

    return variants.find(variant => {
      const variantSize = variant.attributes?.find(a => a.name === 'size');
      const variantColor = variant.attributes?.find(a => a.name === 'color');
      const variantStyle = variant.attributes?.find(a => a.name === 'style');
      
      const sizeMatch = !size || (variantSize && String(variantSize.value) === size);
      const colorMatch = !color || (variantColor && String(variantColor.value) === color);
      const styleMatch = !style || (variantStyle && String(variantStyle.value) === style);
      
      return sizeMatch && colorMatch && styleMatch;
    });
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

    // Find matching variant with new attribute combination
    const newSize = attributeName === 'size' ? value : selectedSize;
    const newColor = attributeName === 'color' ? value : selectedColor;
    const newStyle = attributeName === 'style' ? value : selectedStyle;
    
    const matchingVariant = findMatchingVariant(newSize, newColor, newStyle);
    
    if (matchingVariant) {
      // Auto-select first matching variant
      const variantId = matchingVariant.id?.variantId || matchingVariant.id;
      const productId = matchingVariant.product?.id;
      
      if (productId && variantId) {
        // Update URL with new variant (replace to avoid adding to history)
        const newParams = new URLSearchParams(searchParams);
        newParams.set('variant', variantId);
        navigate(`/product-detail/${id}?${newParams.toString()}`, { replace: true });
        
        // Call onVariantChange callback
        if (onVariantChange) {
          onVariantChange(variantId);
        }
      }
    } else if (newSize || newColor || newStyle) {
      // Show message if no variant matches the combination
      setNoMatchMessage('No variant available for this combination');
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
                <option key={color} value={color}>{color}</option>
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
                <option key={style} value={style}>{style}</option>
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

