/**
 * Application configuration with environment variable handling
 */

interface AppConfig {
  apiUrl: string;
}

function getConfig(): AppConfig {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!apiUrl) {
    console.error('NEXT_PUBLIC_API_URL is not defined in environment variables');
    // Fallback to localhost for development
    return {
      apiUrl: 'http://localhost:8000',
    };
  }

  return {
    apiUrl,
  };
}

export const config = getConfig();
