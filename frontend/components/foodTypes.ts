export type FoodSearchItem = {
  product_name: string;
  calories: number;
  protein: number;
  fat: number;
  carbohydrates: number;
  image_url?: string | null;
  barcode?: string | null;
};

export type FoodSearchResponse = {
  query: string;
  results: FoodSearchItem[];
};
