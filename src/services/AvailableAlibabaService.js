import fetch from 'node-fetch';

export class AvailableAlibabaService {
    constructor() {
        this.apiUrl = process.env.TRANSLATE_API_URL;
        this.BATCH_SIZE = parseInt(process.env.TRANSLATE_BATCH_SIZE);
        this.CONCURRENT_BATCHES = parseInt(process.env.TRANSLATE_CONCURRENT_BATCHES);
        this.productApiUrl = process.env.PRODUCT_API_URL;
    }

    async getProductValuesById(id) {
        let product = await Product.findByPk(id);
        if (!product) throw new Error(`Không tìm thấy sản phẩm id=${id}`);
        return product.values;
    }

    async updateProductValuesById(id, newValues) {
        await Product.update({ values: newValues }, { where: { id } });
    }

    // Hàm retry cho API calls
    async retryFetch(url, options, maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await fetch(url, options);
                if (response.ok) {
                    return response;
                }
                throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            } catch (error) {
                console.log(`Attempt ${attempt} failed:`, error.message);
                if (attempt === maxRetries) {
                    throw error;
                }
                // Chờ trước khi retry
                await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
            }
        }
    }

    async translateBatch(texts) {
        // Kiểm tra độ dài data
        const requestBody = {
            texts,
            target_lang: 'vi',
            source_lang: 'auto'
        };
        const requestString = JSON.stringify(requestBody);

        // Nếu request body quá lớn (> 75KB), chia nhỏ batch
        if (requestString.length > 75000) {
            const batchSize = Math.max(1, Math.floor(texts.length / 2)); // Chia đôi batch
            const batches = [];

            // Tạo các batch
            for (let i = 0; i < texts.length; i += batchSize) {
                batches.push(texts.slice(i, i + batchSize));
            }

            // Xử lý song song các batch
            const batchPromises = batches.map((batch, index) => {
                return this.translateBatch(batch);
            });

            const results = await Promise.all(batchPromises);
            return results.flat(); // Ghép tất cả kết quả
        }

        let response = await this.retryFetch(this.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: requestString,
            // Tăng timeout để tránh bị abort
            signal: AbortSignal.timeout(60000) // 60 giây timeout
        });
        if (!response.ok) {
            throw new Error(`API error: ${response.status} - ${await response.text()}`);
        }
        let data = await response.json();

        return data.translated_texts;
    }

    async fetchProductsBySkus(skus) {
        const response = await fetch(this.productApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ skus })
        });
        if (!response.ok) throw new Error('Không lấy được dữ liệu sản phẩm');
        const data = await response.json();
        return data; // giả sử trả về mảng sản phẩm
    }

    async translateUnopimProducts(skus) {
        const apiResponse = await this.fetchProductsBySkus(skus);
        const products = Array.isArray(apiResponse.data) ? apiResponse.data : [];

        // 2. Tách name, description
        const names = [];
        const descriptions = [];
        for (const p of products) {
            let values = typeof p.values === 'string' ? JSON.parse(p.values) : p.values;
            const name = values?.channel_locale_specific?.default?.vi_VN?.name || '';
            const description = values?.channel_locale_specific?.default?.vi_VN?.description || '';
            names.push(name);
            descriptions.push(description);
        }

        // 3. Dịch batch song song
        const startTime = Date.now();
        let translatedNames = [], translatedDescriptions = [];

        // Tính tổng ký tự cần dịch
        const totalChars = names.reduce((sum, text) => sum + (text ? text.length : 0), 0) +
            descriptions.reduce((sum, text) => sum + (text ? text.length : 0), 0);
        console.log(`📊 Tổng ký tự cần dịch: ${totalChars.toLocaleString()}`);

        try {
            // Dịch song song thay vì tuần tự
            [translatedNames, translatedDescriptions] = await Promise.all([
                this.translateBatch(names),
                this.translateBatch(descriptions)
            ]);
            const endTime = Date.now();
            const duration = (endTime - startTime) / 1000; // Chuyển sang giây

            // Tính ký tự đã dịch thành công
            const translatedChars = translatedNames.reduce((sum, text) => sum + (text ? text.length : 0), 0) +
                translatedDescriptions.reduce((sum, text) => sum + (text ? text.length : 0), 0);

            console.log(`✅ Dịch hoàn thành trong ${duration.toFixed(2)} giây`);
            console.log(`📈 Ký tự đã dịch: ${translatedChars.toLocaleString()}/${totalChars.toLocaleString()}`);
            console.log(`⚡ Tốc độ: ${(translatedChars / duration).toFixed(0)} ký tự/giây`);
            console.log('Translated names count:', translatedNames.length);
            console.log('Translated descriptions count:', translatedDescriptions.length);
            console.log('Sample translated name:', translatedNames[0]);
            console.log('Sample translated description:', translatedDescriptions[0]);
        } catch (error) {
            const endTime = Date.now();
            const duration = (endTime - startTime) / 1000;
            console.error(`❌ Lỗi khi dịch sau ${duration.toFixed(2)} giây:`, error);
            return products.map((p, idx) => ({
                id: p.sku || p.id,
                success: false,
                error: error && (error.message || error.toString())
            }));
        }

        // 4. Ghép lại data đã dịch
        const results = [];
        for (let i = 0; i < products.length; i++) {
            let p = products[i];
            results.push({
                id: p.id,
                sku: p.sku,
                name: translatedNames[i],
                description: translatedDescriptions[i]
            });
        }
        return results;
    }
}
