export interface KnowledgeItem {
  id: string;
  type: string;
  title: string;
  content: string;
  price: string | null;
  status: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentItem {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

export interface WebsiteImportJob {
  id: string;
  url: string;
  status: string;
  pagesFound: number;
  errorMessage: string | null;
  createdAt: string;
  _count?: { items: number };
}
