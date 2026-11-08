export function createLogger(serviceName) {
  return {
    info: (msg, meta = {}) => {
      console.log(`[${new Date().toISOString()}] [INFO] [${serviceName}] ${msg}`, Object.keys(meta).length ? JSON.stringify(meta) : "");
    },
    warn: (msg, meta = {}) => {
      console.warn(`[${new Date().toISOString()}] [WARN] [${serviceName}] ${msg}`, Object.keys(meta).length ? JSON.stringify(meta) : "");
    },
    error: (msg, meta = {}) => {
      console.error(`[${new Date().toISOString()}] [ERROR] [${serviceName}] ${msg}`, Object.keys(meta).length ? JSON.stringify(meta) : "");
    }
  };
}

