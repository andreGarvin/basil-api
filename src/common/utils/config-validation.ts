import logger from "../logger";

// this checks if the server has all environment variables needed
const validateConfig = (config: { [key: string]: any }) => {
  const requiredEnvVariables: string[] = [
    "HOST",
    "MONGO_URI",
    "CALLBACK_URL",
    "GIPHY_API_KEY",
    "APPLICATION_URL",
    "SENDGRID_API_KEY",
    "GOOGLE_CLIENT_ID",
    "AWS_ACCESS_KEY_ID",
    "AWS_ACCESS_KEY_ID",
    "GOOGLE_CLIENT_SECRET",
    "TEMP_TOKEN_EXPIRATION",
    "USER_TOKEN_EXPIRATION",
    "JSON_WEB_TOKEN_SECERT",
    "AWS_SECERT_ACCESS_KEY"
  ];

  const missingEnvVariables: string[] = [];
  requiredEnvVariables.forEach(env => {
    if (typeof config[env] === "undefined") {
      missingEnvVariables.push(env);
    }
  });

  if (missingEnvVariables.length !== 0) {
    logger.warn(
      "YOU ARE MISSING THESE ENVIRONMENTAL VARIABLES [ %s ]",
      missingEnvVariables.join(", ")
    );

    process.exit(1);
  }
};

export default validateConfig;
