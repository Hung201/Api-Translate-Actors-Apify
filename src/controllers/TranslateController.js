import { AlibabaService } from '../services/AlibabaService.js';
import { AvailableAlibabaService } from '../services/AvailableAlibabaService.js';

export class TranslateController {
    constructor() {
        this.alibabaService = new AlibabaService();
        this.availableAlibabaService = new AvailableAlibabaService();
    }

    async translate(req, res) {
        try {
            let apifyUrl = req.body.url || req.query.url;
            // Nhận thêm biến điều khiển trả về data dịch hay data gốc
            let isTranslate = true;
            if (typeof req.body.isTranslate !== 'undefined') {
                isTranslate = req.body.isTranslate === true || req.body.isTranslate === 'true';
            } else if (typeof req.query.isTranslate !== 'undefined') {
                isTranslate = req.query.isTranslate === 'true' || req.query.isTranslate === true;
            }

            if (!apifyUrl) {
                return res.status(400).json({
                    success: false,
                    error: 'Thiếu url Apify'
                });
            }

            let result = await this.alibabaService.processTranslation(apifyUrl, isTranslate);

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

    async translateUnopimProducts(req, res) {
        try {
            let ids = req.body.ids;
            if (!Array.isArray(ids) || ids.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Thiếu mảng ids sản phẩm!'
                });
            }
            let results = await this.availableAlibabaService.translateUnopimProducts(ids);
            return res.status(200).json({ success: true, results });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }
} 