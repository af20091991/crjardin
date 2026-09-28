/** Types partagés (client + serveur) du détail d'une analyse concurrent. */

export interface PageSpeedMetrics {
  fcp_ms: number | null;
  lcp_ms: number | null;
  tbt_ms: number | null;
  cls: number | null;
  speed_index_ms: number | null;
  server_response_ms: number | null;
  page_weight_kb: number | null;
}

export interface PageSpeedField {
  category: string | null;
  lcp_ms: number | null;
  cls: number | null;
  inp_ms: number | null;
}

export interface PageSpeedDetails {
  metrics: PageSpeedMetrics;
  field: PageSpeedField | null;
  seo_issues: string[];
  accessibility_issues: string[];
  best_practices_issues: string[];
  opportunities: Array<{ title: string; savings_ms: number }>;
}

export interface PageInfo {
  title: string | null;
  meta_description: string | null;
  h1_count: number;
  h2_count: number;
  canonical: string | null;
  lang: string | null;
  noindex: boolean;
  viewport: boolean;
  open_graph: boolean;
  json_ld_types: string[];
  generator: string | null;
  images_total: number;
  images_without_alt: number;
  internal_links: number;
  external_links: number;
  word_count: number;
}

export interface HttpInfo {
  final_url: string;
  status: number;
  https_redirect: boolean | null;
  hsts: boolean;
  server: string | null;
  html_size_kb: number;
}

export interface FilesInfo {
  robots_txt: boolean | null;
  sitemap_url: string | null;
  sitemap_urls: number | null;
}

export interface ContentInfo {
  is_wordpress: boolean;
  posts_total: number | null;
  last_post_date: string | null;
  posts_last_90_days: number | null;
}

export interface CompetitorDetails {
  version: 1;
  pagespeed: PageSpeedDetails | null;
  page: PageInfo | null;
  http: HttpInfo | null;
  files: FilesInfo | null;
  content: ContentInfo | null;
}
