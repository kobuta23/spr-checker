# API Documentation

This document provides a comprehensive reference for all API endpoints available in the Superfluid Eligibility API.

## Table of Contents

- [API Documentation](#api-documentation)
  - [Table of Contents](#table-of-contents)
  - [General Information](#general-information)
  - [Endpoints](#endpoints)
    - [Eligibility](#eligibility)
    - [Health Check](#health-check)
    - [Point Systems](#point-systems)
    - [Recipients](#recipients)
    - [Recipient Stats](#recipient-stats)
    - [Superfluid Resolution](#superfluid-resolution)
    - [Stack Activity](#stack-activity)
    - [Image Proxy](#image-proxy)
  - [Error Handling](#error-handling)
  - [Static Files](#static-files)

## General Information

The API is built with Express.js and follows RESTful principles. All endpoints return JSON responses.

Base URL: Depends on deployment environment

## Endpoints

### Eligibility

**Endpoint:** `GET /eligibility`

**Description:** Checks eligibility status.

**Query Parameters:** Not specified in the code sample, refer to eligibilityController implementation.

**Response:** Eligibility status information in JSON format.

---

### Health Check

**Endpoint:** `GET /health`

**Description:** Verifies if the API is functioning correctly.

**Response:** Health status information in JSON format.

---

### Point Systems

**Endpoint:** `GET /point-systems`

**Description:** Retrieves available point systems.

**Response:** List of point systems in JSON format.

---

### Recipients

**Endpoint:** `GET /recipients`

**Description:** Retrieves a list of recipients.

**Query Parameters:**
- `cache` (optional): Number - Controls whether to use cached data (defaults to true if not specified).

**Response:** JSON array of recipients.

---

**Endpoint:** `GET /recipients-stored`

**Description:** Retrieves stored recipients data.

**Response:** JSON array of stored recipients.

---

### Recipient Stats

**Endpoint:** `GET /recipient-stats`

**Description:** Retrieves high-level statistical information about recipients.

**Response:** JSON object containing recipient statistics.

---

### Superfluid Resolution

**Endpoint:** `GET /superfluid/resolve/:address`

**Description:** Proxies requests to the Superfluid API to resolve information about a blockchain address.

**Path Parameters:**
- `address`: Ethereum address to resolve.

**Response:** Data from Superfluid API in JSON format.

**Error Responses:**
- `500 Internal Server Error`: If the request to Superfluid API fails.

---

### Stack Activity

**Endpoint:** `GET /stack-activity`

**Description:** Retrieves activity data from Stack protocol for a given address.

**Query Parameters:**
- `address` (required): String - Ethereum address to query (must be a valid 40-character hex address with optional '0x' prefix).
- `point-system-id` (optional): Number - Specific point system ID to filter results.

**Response:** 
- If point-system-id is provided: Activity data for the specified point system.
- If point-system-id is not provided: Activity data across all point systems.

**Error Responses:**
- `400 Bad Request`: If the address is missing or invalid.

---

### Image Proxy

**Endpoint:** `GET /api/*`

**Description:** Proxies image requests to external services, allowing images to be displayed within the application while respecting the Content Security Policy.

**Path Parameters:**
- The proxy path details are defined in the imageProxyRouter (not fully visible in the code sample).

**Response:** Image data or error response.

---

## Error Handling

The API uses a centralized error handling middleware that returns consistent error responses:

**404 Not Found Error:**
```json
{
  "error": "Not Found",
  "message": "Route [METHOD] [PATH] not found",
  "statusCode": 404
}
```

Other errors are handled by the errorHandler middleware, which formats errors appropriately.

## Static Files

The API also serves static files:
- React application from `/src/client/build`
- Public assets from `/src/client/public`
- Visualizer page available at `/visualizer`

---

*Note: This documentation is based on the provided code sample. Some implementation details might not be fully captured if they're defined in imported controllers or routers.* 