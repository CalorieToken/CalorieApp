export type FoodSearchItem = {
  product_name: string;
  calories: number;
  protein: number;
  fat: number;
  carbohydrates: number;
};

export type FoodSearchResponse = {
  query: string;
  results: FoodSearchItem[];
};
