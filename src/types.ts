export interface SearchCategory {
  id: string;
  label: string;
}

export interface PlaceResult {
  id: string;
  name: string;
  address: string | null;
  website: string | null;
  phone: string | null;
}

export interface SearchPage {
  items: PlaceResult[];
  cursor: string | null;
  hasMore: boolean;
}

export interface ApiErrorResponse {
  error?: {
    code?: string;
    message?: string;
  };
}
