import express from 'express';
import translateRoutes from './routes/translateRoutes.js';
import { Logger } from './utils/logger.js';

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
        res.status(200).json({
                status: 'OK',
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
        });
});

// Routes
app.use('/api', translateRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
        Logger.error('Unhandled error:', err);
        res.status(500).json({
                success: false,
                error: 'Lỗi server nội bộ'
        });
});

// 404 handler
app.use('*', (req, res) => {
        res.status(404).json({
                success: false,
                error: 'Endpoint không tồn tại'
        });
});

export default app; 