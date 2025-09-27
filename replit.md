# DashValidator - Data Validation & Management Platform

## Overview

DashValidator is a full-stack web application designed for data validation and database administration. The platform combines a React-based frontend with an Express.js backend, featuring a comprehensive validation workflow and dynamic database management capabilities with CSV import/export functionality.

The application serves two primary use cases:
1. **Validator Flow**: Upload, process, and analyze data validation runs with detailed analytics
2. **Database Administration**: Manage codes, contexts, establishments, and validation rules with dynamic custom fields driven by a field catalog system

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite for fast development builds
- **Routing**: Wouter for lightweight client-side routing with sidebar-only navigation (no header)
- **State Management**: TanStack React Query for server state, Jotai for minimal global state atoms
- **UI Framework**: Tailwind CSS with shadcn/ui component library using Radix UI primitives
- **Form Handling**: React Hook Form with Zod validation schemas and Hookform resolvers
- **Authentication**: Firebase Authentication with Google OAuth integration

### Backend Architecture
- **Runtime**: Node.js with TypeScript and Express.js framework
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Authentication**: Firebase Admin SDK for token verification and role-based access control
- **File Handling**: Multer for CSV file uploads with 50MB size limit
- **API Design**: RESTful endpoints with consistent error handling and CORS support

### Database Design
The application uses a flexible schema with core tables enhanced by JSONB custom fields:

**Core Tables**:
- `users`: Authentication and role management (viewer, editor, admin)
- `codes`: Primary lookup codes with description, category, and active status
- `contexts`: Named validation contexts with tags and descriptions
- `establishments`: Organization/location entities with type and region
- `rules`: Validation rules with conditions and error messages
- `field_catalog`: Dynamic field definitions for custom fields across tables
- `validation_runs`: File upload tracking with processing status and results
- `files`: File metadata and storage information

**Flexible Design Pattern**: Each core table includes a `custom_fields` JSONB column, allowing dynamic field extensions without schema migrations. The field catalog drives form generation and validation for these custom fields.

### Authentication & Authorization
- **Client Authentication**: Firebase Authentication with Google OAuth redirect flow
- **Server Verification**: Firebase Admin SDK validates ID tokens on protected routes
- **Role-Based Access**: Three-tier permission system (viewer, editor, admin) with route-level protection
- **Session Management**: Stateless JWT-based authentication with automatic token refresh

### File Processing & Validation
- **Upload Handling**: Multer middleware for CSV file processing with size and type validation
- **Validation Engine**: Placeholder validation system with configurable rules and error reporting
- **Import/Export**: CSV processing with conflict resolution strategies (update, skip, error)
- **Dynamic Fields**: Field catalog system enables runtime creation of custom fields without code changes

### Development & Deployment
- **Build System**: Vite for frontend bundling, esbuild for backend compilation
- **Database Migrations**: Drizzle Kit for schema management and migrations
- **Environment Configuration**: Separate development and production configurations
- **Hot Reloading**: Vite HMR for frontend, tsx for backend development server

## External Dependencies

### Database Services
- **Neon Database**: Serverless PostgreSQL hosting via `@neondatabase/serverless`
- **Connection Pooling**: WebSocket-based connections for serverless compatibility

### Authentication Services  
- **Firebase**: Complete authentication solution including:
  - Firebase Authentication for user management
  - Firebase Admin SDK for server-side token verification
  - Google OAuth provider for social authentication

### UI & Design System
- **Radix UI**: Unstyled, accessible React components for complex UI patterns
- **Tailwind CSS**: Utility-first CSS framework with custom design tokens
- **Lucide React**: Consistent icon library for interface elements
- **Recharts**: Data visualization library for analytics dashboards

### Development Tools
- **TypeScript**: Full-stack type safety with shared schema definitions
- **Drizzle ORM**: Type-safe database operations with PostgreSQL dialect
- **Zod**: Runtime type validation for API endpoints and form handling
- **React Query**: Server state management with caching and synchronization

### File & Data Processing
- **CSV Parser**: Server-side CSV processing for import/export functionality
- **Multer**: Express middleware for handling multipart/form-data uploads
- **Day.js**: Lightweight date manipulation and formatting library

### Production Services
- **Replit**: Development and hosting platform with integrated database provisioning
- **CORS**: Cross-origin resource sharing for API access from frontend domain