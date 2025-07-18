import dotenv from 'dotenv';
dotenv.config();

import app from './src/app.js';
import { Logger } from './src/utils/logger.js';

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, '0.0.0.0', () => {
        Logger.info(`API server listening on port ${PORT} (accessible from all network interfaces)`);
        Logger.info(`Health check: http://localhost:${PORT}/health`);
        Logger.info(`API endpoints:`);
        Logger.info(`  - POST/GET /api/translate - Dịch thuật dữ liệu`);
        Logger.info(`  - GET /api/status - Kiểm tra trạng thái API`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
        Logger.info('SIGTERM received, shutting down gracefully');
        server.close(() => {
                Logger.info('Process terminated');
                process.exit(0);
        });
});

process.on('SIGINT', () => {
        Logger.info('SIGINT received, shutting down gracefully');
        server.close(() => {
                Logger.info('Process terminated');
                process.exit(0);
        });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
        Logger.error('Uncaught Exception:', err);
        process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
        Logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
        process.exit(1);
}); 