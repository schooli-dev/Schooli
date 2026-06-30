const fs = require("fs");
const path = require("path");

const rawBackendUrl = process.env.BACKEND_PUBLIC_URL;

if (!rawBackendUrl) {
  throw new Error("BACKEND_PUBLIC_URL is required. Example: https://schooliedu-backend.onrender.com");
}

const backendUrl = rawBackendUrl.replace(/\/+$/, "");
const target = path.join(__dirname, "..", "src", "environments", "environment.ts");

const contents = `export const environment = {
  production: true,
  apiDetailsUrl: '${backendUrl}/api/app/details',
  fallbackApiBaseUrl: '${backendUrl}/api'
};
`;

fs.writeFileSync(target, contents, "utf8");
console.log(`Render Angular environment written for ${backendUrl}`);
