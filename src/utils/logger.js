export class Logger {
        static info(message, data = null) {
                const timestamp = new Date().toISOString();
                console.log(`[INFO] ${timestamp}: ${message}`);
                if (data) {
                        console.log(JSON.stringify(data, null, 2));
                }
        }

        static error(message, error = null) {
                const timestamp = new Date().toISOString();
                console.error(`[ERROR] ${timestamp}: ${message}`);
                if (error) {
                        console.error(error.stack || error);
                }
        }

        static warn(message, data = null) {
                const timestamp = new Date().toISOString();
                console.warn(`[WARN] ${timestamp}: ${message}`);
                if (data) {
                        console.warn(JSON.stringify(data, null, 2));
                }
        }

        static debug(message, data = null) {
                if (process.env.NODE_ENV === 'development') {
                        const timestamp = new Date().toISOString();
                        console.log(`[DEBUG] ${timestamp}: ${message}`);
                        if (data) {
                                console.log(JSON.stringify(data, null, 2));
                        }
                }
        }
} 