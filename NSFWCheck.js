import * as nsfwjs from 'nsfwjs'
import tf from '@tensorflow/tfjs-node'
import tesseract from 'node-tesseract-ocr';
import axios from 'axios';
import fs from 'fs';
import redis from 'ioredis';
const Redis = new redis();


export default class NsfwCheck {
    constructor(redis) {
    }

    async fetchProxies() {
        let proxies = fs.readFileSync('proxies.txt', 'utf-8').split('\n');
        proxies = proxies.map(proxy => {
            const [ip, port, username, password] = proxy.split(':');
            return { host: ip, port, username, password, protocol: 'http' };
        });
        await Redis.set('rblx_proxies', JSON.stringify(proxies), 'EX', 60 * 60);
        return proxies;
    }

    async getProxy() {
        let proxies = await Redis.get('rblx_proxies');

        if (!proxies) {
            proxies = await this.fetchProxies();
        }
        else {
            proxies = JSON.parse(proxies);
        }

        return proxies[Math.floor(Math.random() * proxies.length)];
    }

    async isNsfw(predictions) {
    let score;
        let isHigh = false;
        const scores = {    }
        for (const prediction of predictions) {
            if (!["Porn", "Hentai", "Sexy"].includes(prediction.className)) continue;
            if (prediction.probability > 0.7) {
                isHigh = true;
                scores[prediction.className] = prediction.probability;
                break;
            }
        }

        if (isHigh) {
            score = 0;
            for (const key in scores) {
                score += scores[key];
            }
            score /= Object.keys(scores).length;
        }
        else {
            score = 0;
        }
        return { isHigh, score };
    }

    async getNsfwScore(url) {
        const image = await axios.get(url, { responseType: 'arraybuffer' })
        
        const model = await nsfwjs.load();
        const decoded = tf.node.decodeImage(image, 3);
        const predictions = await model.classify(decoded);
        decoded.dispose();

        // change arraybuffer to regular buffer for tesseract
        /*
        const buffer = Buffer.from(image);
        const text = await tesseract.recognize(buffer, {
            lang: 'eng',
            oem: 1,
            psm: 3,
        });

        console.log(text);
        
        const badWords = ['test']*/

        const obj = this.isNsfw(predictions);
        
        /*
        if (badWords.some(word => text.toLowerCase().includes(word))) {
            obj.isHigh = true;
            obj.score = 1;
            obj.reason = 'bad word';
        }
        else {*/
            if (obj.isHigh) {
                obj.reason = 'nsfw';
            }
        //}

        return obj;
    }

    async getId(id) {
        const proxy = await this.getProxy();
        try {
            const robloxRes = await axios.get(`https://thumbnails.roblox.com/v1/assets?assetIds=${id}&returnPolicy=PlaceHolder&size=420x420&format=png`,{ proxy })
            if (!robloxRes) return null;
            const json = robloxRes.data;
            const data = json.data[0];
            if (!data) return null;
            const imageUrl = data.imageUrl;
            if (!imageUrl) return null;
            return imageUrl;
        }
        catch (err) {
            if (isRetry) return null;
            return await getId(id, true);
        }
    }
}
