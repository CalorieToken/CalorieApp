export type FoodSearchItem = {
  id?: number;
  created_at?: string | null;
  product_name: string;
  calories: number;
  protein: number;
  fat: number;
  carbohydrates: number;
  portion_percentage?: number | null;
  image_url?: string | null;
  barcode?: string | null;
  brand?: string | null;
  serving_size?: string | null;
  nutri_score?: string | null;
};

export type FoodSearchResponse = {
  query: string;
  results: FoodSearchItem[];
};
