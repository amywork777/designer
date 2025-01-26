export const PRODUCT_PRICING = {
  Mini: {
    PLA: { price: 15, priceId: 'price_XXXX' },
    'Wood-PLA': { price: 25, priceId: 'price_XXXX' },
    TPU: { price: 25, priceId: 'price_XXXX' },
    Resin: { price: 35, priceId: 'price_XXXX' },
    Aluminum: { price: 120, priceId: 'price_XXXX' }
  },
  Small: {
    PLA: { price: 25, priceId: 'price_XXXX' },
    'Wood-PLA': { price: 35, priceId: 'price_XXXX' },
    TPU: { price: 40, priceId: 'price_XXXX' },
    Resin: { price: 60, priceId: 'price_XXXX' },
    Aluminum: 'contact'
  },
  Medium: {
    PLA: { price: 40, priceId: 'price_XXXX' },
    'Wood-PLA': { price: 65, priceId: 'price_XXXX' },
    TPU: { price: 85, priceId: 'price_XXXX' },
    Resin: { price: 120, priceId: 'price_XXXX' },
    Aluminum: 'contact'
  },
  Large: {
    PLA: 'contact',
    'Wood-PLA': 'contact',
    TPU: 'contact',
    Resin: 'contact',
    Aluminum: 'contact'
  }
} as const; 