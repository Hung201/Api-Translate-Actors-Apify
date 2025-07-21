import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import fs from 'fs';
import path from 'path';
import { GeminiAlibabaService } from './GeminiAlibabaService.js';

export class AlibabaService {
    constructor() {
        this.apiUrl = process.env.TRANSLATE_API_URL;
        this.BATCH_SIZE = parseInt(process.env.TRANSLATE_BATCH_SIZE);
        this.CONCURRENT_BATCHES = parseInt(process.env.TRANSLATE_CONCURRENT_BATCHES);
        this.limit = pLimit(this.CONCURRENT_BATCHES);
        this.backupDir = process.env.TRANSLATE_BACKUP_DIR;
        this.geminiService = new GeminiAlibabaService();
        this.ensureBackupDirectory();
    }


    ensureBackupDirectory() {
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir);
            console.log(`Đã tạo thư mục ${this.backupDir}`);
        }
    }

    generateOutputFileName() {
        let now = new Date();
        let timestamp = now.toISOString().replace(/[:.]/g, '-');
        return `data_alibaba_translated_${timestamp}.json`;
    }

    async translateBatch(texts) {
        let response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                texts,
                target_lang: 'vi',
                source_lang: 'auto'
            })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status} - ${await response.text()}`);
        }

        let data = await response.json();
        return data.translated_texts;
    }

    extractTextNodesFromContent(data) {
        let allTextNodes = [];
        let nodeRefs = [];
        let cheerioObjs = [];

        data.forEach((item, itemIdx) => {
            if (item.content) {
                let $ = cheerio.load(item.content, {
                    decodeEntities: false,
                    _useHtmlParser2: true,
                    lowerCaseTags: false,
                    lowerCaseAttributeNames: false,
                    recognizeSelfClosing: true
                });

                let styleContent = '';
                $('style').each(function () {
                    styleContent += $(this).html();
                    $(this).remove();
                });

                cheerioObjs[itemIdx] = {
                    $: $,
                    style: styleContent
                };

                let nodeIdx = 0;
                let collectTextNodes = (node) => {
                    if (node.type === 'text' && node.data.trim()) {
                        allTextNodes.push(node.data);
                        nodeRefs.push({ itemIdx, nodeIdx });
                        nodeIdx++;
                    } else if (node.children && node.children.length) {
                        for (let child of node.children) {
                            collectTextNodes(child);
                        }
                    }
                };

                for (let node of $.root().children()) {
                    collectTextNodes(node);
                }
            }
        });

        return { allTextNodes, nodeRefs, cheerioObjs };
    }

    async fetchApifyDataByUrl(url) {
        try {
            console.log(`Đang lấy dữ liệu từ: ${url}`);
            let response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Lỗi HTTP: ${response.status}`);
            }

            let data = await response.json();
            return data;
        } catch (error) {
            console.error('Lỗi khi lấy dữ liệu:', error.message);
            throw error;
        }
    }

    // Thêm hàm retry cho batch lỗi
    async retry(fn, retries = 2) {
        for (let i = 0; i <= retries; i++) {
            try {
                return await fn();
            } catch (e) {
                if (i === retries) throw e;
            }
        }
    }

    async translateContent(data) {
        // Dịch title song song
        const titlePromise = Promise.all(
            data.map(item => this.geminiService.translateTitleWithGemini(item.title))
        );

        // Dịch content song song
        const { allTextNodes, nodeRefs, cheerioObjs } = this.extractTextNodesFromContent(data);
        let contentPromise = Promise.resolve([]);
        if (allTextNodes.length > 0) {
            let batches = [];
            for (let i = 0; i < allTextNodes.length; i += this.BATCH_SIZE) {
                batches.push(allTextNodes.slice(i, i + this.BATCH_SIZE));
            }
            // Áp dụng retry cho từng batch
            let promises = batches.map(batch => this.limit(() => this.retry(() => this.translateBatch(batch), 2)));
            // Dùng Promise.allSettled để bỏ qua batch lỗi sau khi đã retry
            contentPromise = Promise.allSettled(promises).then(results =>
                results.flatMap(r => r.status === 'fulfilled' ? r.value : [])
            );
        }

        // Chờ cả 2 xong
        const [translatedTitles, translatedTextNodes] = await Promise.all([titlePromise, contentPromise]);

        // Gán lại title đã dịch
        data.forEach((item, i) => {
            item.title = translatedTitles[i] || item.title;
        });

        // Gán lại content đã dịch
        if (allTextNodes.length > 0) {
            let nodeIdxMap = {};
            nodeRefs.forEach((ref, idx) => {
                if (!nodeIdxMap[ref.itemIdx]) nodeIdxMap[ref.itemIdx] = [];
                nodeIdxMap[ref.itemIdx].push({ idx, text: translatedTextNodes[idx] });
            });
            data.forEach((item, itemIdx) => {
                if (item.content && cheerioObjs[itemIdx]) {
                    let { $, style } = cheerioObjs[itemIdx];
                    let textNodeIdx = 0;
                    let replaceTextNodes = (node) => {
                        if (node.type === 'text' && node.data.trim()) {
                            let ref = nodeIdxMap[itemIdx] && nodeIdxMap[itemIdx][textNodeIdx];
                            if (ref) node.data = ref.text;
                            textNodeIdx++;
                        } else if (node.children && node.children.length) {
                            for (let child of node.children) {
                                replaceTextNodes(child);
                            }
                        }
                    };
                    for (let node of $.root().children()) {
                        replaceTextNodes(node);
                    }
                    let formattedStyle = style ? `    <style>\n${style.split('\n').map(line => '        ' + line).join('\n')}\n    </style>\n` : '';
                    let formattedContent = $.root().html();
                    item.content = formattedStyle + formattedContent;
                }
            });
        }
        // Chỉ trả về các trường cần thiết
        return data.map(item => ({
            title: item.title,
            content: item.content,
            thumbnail: item.thumbnail,
            images: item.images,
            price: item.price,
            sku: item.sku
        }));
    }

    async saveTranslatedData(data) {
        let outputFile = this.generateOutputFileName();
        let outputPath = path.join(this.backupDir, outputFile);
        let latestPath = path.join(this.backupDir, 'latest_translation.json');

        fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
        fs.copyFileSync(outputPath, latestPath);

        return { outputPath, latestPath };
    }

    async processTranslation(apifyUrl, isTranslate = true) {
        try {
            let data = await this.fetchApifyDataByUrl(apifyUrl);
            if (!isTranslate) {
                // Chỉ trả về các trường cần thiết nếu không dịch
                return {
                    success: true,
                    data: data.map(item => ({
                        title: item.title,
                        content: item.content,
                        images: item.images,
                        price: item.price,
                        sku: item.sku
                    }))
                };
            }
            let translatedData = await this.translateContent(data);
            let savedPaths = await this.saveTranslatedData(translatedData);

            return {
                success: true,
                data: translatedData,
                savedPaths
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
} 