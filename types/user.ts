export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      submissions: {
        Row: {
          id: number;
          created_at: string;
          user_id: string;
          project_url: string;
          score: number | null;
        };
        Insert: {
          user_id: string;
          project_url: string;
          score?: number | null;
        };
        Update: {
          score?: number | null;
        };
      };
    };
  };
}
