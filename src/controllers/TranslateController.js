import { AlibabaService } from '../services/AlibabaService.js';

export class TranslateController {
        constructor() {
                this.alibabaService = new AlibabaService();
        }

        async translate(req, res) {
                try {
                        const apifyUrl = req.body.url || req.query.url;

                        if (!apifyUrl) {
                                return res.status(400).json({
                                        success: false,
                                        error: 'Thiếu url Apify'
                                });
                        }

                        const result = await this.alibabaService.processTranslation(apifyUrl);

                        if (result.success) {
                                return res.status(200).json({
                                        success: true,
                                        message: 'Dịch thuật thành công',
                                        data: result.data,
                                        savedPaths: result.savedPaths
                                });
                        } else {
                                return res.status(500).json({
                                        success: false,
                                        error: result.error
                                });
                        }
                } catch (error) {
                        console.error('Lỗi trong TranslateController:', error);
                        return res.status(500).json({
                                success: false,
                                error: error.message || 'Lỗi server nội bộ'
                        });
                }
        }

        async getTranslationStatus(req, res) {
                try {
                        // Có thể thêm logic kiểm tra trạng thái dịch thuật
                        return res.status(200).json({
                                success: true,
                                message: 'API dịch thuật đang hoạt động',
                                timestamp: new Date().toISOString()
                        });
                } catch (error) {
                        return res.status(500).json({
                                success: false,
                                error: error.message
                        });
                }
        }
} 