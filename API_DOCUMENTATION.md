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
    - [Referrals](#referrals)
      - [Get All Referrals (Leaderboard)](#get-all-referrals-leaderboard)
      - [Get Specific Referrer](#get-specific-referrer)
      - [Get Referral Codes](#get-referral-codes)
      - [Log Referral](#log-referral)
      - [Generate Referral Codes](#generate-referral-codes)
    - [Image Proxy](#image-proxy)
      - [Proxy Image](#proxy-image)
      - [Test Route](#test-route)
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

**Example Requests:**
- `/stack-activity?address=0x38982E4E9908b2fAA98992D09E8CD31CAB6C6B25`
- `/stack-activity?address=0x38982E4E9908b2fAA98992D09E8CD31CAB6C6B25&point-system-id=7370`

---

### Referrals

**Base Route:** `/api/referrals`

#### Get All Referrals (Leaderboard)

**Endpoint:** `GET /api/referrals`

**Description:** Retrieves all referrers with their referrals, sorted to create a leaderboard.

**Response:** JSON object containing an array of referrers with their referral data, including:
- Address, username, level
- SUP income
- Number of referrals
- Total and average referral SUP income
- List of referrals

---

#### Get Specific Referrer

**Endpoint:** `GET /api/referrals/:address`

**Description:** Retrieves data for a specific referrer by their address.

**Path Parameters:**
- `address`: Ethereum address of the referrer.

**Response:** JSON object containing the referrer's data including their referrals.

**Error Responses:**
- `404 Not Found`: If the referrer is not found.

---

#### Get Referral Codes

**Endpoint:** `GET /api/referrals/codes/:address`

**Description:** Retrieves available one-time codes for a specific referrer.

**Path Parameters:**
- `address`: Ethereum address of the referrer.

**Response:** JSON object containing the referrer's address, username, and unused codes.

**Error Responses:**
- `404 Not Found`: If the referrer is not found.

---

#### Log Referral

**Endpoint:** `POST /api/referrals/log-referral`

**Description:** Records a new referral using a referrer's code.

**Request Body:**
- `referralAddress`: Ethereum address of the person being referred.
- `referrerCode`: The referral code being used.

**Response:** JSON object with the result of the operation.

**Error Responses:**
- `400 Bad Request`: If referral address or referrer code is missing.
- `404 Not Found`: If the referrer code is invalid.
- `409 Conflict`: If the address is already registered.
- `403 Forbidden`: If the maximum number of referrals has been reached.

---

#### Generate Referral Codes

**Endpoint:** `POST /api/referrals/generate-codes/:address`

**Description:** Generates new referral codes for a referrer.

**Path Parameters:**
- `address`: Ethereum address of the referrer.

**Response:** JSON object with the result of the operation.

**Error Responses:**
- `404 Not Found`: If the referrer is not found.
- `400 Bad Request`: If the maximum number of codes has been reached.

---

### Image Proxy

**Base Route:** `/api`

#### Proxy Image

**Endpoint:** `GET /api/proxy-image`

**Description:** Proxies image requests to external services, allowing images to be displayed within the application while respecting the Content Security Policy.

**Query Parameters:**
- `url` (required): String - URL of the image to be proxied.

**Response:** 
- Image data with the appropriate content type.
- Cache headers set to 24 hours (max-age=86400).

**Error Responses:**
- `400 Bad Request`: If no image URL is provided or the URL format is invalid.
- `500 Internal Server Error`: If there's an error fetching the image.

#### Test Route

**Endpoint:** `GET /api/test`

**Description:** Simple route to verify the image proxy router is working.

**Response:** String confirming "Image proxy router is working".

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
- Public assets from the React app are served at `/assets` and `/static`
- Visualizer page available at `/visualizer`

---

*Note: This documentation is based on the code in app.ts. Some implementation details might not be fully captured if they're defined in imported controllers or routers.*