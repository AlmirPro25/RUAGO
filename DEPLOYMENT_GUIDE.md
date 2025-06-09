# RuaGO Deployment Guide

## 1. Overview

RuaGO is a comprehensive application designed to connect local vendors ("pontos") with clients. It features a Node.js backend handling business logic, data storage, real-time messaging via Socket.IO, and AI-powered features through Google Gemini. The frontend is a single-page application built with HTML, CSS, and vanilla JavaScript (`index.html`).

This guide provides instructions for deploying the RuaGO application to a production environment.

## 2. Prerequisites

Before deploying, ensure the following are available and configured on your server:

*   **Node.js and npm:** Node.js (preferably a recent LTS version) and npm must be installed.
*   **MongoDB Instance:** Access to a MongoDB database instance. This can be self-hosted or a cloud-based service like MongoDB Atlas.
*   **Environment Variable Management:** A method to manage environment variables for the backend application (e.g., using a `.env` file or platform-specific environment configuration).
*   **Process Manager (Recommended):** A tool like PM2 is recommended for managing the Node.js process in production.

## 3. Environment Variables

The backend `server.js` requires the following environment variables to be set. These are critical for the application's functionality and security.

*   **`PORT`**: The port on which the Node.js application will listen (e.g., `3000`). The `server.js` is configured to use `process.env.PORT || 3000`.
*   **`MONGO_URI`**: The connection string for your MongoDB database.
    *   Example (MongoDB Atlas): `mongodb+srv://<user>:<password>@yourcluster.mongodb.net/ruago_prod?retryWrites=true&w=majority`
    *   Example (Self-hosted): `mongodb://localhost:27017/ruago_prod`
    *   Ensure the user has appropriate read/write permissions to the `ruago_prod` database (or your chosen production database name).
*   **`JWT_SECRET`**: A strong, unique secret key used for signing JSON Web Tokens (JWTs). This **must not** be a weak or default value. Generate a cryptographically secure random string.
*   **`GOOGLE_API_KEY`**: Your API key for Google AI services (Gemini), required for features like "Criar Ponto Mágico".
*   **`FRONTEND_PROD_URL`**: The full URL of your deployed frontend application (e.g., `https://ruago.yourdomain.com`). This is used by the backend's CORS policy to allow requests from your frontend.
*   **`NODE_ENV`**: Set this to `production`. This often enables optimizations in Node.js and dependent libraries.

**Setting Environment Variables:**

The `server.js` application is configured to use the `dotenv` package to load environment variables from a `.env` file located in the project root.
1.  Ensure `dotenv` is listed in your `package.json` dependencies and installed (it was added in a previous step). If not, run `npm install dotenv`.
2.  Create a `.env` file in the root of your project directory on the server. **Do not commit this file to version control if it contains sensitive information.**
3.  Add your environment variables to the `.env` file in the format `VARIABLE_NAME=value`:
    ```env
    PORT=3000
    MONGO_URI=mongodb+srv://youruser:yourpassword@yourcluster.mongodb.net/ruago_prod
    JWT_SECRET=your_very_strong_and_unique_jwt_secret
    GOOGLE_API_KEY=your_google_ai_api_key
    FRONTEND_PROD_URL=https://ruago.yourdomain.com
    NODE_ENV=production
    ```
Alternatively, you can set environment variables directly in your deployment platform's configuration settings if it supports them (e.g., Heroku, AWS Elastic Beanstalk, Docker environment variables).

## 4. Backend Deployment

Follow these steps to deploy the Node.js backend:

1.  **Clone/Upload Code:** Transfer your application code to the server.
2.  **Navigate to Project Directory:** `cd /path/to/your/ruago-app`
3.  **Install Dependencies:**
    *   It's recommended to install only production dependencies to reduce the package size and potential vulnerabilities:
        ```bash
        npm install --production
        ```
    *   (If you've added `dotenv` just now, ensure it's installed: `npm install dotenv`)
4.  **Running the Application:**
    While you can run the application directly with `node server.js`, it's highly recommended to use a process manager like PM2 for production. PM2 provides features like automatic restarts, logging, and load balancing.

    *   **Install PM2 (if not already installed):**
        ```bash
        npm install pm2 -g
        ```
    *   **Start the Application with PM2:**
        ```bash
        pm2 start server.js --name ruago-backend
        ```
        (The `--name` flag assigns a recognizable name to your process.)
    *   **Save PM2 Process List and Enable Startup on Reboot:**
        ```bash
        pm2 save
        pm2 startup
        ```
        (Follow the instructions output by `pm2 startup` to complete this setup.)
    *   **Viewing Logs:**
        ```bash
        pm2 logs ruago-backend
        ```
    *   **Other PM2 Commands:**
        *   `pm2 list`: List all running processes managed by PM2.
        *   `pm2 stop ruago-backend`: Stop the application.
        *   `pm2 restart ruago-backend`: Restart the application.
        *   `pm2 delete ruago-backend`: Remove the application from PM2's list.

## 5. Frontend Deployment (`index.html`)

The primary frontend file is `index.html`, which includes its own CSS and JavaScript.

