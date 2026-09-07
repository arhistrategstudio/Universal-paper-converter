export type DocumentType = 'document' | 'handwriting' | 'receipt' | 'form' | 'table' | 'auto';

export type BlockType = 'title' | 'heading' | 'paragraph' | 'list_item' | 'field' | 'table';

export interface DocumentBlock {
  id: string;
  type: BlockType;
  content: string;
  level?: number;
  key?: string;
  value?: string;
  headers?: string[];
  rows?: string[][];
  confidence: number;
  needs_review: boolean;
  review_reason?: string;
}

export interface DocumentMetadata {
  created_at: string;
  original_filename: string;
  image_width?: number;
  image_height?: number;
  ocr_engine: string;
  processing_time_ms: number;
  overall_confidence: number;
}

export interface UniversalDocument {
  id: string;
  title: string;
  doc_type: DocumentType;
  language: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  blocks: DocumentBlock[];
  metadata: DocumentMetadata;
}
