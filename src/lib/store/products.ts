export interface Product {
  id: string;
  imageUrl: string;
  productType: string;
  originalPrompt: string;
  description?: string;
  multiViewUrls?: string[];
  title?: string;
  likes?: number;
  published?: boolean;
  createdAt: string;
  updatedAt: string;
}

// In-memory store for products (replace with database in production)
class ProductStore {
  private products: Product[] = [];
  private readonly STORAGE_KEY = 'createy_products';

  constructor() {
    // Load products from localStorage on initialization
    if (typeof window !== 'undefined') {
      const savedProducts = localStorage.getItem(this.STORAGE_KEY);
      if (savedProducts) {
        try {
          this.products = JSON.parse(savedProducts);
        } catch (error) {
          console.error('Error loading products from storage:', error);
          this.products = [];
        }
      }
    }
  }

  private saveToStorage(): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.products));
    }
  }

  addProduct(product: Product): void {
    this.products.push(product);
    this.saveToStorage();
  }

  getProduct(id: string): Product | undefined {
    return this.products.find(p => p.id === id);
  }

  updateProduct(id: string, updates: Partial<Product>): Product | undefined {
    const index = this.products.findIndex(p => p.id === id);
    if (index === -1) return undefined;

    this.products[index] = {
      ...this.products[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.saveToStorage();
    return this.products[index];
  }

  deleteProduct(id: string): boolean {
    const index = this.products.findIndex(p => p.id === id);
    if (index === -1) return false;

    this.products.splice(index, 1);
    this.saveToStorage();
    return true;
  }

  getAllProducts(publishedOnly: boolean = false): Product[] {
    return publishedOnly 
      ? this.products.filter(p => p.published)
      : [...this.products];
  }

  // Debug method to check store state
  debug(): void {
    console.log('Current products:', this.products);
    if (typeof window !== 'undefined') {
      console.log('LocalStorage:', localStorage.getItem(this.STORAGE_KEY));
    }
  }
}

// Create a singleton instance
export const productStore = new ProductStore(); 