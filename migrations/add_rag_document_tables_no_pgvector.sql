-- RAG Document Processing System Migration (Without pgvector for now)
-- Phase 2, Step 2.1: Create document tables (pgvector installation required separately)

-- NOTE: pgvector extension must be installed manually on Windows PostgreSQL:
-- Download from: https://github.com/pgvector/pgvector/releases
-- Install instructions: https://github.com/pgvector/pgvector#windows

-- Document status enum
DO $$ BEGIN
  CREATE TYPE document_status AS ENUM ('pending', 'processing', 'completed', 'error');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Document file type enum
DO $$ BEGIN
  CREATE TYPE document_file_type AS ENUM ('html', 'pdf');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Document category enum (based on knowledge/ folder structure)
DO $$ BEGIN
  CREATE TYPE document_category AS ENUM (
    'ramq-official',
    'billing-guides',
    'code-references',
    'regulations',
    'faq'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Documents table - tracks source files in knowledge/ directory
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL UNIQUE, -- Relative path from knowledge/
  file_type document_file_type NOT NULL,
  category document_category NOT NULL,
  file_hash TEXT NOT NULL, -- SHA256 hash for change detection
  file_size_bytes BIGINT,
  status document_status NOT NULL DEFAULT 'pending',
  processed_at TIMESTAMP,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb, -- title, language, page_count, etc.
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for querying by status
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);

-- Index for querying by category
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);

-- Index for hash-based change detection
CREATE INDEX IF NOT EXISTS idx_documents_file_hash ON documents(file_hash);

-- Document chunks table - stores text chunks
-- NOTE: embedding column will be added after pgvector installation
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL, -- Order within document (0-indexed)
  content TEXT NOT NULL, -- Actual chunk text
  token_count INTEGER NOT NULL,
  embedding_pending BOOLEAN DEFAULT TRUE, -- Tracks if embedding needs to be generated
  metadata JSONB DEFAULT '{}'::jsonb, -- section_heading, page_number, etc.
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Ensure unique chunks per document
  UNIQUE(document_id, chunk_index)
);

-- Index for querying chunks by document
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);

-- Index for finding chunks pending embeddings
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_pending ON document_chunks(embedding_pending) WHERE embedding_pending = true;

-- Add updated_at trigger for documents table
CREATE OR REPLACE FUNCTION update_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_documents_updated_at ON documents;
CREATE TRIGGER trigger_update_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_documents_updated_at();

-- Comments for documentation
COMMENT ON TABLE documents IS 'Source documents from knowledge/ directory for RAG system';
COMMENT ON TABLE document_chunks IS 'Text chunks for semantic search in RAG (embeddings to be added with pgvector)';
COMMENT ON COLUMN document_chunks.embedding_pending IS 'Tracks if embedding column needs to be populated after pgvector installation';
