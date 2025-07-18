import fetch from 'node-fetch';
import pLimit from 'p-limit';

export class GeminiAlibabaService {
    constructor() {
        this.geminiApiUrl = process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=AIzaSyAGETvRfhuaWrzPVbpMmzsR018JsfCKHS8';
        this.limit = pLimit(1); // Chỉ 1 request đồng thời
    }

    async fetchApifyDataset(url) {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Không lấy được dữ liệu Apify');
        return await response.json();
    }

    async translateTitleWithGemini(title) {
        const prompt = `Chỉ dịch sang tiếng Việt tên sản phẩm sau, không dịch hướng dẫn, không dịch các lựa chọn, không thêm gì khác. Nếu có nhiều dòng, chỉ dịch dòng đầu tiên:\n${title}`;
        const body = {
            contents: [{ parts: [{ text: prompt }] }]
        };
        const response = await fetch(this.geminiApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!response.ok) throw new Error('Gemini API error: ' + (await response.text()));
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || title;
    }

    async translateApifyDatasetTitlesAndContent(apifyUrl) {
        const dataset = await this.fetchApifyDataset(apifyUrl);
        if (!Array.isArray(dataset)) throw new Error('Dataset Apify không phải mảng!');
        const translationPromises = dataset.map(async (item) => {
            const newItem = { ...item };
            newItem.title = item.title ? await this.limit(() => this.translateTitleWithGemini(item.title)) : item.title;
            newItem.content = item.content;
            return newItem;
        });
        return await Promise.all(translationPromises);
    }
} 