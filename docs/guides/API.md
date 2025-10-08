# DASH API Reference

**Version**: 1.0.0
**Base URL**: `http://localhost:5000/api` (development) or `https://148.113.196.245/api` (production)
**Authentication**: Bearer JWT token (Auth0)

---

## Table of Contents

1. [Authentication](#authentication)
2. [Health & System](#health--system)
3. [Validation Module](#validation-module)
4. [Database Module](#database-module)
5. [Administration Module](#administration-module)
6. [Analytics](#analytics)
7. [Error Handling](#error-handling)
8. [Rate Limiting](#rate-limiting)

---

## Authentication

All API endpoints (except `/health`) require authentication via **Auth0 JWT tokens**.

### Headers

```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### Auth0 Configuration

- **Domain**: `dev-x63i3b6hf5kch7ab.ca.auth0.com`
- **Audience**: `facnet-validator-api`
- **Algorithm**: RS256

### User Roles

| Role | Permissions |
|------|-------------|
| `pending` | No access (awaiting approval) |
| `viewer` | Read-only access |
| `editor` | Read + write access (no deletions) |
| `admin` | Full access (including deletions) |

---

## Health & System

### GET /health

Health check endpoint (no authentication required).

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-08T15:00:00.000Z",
  "platform": "Dash - Modular SAAS Platform"
}
```

### GET /modules

List all available modules.

**Response**:
```json
{
  "platform": "Dash",
  "version": "1.0.0",
  "modules": [
    {
      "name": "validateur",
      "version": "1.0.0",
      "description": "Quebec healthcare billing validation (RAMQ)",
      "enabled": true
    },
    {
      "name": "chatbot",
      "version": "1.0.0",
      "description": "AI-powered medical billing assistant",
      "enabled": false
    }
  ]
}
```

### GET /cache/stats

Cache performance statistics (Redis).

**Response**:
```json
{
  "status": "success",
  "data": {
    "hits": 1250,
    "misses": 50,
    "invalidations": 5,
    "errors": 0,
    "hitRatio": 96.15,
    "totalRequests": 1300
  },
  "timestamp": "2025-10-08T15:00:00.000Z"
}
```

---

## Validation Module

Base path: `/api/validations` and `/api/files`

### POST /files

Upload a CSV file for validation.

**Headers**:
```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: multipart/form-data
```

**Request** (multipart/form-data):
```
file: <CSV_FILE>
```

**Response**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "filename": "billing_2025_02.csv",
  "size": 1048576,
  "uploadedAt": "2025-10-08T15:00:00.000Z"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid file format, missing file, or file too large
- `401 Unauthorized`: Missing or invalid JWT token
- `413 Payload Too Large`: File exceeds 10MB limit

### POST /validations

Start a validation run on an uploaded file.

**Request**:
```json
{
  "fileId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response**:
```json
{
  "id": "650e8400-e29b-41d4-a716-446655440000",
  "fileId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "createdAt": "2025-10-08T15:00:00.000Z",
  "userId": "auth0|123456789"
}
```

**Validation Status**:
- `pending`: Validation queued
- `processing`: Currently validating
- `completed`: Validation finished successfully
- `failed`: Validation error occurred

### GET /validations

List all validation runs for the authenticated user.

**Query Parameters**:
```
page: integer (default: 1)
limit: integer (default: 50, max: 100)
status: string (pending|processing|completed|failed)
```

**Response**:
```json
{
  "data": [
    {
      "id": "650e8400-e29b-41d4-a716-446655440000",
      "fileName": "billing_2025_02.csv",
      "status": "completed",
      "createdAt": "2025-10-08T15:00:00.000Z",
      "completedAt": "2025-10-08T15:01:30.000Z",
      "recordCount": 1250,
      "errorCount": 8,
      "warningCount": 3
    }
  ],
  "total": 45,
  "page": 1,
  "limit": 50
}
```

### GET /validations/:id

Get details of a specific validation run.

**Response**:
```json
{
  "id": "650e8400-e29b-41d4-a716-446655440000",
  "fileName": "billing_2025_02.csv",
  "status": "completed",
  "createdAt": "2025-10-08T15:00:00.000Z",
  "completedAt": "2025-10-08T15:01:30.000Z",
  "recordCount": 1250,
  "errorCount": 8,
  "warningCount": 3,
  "progress": 100,
  "results": [
    {
      "severity": "error",
      "rule": "OFFICE_FEE_19929",
      "message": "Le code 19929 requiert un minimum de 12 patients inscrits mais seulement 8 trouvé(s)",
      "invoice": "123456",
      "patient": "PAT001",
      "code": "19929",
      "amount": 64.80
    }
  ]
}
```

**Error Responses**:
- `403 Forbidden`: User does not own this validation run
- `404 Not Found`: Validation run does not exist

---

## Database Module

Base path: `/api/{table}` where `{table}` is one of: `codes`, `contexts`, `establishments`, `rules`

### GET /codes

List RAMQ billing codes with pagination and search.

**Query Parameters**:
```
page: integer (default: 1)
limit: integer (default: 50, max: 100)
search: string (search code or description)
place: string (Cabinet|Établissement)
active: boolean (true|false)
```

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "code": "19929",
      "description": "Frais de bureau - 12 patients inscrits ou plus",
      "tariffValue": 64.80,
      "place": "Cabinet",
      "levelGroups": "NIVEAU3",
      "active": true
    }
  ],
  "total": 6740,
  "page": 1,
  "limit": 50
}
```

### GET /contexts

List service contexts and modifiers.

**Query Parameters**: Same as `/codes`

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "context": "G160",
      "description": "Patient sans rendez-vous (walk-in)",
      "active": true
    }
  ],
  "total": 200,
  "page": 1
}
```

### GET /establishments

List Quebec healthcare establishments.

**Query Parameters**: Same as `/codes`

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "code": "12345",
      "name": "CHUM - Centre hospitalier de l'Université de Montréal",
      "city": "Montréal",
      "region": "Montréal",
      "active": true
    }
  ],
  "total": 1000,
  "page": 1
}
```

### GET /rules

List validation rules.

**Query Parameters**:
```
page: integer (default: 1)
limit: integer (default: 50)
enabled: boolean (true|false)
category: string
```

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "OFFICE_FEE_19928_19929",
      "category": "office_fee",
      "enabled": true,
      "condition": {
        "type": "office_fee_validation",
        "codes": ["19928", "19929"],
        "thresholds": {
          "19928": { "registered": 6, "walkIn": 10 },
          "19929": { "registered": 12, "walkIn": 20 }
        }
      }
    }
  ],
  "total": 123,
  "page": 1
}
```

### POST /codes

Create a new RAMQ code (Editor/Admin only).

**Request**:
```json
{
  "code": "19930",
  "description": "Nouveau code de facturation",
  "tariffValue": 50.00,
  "place": "Cabinet",
  "active": true
}
```

**Response**:
```json
{
  "id": "uuid",
  "code": "19930",
  "description": "Nouveau code de facturation",
  "tariffValue": 50.00,
  "place": "Cabinet",
  "active": true,
  "createdAt": "2025-10-08T15:00:00.000Z"
}
```

**Error Responses**:
- `403 Forbidden`: User does not have editor/admin role
- `409 Conflict`: Code already exists

### PATCH /codes/:id

Update an existing code (Editor/Admin only).

**Request**:
```json
{
  "tariffValue": 55.00,
  "description": "Description mise à jour"
}
```

**Response**: Updated code object

### DELETE /codes/:id

Delete a code (Admin only).

**Response**:
```json
{
  "message": "Code deleted successfully"
}
```

**Error Responses**:
- `403 Forbidden`: User does not have admin role

### POST /codes/import

Bulk import codes from CSV (Editor/Admin only).

**Headers**:
```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: multipart/form-data
```

**Request** (multipart/form-data):
```
file: <CSV_FILE>
```

**Response**:
```json
{
  "imported": 150,
  "updated": 25,
  "errors": 3,
  "message": "Import completed with 3 errors"
}
```

### GET /codes/export

Export codes to CSV.

**Query Parameters**:
```
format: string (csv|json)
search: string (optional filter)
```

**Response**: CSV file download

---

## Administration Module

Base path: `/api/users` (Admin only)

### GET /users

List all users with their roles.

**Query Parameters**:
```
page: integer (default: 1)
limit: integer (default: 50)
role: string (pending|viewer|editor|admin)
```

**Response**:
```json
{
  "data": [
    {
      "id": "auth0|123456789",
      "email": "user@facturation.net",
      "role": "editor",
      "createdAt": "2025-01-15T10:00:00.000Z",
      "lastLogin": "2025-10-08T14:30:00.000Z"
    }
  ],
  "total": 25,
  "page": 1
}
```

### PATCH /users/:id

Update user role (Admin only).

**Request**:
```json
{
  "role": "admin"
}
```

**Response**: Updated user object

### DELETE /users/:id

Delete a user (Admin only).

**Response**:
```json
{
  "message": "User deleted successfully"
}
```

---

## Analytics

Base path: `/api/analytics`

### GET /analytics/kpis

Get key performance indicators.

**Response**:
```json
{
  "totalValidations": 1250,
  "totalErrors": 450,
  "averageErrorsPerRun": 3.6,
  "mostCommonErrors": [
    {
      "rule": "OFFICE_FEE_19929",
      "count": 125,
      "percentage": 27.8
    }
  ],
  "monthlyTrend": [
    { "month": "2025-09", "validations": 320, "errors": 115 },
    { "month": "2025-10", "validations": 385, "errors": 98 }
  ]
}
```

### GET /analytics/unique-patients-by-day

Get unique patient count per day.

**Query Parameters**:
```
startDate: string (YYYY-MM-DD)
endDate: string (YYYY-MM-DD)
```

**Response**:
```json
{
  "data": [
    { "date": "2025-10-01", "uniquePatients": 45 },
    { "date": "2025-10-02", "uniquePatients": 52 }
  ]
}
```

### GET /analytics/codes

Get code usage statistics.

**Query Parameters**:
```
limit: integer (default: 20)
period: string (week|month|year)
```

**Response**:
```json
{
  "data": [
    {
      "code": "19929",
      "description": "Frais de bureau - 12 patients",
      "count": 320,
      "totalAmount": 20736.00
    }
  ]
}
```

---

## Error Handling

### Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The code 19929 requires a minimum of 12 registered patients",
    "details": {
      "field": "code",
      "value": "19929",
      "expected": "12",
      "found": "8"
    }
  },
  "timestamp": "2025-10-08T15:00:00.000Z"
}
```

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request succeeded |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Missing or invalid JWT token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource already exists |
| 413 | Payload Too Large | File size exceeds limit |
| 422 | Unprocessable Entity | Validation failed |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error occurred |

---

## Rate Limiting

**Current limits**:
- **General endpoints**: 100 requests per minute per user
- **File upload**: 10 uploads per hour per user
- **Validation**: 20 validations per hour per user

**Headers returned**:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1696775400
```

When rate limit is exceeded:
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again in 5 minutes.",
    "retryAfter": 300
  }
}
```

---

## WebSocket Support (Coming Soon)

Real-time updates for validation progress will be available via WebSocket connection at:

```
ws://localhost:5000/ws
```

**Events**:
- `validation:progress` - Validation progress updates
- `validation:complete` - Validation completed
- `validation:error` - Validation error occurred

---

## Swagger/OpenAPI Documentation

**Interactive API documentation** (Coming soon):

```
http://localhost:5000/api-docs
```

Will provide:
- Live API testing interface
- Request/response examples
- Schema definitions
- Authentication flow

---

**Last Updated**: October 2025
**API Version**: 1.0.0
