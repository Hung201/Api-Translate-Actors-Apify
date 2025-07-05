import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import fs from 'fs';
import path from 'path';

export class AlibabaService {
        constructor() {
                this.apiUrl = 'https://api-translate.daisan.vn/translate/batch';
                this.BATCH_SIZE = 125;
                this.CONCURRENT_BATCHES = 7;
                this.limit = pLimit(this.CONCURRENT_BATCHES);
                this.backupDir = 'backup_translations';

                this.ensureBackupDirectory();
        }

        ensureBackupDirectory() {
                if (!fs.existsSync(this.backupDir)) {
                        fs.mkdirSync(this.backupDir);
                        console.log(`Đã tạo thư mục ${this.backupDir}`);
                }
        }

        generateOutputFileName() {
                const now = new Date();
                const timestamp = now.toISOString().replace(/[:.]/g, '-');
                return `data_alibaba_translated_${timestamp}.json`;
        }

        async translateBatch(texts) {
                const response = await fetch(this.apiUrl, {
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

                const data = await response.json();
                return data.translated_texts;
        }

        extractTextNodesFromContent(data) {
                let allTextNodes = [];
                let nodeRefs = [];
                let cheerioObjs = [];

                data.forEach((item, itemIdx) => {
                        if (item.content) {
                                const $ = cheerio.load(item.content, {
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
                                const collectTextNodes = (node) => {
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
                        const response = await fetch(url);

                        if (!response.ok) {
                                throw new Error(`Lỗi HTTP: ${response.status}`);
                        }

                        const data = await response.json();
                        return data;
                } catch (error) {
                        console.error('Lỗi khi lấy dữ liệu:', error.message);
                        throw error;
                }
        }

        async translateContent(data) {
                // Dịch titles
                const titles = data.map(item => item.title);
                const translatedTitles = await this.translateBatch(titles);

                data.forEach((item, i) => {
                        item.title = translatedTitles[i] || item.title;
                });

                // Dịch content
                const { allTextNodes, nodeRefs, cheerioObjs } = this.extractTextNodesFromContent(data);

                if (allTextNodes.length > 0) {
                        const batches = [];
                        for (let i = 0; i < allTextNodes.length; i += this.BATCH_SIZE) {
                                batches.push(allTextNodes.slice(i, i + this.BATCH_SIZE));
                        }

                        const promises = batches.map(batch => this.limit(() => this.translateBatch(batch)));
                        const results = await Promise.all(promises);
                        const translatedTextNodes = results.flat();

                        const nodeIdxMap = {};
                        nodeRefs.forEach((ref, idx) => {
                                if (!nodeIdxMap[ref.itemIdx]) nodeIdxMap[ref.itemIdx] = [];
                                nodeIdxMap[ref.itemIdx].push({ idx, text: translatedTextNodes[idx] });
                        });

                        data.forEach((item, itemIdx) => {
                                if (item.content && cheerioObjs[itemIdx]) {
                                        const { $, style } = cheerioObjs[itemIdx];
                                        let textNodeIdx = 0;

                                        const replaceTextNodes = (node) => {
                                                if (node.type === 'text' && node.data.trim()) {
                                                        const ref = nodeIdxMap[itemIdx] && nodeIdxMap[itemIdx][textNodeIdx];
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

                                        const formattedStyle = style ? `    <style>\n${style.split('\n').map(line => '        ' + line).join('\n')}\n    </style>\n` : '';
                                        const formattedContent = $.root().html()
                                                .replace(/<div/g, '<DIV')
                                                .replace(/<\/div>/g, '</DIV>')
                                                .replace(/<img/g, '<IMG')
                                                .replace(/<\/img>/g, '')
                                                .replace(/<br\/?>/g, '<BR/>')
                                                .replace(/<b>/g, '<B>')
                                                .replace(/<\/b>/g, '</B>')
                                                .replace(/<table/g, '<TABLE')
                                                .replace(/<\/table>/g, '</TABLE>')
                                                .replace(/<tbody/g, '<TBODY')
                                                .replace(/<\/tbody>/g, '</TBODY>')
                                                .replace(/<tr/g, '<TR')
                                                .replace(/<\/tr>/g, '</TR>')
                                                .replace(/<td/g, '<TD')
                                                .replace(/<\/td>/g, '</TD>')
                                                .replace(/<span/g, '<SPAN')
                                                .replace(/<\/span>/g, '</SPAN>');

                                        item.content = formattedStyle + formattedContent;
                                }
                        });
                }

                return data;
        }

        async saveTranslatedData(data) {
                const outputFile = this.generateOutputFileName();
                const outputPath = path.join(this.backupDir, outputFile);
                const latestPath = path.join(this.backupDir, 'latest_translation.json');

                fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
                fs.copyFileSync(outputPath, latestPath);

                return { outputPath, latestPath };
        }

        async processTranslation(apifyUrl) {
                try {
                        const data = await this.fetchApifyDataByUrl(apifyUrl);
                        const translatedData = await this.translateContent(data);
                        const savedPaths = await this.saveTranslatedData(translatedData);

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