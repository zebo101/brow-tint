export interface BrowStyleItem {
  id: string;
  slug: string;
  name: string;
  shade: string;
  shape: string;
  intensity: string;
  thumbnail: string | null;
  prompt: string;
  negative: string | null;
  popular: boolean;
  trending: boolean;
  tier: string;
  credits: number;
}
