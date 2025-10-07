# Chatbot Knowledge Base

This directory contains documents used for RAG (Retrieval-Augmented Generation) to enhance the chatbot's knowledge about Quebec healthcare billing and RAMQ regulations.

## Purpose

The chatbot uses these documents to provide accurate, up-to-date information about:
- RAMQ billing codes and regulations
- Quebec healthcare system procedures
- Medical billing best practices
- Compliance requirements
- Code-specific rules and restrictions

## Supported File Types

- **PDF** - RAMQ official documentation, billing guides
- **TXT** - Plain text reference materials
- **MD** - Markdown formatted knowledge articles
- **CSV** - Code tables, reference data
- **JSON** - Structured knowledge data

## Document Organization

Recommended folder structure:
```
knowledge/
├── ramq-official/        # Official RAMQ documents
├── billing-guides/       # Step-by-step billing guides
├── code-references/      # Detailed code descriptions
├── regulations/          # Quebec healthcare regulations
└── faq/                  # Frequently asked questions
```

## RAG Integration

Documents in this folder will be:
1. **Indexed** - Converted to vector embeddings for semantic search
2. **Chunked** - Split into manageable pieces for context injection
3. **Retrieved** - Searched based on user questions
4. **Injected** - Added to AI prompts for accurate responses

## Usage

Simply drop your documents in this folder or appropriate subfolders. The RAG system will:
- Automatically detect new files
- Process and index them
- Make them available for chatbot queries

## Notes

- Keep documents focused and well-organized
- Use descriptive filenames (e.g., `ramq-code-15804-guide.pdf`)
- Remove outdated documents to maintain accuracy
- Larger documents may take longer to process

## Current Status

🔄 **RAG Implementation**: Planned (folder ready for documents)
