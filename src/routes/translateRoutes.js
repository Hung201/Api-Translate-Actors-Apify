import express from 'express';
import { TranslateController } from '../controllers/TranslateController.js';

const router = express.Router();
const translateController = new TranslateController();

// Route để dịch thuật
router.post('/translate', (req, res) => translateController.translate(req, res));

// Route để kiểm tra trạng thái API
router.get('/status', (req, res) => translateController.getTranslationStatus(req, res));

// Route GET cũng hỗ trợ dịch thuật (để tương thích)
router.get('/translate', (req, res) => translateController.translate(req, res));

export default router; 