*   **Serving Options:**
    1.  **Static Hosting Service:** Deploy `index.html` (and any other static assets like images, if you add them later) to a static hosting service (e.g., Netlify, Vercel, AWS S3 with CloudFront, GitHub Pages if it's a public site).
    2.  **Dedicated Web Server:** Serve the `index.html` file using a web server like Nginx or Apache. You would configure the web server to point to the directory containing `index.html`.
    3.  **Via Node.js Backend (Not currently configured):** The `server.js` could be extended with `express.static` middleware to serve `index.html` from a `public` directory. This is not the current setup but is an option for simpler deployments.

*   **Note on `API_URL` in `index.html`:**
    The `API_URL` JavaScript variable in `index.html` is configured to be dynamic.
    *   If your frontend (e.g., `https://ruago.yourdomain.com`) is served from the **same domain and port** as your backend API (after potential reverse proxy setup), `window.location.origin` should correctly point the frontend to the backend.
    *   If the frontend and backend are on **different domains** (e.g., frontend on Netlify, backend on a separate server), ensure that:
        *   The `FRONTEND_PROD_URL` environment variable on the backend correctly whitelists your frontend's domain for CORS.
        *   The dynamic `API_URL` logic in `index.html` correctly resolves or is adjusted if necessary. The current logic uses `window.location.origin` for `https://` or non-localhost `http://`, which might need adjustment if the API is on a completely different domain than the frontend. In such a cross-origin scenario, you might need to explicitly set `API_URL` in `index.html` during your frontend build/deployment process to point to your backend's production URL (e.g., `https://api.yourdomain.com`).

*   **Build Steps (Recommendation):**
    For optimal performance and a production-ready frontend, consider implementing a build process. While the current `index.html` is self-contained, for larger applications or future enhancements:
    *   **Minify HTML, CSS, and JavaScript:** Reduce file sizes.
    *   **Bundle JavaScript:** Combine multiple JS files into fewer, more optimized bundles (e.g., using Webpack, Parcel, or Rollup).
    *   **Transpilation:** Convert modern JavaScript to older versions for broader browser compatibility if needed (e.g., using Babel).
    *   **CSS Preprocessing:** Use SASS/LESS and compile to CSS.
    These steps are typically managed with a `package.json` in a dedicated frontend directory and tools like npm/yarn scripts.

## 6. HTTPS Configuration

**HTTPS is essential for production environments** to secure data in transit. Do not run a production application over plain HTTP.

*   **Options for Implementing HTTPS:**
    1.  **Reverse Proxy with SSL Termination:** This is a common approach.
        *   Set up Nginx or Apache as a reverse proxy in front of your Node.js application.
        *   The reverse proxy listens on port 443 (HTTPS), handles SSL/TLS encryption/decryption, and forwards traffic to your Node.js application (e.g., running on port 3000).
        *   Use Let's Encrypt to obtain free SSL certificates. Tools like Certbot can automate this process.
    2.  **Load Balancers:** If using a cloud provider (AWS, GCP, Azure), their load balancer services can often manage SSL termination.
    3.  **Platform-as-a-Service (PaaS):** Many PaaS providers (Heroku, Render, etc.) offer built-in, automated SSL certificate management.

*   This configuration is typically done at the infrastructure level, not directly within the `server.js` application code (though Node.js can serve HTTPS directly, it's often better handled by a dedicated service).

## 7. Security Best Practices Applied & Further Recommendations

### Applied in `server.js`:

The `server.js` has been pre-configured with several security measures:
*   **Helmet:** Sets various HTTP security headers to protect against common web vulnerabilities (e.g., XSS, clickjacking).
*   **CORS (Cross-Origin Resource Sharing):** Configured with a whitelist (`allowedOrigins`) to only permit requests from your specified `FRONTEND_PROD_URL`.
*   **Rate Limiting:** `express-rate-limit` is applied to authentication routes (`/api/auth/login`, `/api/auth/register`) to prevent brute-force attacks.
*   **JWT (JSON Web Tokens):** Used for stateless authentication, securing API endpoints.
*   **Password Hashing:** `bcryptjs` is used to securely hash user passwords before storing them.

### Further Security Recommendations:

*   **Regularly Update Dependencies:** Periodically run `npm audit` and update packages to patch known vulnerabilities. Use tools like Snyk or Dependabot for automated checks.
*   **Comprehensive Logging:** Implement more detailed logging for requests, errors, and security events. This can help in auditing and incident response. Consider structured logging.
*   **Input Validation:** While basic checks exist, ensure all user inputs are rigorously validated on the backend to prevent injection attacks (NoSQL injection, etc.) and ensure data integrity.
*   **XSS Protection:** Although Helmet provides some XSS protection headers (like `X-XSS-Protection`), always sanitize user-generated content that will be rendered on the frontend. If using a frontend framework, leverage its built-in XSS protection.
*   **Web Application Firewall (WAF):** Consider using a WAF (e.g., from your cloud provider or Cloudflare) for an additional layer of security against common web attacks.
*   **Principle of Least Privilege:** Ensure the MongoDB user for the application has only the necessary permissions (CRUD operations on specific collections) and not administrative rights.

## 8. Database Management

*   **Regular Backups:** Implement a strategy for regular, automated backups of your MongoDB database. Test the restoration process periodically.
*   **Security:**
    *   Ensure your MongoDB instance requires authentication.
    *   Restrict network access to your database instance to only allow connections from your application server(s).
    *   Keep your MongoDB version updated.

## 9. Staging Environment and Testing

## Staging Environment and Pre-Production Testing Protocol

This document outlines the critical importance of a staging environment and a comprehensive testing protocol before deploying the application to production. Adhering to these steps will significantly reduce the risk of encountering issues in the live environment.

### 1. Purpose of a Staging Environment

A **staging environment** is a pre-production replica of your live production setup. Its primary purpose is to serve as the final proving ground for your application, allowing for thorough testing and validation of all features, configurations, and integrations in an environment that mirrors production as closely as possible. This is the last step before going live.

### 2. Key Components of the Staging Environment

To be effective, the staging environment must include all parts of your application stack, configured as they would be in production:

*   **Application Server:**
    *   The Node.js backend (`server.js`) must be deployed and running.
    *   Ensure it's running with `NODE_ENV=staging` or a similar environment flag if your application uses it for specific configurations.
*   **MongoDB Instance:**
    *   A dedicated MongoDB database instance is crucial. **This instance must be separate from both your local development database and your production database.**
    *   The connection string for this staging MongoDB instance should be configured via the `MONGO_URI` (or equivalent) environment variable on the staging server.
*   **Frontend Hosting:**
    *   The `index.html` file and all associated static assets (CSS, client-side JavaScript, images) must be served through a web server or hosting solution, mirroring how it will be accessed in production.
    *   The frontend should be configured to communicate with the staging backend API. The dynamic `API_URL` in `index.html` should correctly resolve to the staging backend's URL.
*   **Environment Variables:**
    *   All necessary environment variables must be correctly configured for the staging environment. This includes, but is not limited to:
        *   `MONGO_URI`: Connection string for the staging MongoDB.
        *   `JWT_SECRET`: Secret key for JWT signing (should be different from development, and ideally from production unless managed securely).
        *   `GOOGLE_API_KEY`: If used for AI features or maps.
        *   `FRONTEND_PROD_URL` (or equivalent for staging): The URL of your hosted frontend, to be used in the backend's CORS `allowedOrigins` list. This ensures that the staging frontend can communicate with the staging backend.
        *   Any other API keys or service configurations.

### 3. Testing Protocol in Staging

**A. Automated Backend Tests (`npm test`):**

*   **Critical Prerequisite:** It is **absolutely essential** to execute the full suite of backend tests (`npm test`) against the staging environment.
*   **Successful Execution:** All tests **must pass** without any failures.
*   **Database Interaction:** This step is particularly vital as it validates that the application can correctly connect to and interact with the staging MongoDB instance. Previous attempts to run these tests in a development/CI environment failed due to a missing MongoDB connection; the staging environment is where this integration is confirmed.

**B. Manual End-to-End Testing:**

Beyond automated tests, comprehensive manual testing is required to cover all user flows and interactions:

*   **User Registration:** Test new user (both 'cliente' and 'vendedor') registration flows.
*   **User Login/Logout:** Verify authentication for all user types.
*   **Vendor-Specific Actions:**
    *   Ponto creation, modification, and status updates.
    *   Profile management.
*   **Client-Specific Actions:**
    *   Viewing vendors/pontos.
    *   Interaction with vendor services (e.g., initiating contact if applicable).
*   **Messaging System:**
    *   Sending and receiving messages between different users.
    *   Real-time message updates via Socket.IO.
    *   Unread message counts and marking messages as read.
*   **AI Features:**
    *   Test all functionalities relying on the Google AI (e.g., "Criar Ponto Mágico").
*   **Core Functionality:** Test any other primary features of the application.

**C. Validation Checks:**

*   **No Console Errors:** Monitor the browser's developer console for any JavaScript errors on the frontend.
*   **No Server Errors:** Check server logs for any backend errors or exceptions during testing.
*   **Data Integrity:** Ensure data is correctly created, updated, and displayed across the application.
*   **User Experience:** Confirm that the application is responsive and behaves as expected from a user's perspective.

### 4. Progression to Production

**Deployment to the live production environment should only occur after all the following conditions are met:**

1.  The staging environment is fully configured and mirrors production.
2.  All automated backend tests (`npm test`) have passed successfully in the staging environment.
3.  Comprehensive manual end-to-end testing has been completed, and all features are verified to be working correctly.
4.  No critical errors or issues have been identified in browser or server logs.
5.  All stakeholders (if applicable) have signed off on the staging validation.

Skipping or rushing the staging and testing phase significantly increases the likelihood of deploying a faulty or unstable application to your users. Diligent testing in a production-like staging environment is key to a successful and reliable production deployment.

---

This guide provides a foundational set of instructions. Depending on your specific hosting platform and infrastructure, some steps may need to be adapted. Always refer to your hosting provider's documentation for platform-specific best practices.
