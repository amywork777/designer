export interface AnalysisData {
  productDescription: string;
  dimensions: string;
  manufacturingOptions: ManufacturingOption[];
  selectedOption?: ManufacturingOption;
  features: string[];
}

export interface ManufacturingOption {
  name: string;
  description: string;
  bestFor: string;
  materials: string[];
  leadTime: string;
  costs: {
    setup: string;
    perUnit: string;
  };
} 