#!/usr/bin/env node
/**
 * Gemini API Proxy Performance Benchmark
 * 对比不同代理服务器的性能差异
 * 
 * Usage:
 *   node benchmark-proxy.js
 */

const https = require('https');
const { performance } = require('perf_hooks');

// 测试配置
const PROXIES = [
    {
        name: 'api.aievgo.com (当前代理)',
        baseUrl: 'https://api.aievgo.com'
    },
    {
        name: 'wrapsgenerate.aievgo.com (Cloudflare Workers)',
        baseUrl: 'https://wrapsgenerate.aievgo.com'
    },
    {
        name: 'Google Direct (需要翻墙)',
        baseUrl: 'https://generativelanguage.googleapis.com'
    }
];

const TEST_ITERATIONS = 3; // 每个代理测试次数

/**
 * 测试单次 API 调用性能
 */
async function testApiCall(baseUrl, apiKey, iteration) {
    const MODEL = 'gemini-2.5-flash';
    const url = `${baseUrl.replace(/\/$/, '')}/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

    const payload = JSON.stringify({
        contents: [{ parts: [{ text: "Say 'OK'" }] }]
    });

    return new Promise((resolve, reject) => {
        const startTime = performance.now();
        let dnsTime = 0;
        let tcpTime = 0;
        let tlsTime = 0;
        let ttfb = 0;
        let totalTime = 0;

        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: 443,
            path: urlObj.pathname + urlObj.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
        };

        const req = https.request(options, (res) => {
            ttfb = performance.now() - startTime;

            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                totalTime = performance.now() - startTime;

                resolve({
                    iteration,
                    statusCode: res.statusCode,
                    dnsTime,
                    tcpTime,
                    tlsTime,
                    ttfb,
                    totalTime,
                    success: res.statusCode === 200
                });
            });
        });

        req.on('socket', (socket) => {
            socket.on('lookup', () => {
                dnsTime = performance.now() - startTime;
            });

            socket.on('connect', () => {
                tcpTime = performance.now() - startTime;
            });

            socket.on('secureConnect', () => {
                tlsTime = performance.now() - startTime;
            });
        });

        req.on('error', (err) => {
            totalTime = performance.now() - startTime;
            resolve({
                iteration,
                error: err.message,
                totalTime,
                success: false
            });
        });

        req.setTimeout(30000, () => {
            req.destroy();
            resolve({
                iteration,
                error: 'Timeout (30s)',
                totalTime: performance.now() - startTime,
                success: false
            });
        });

        req.write(payload);
        req.end();
    });
}

/**
 * 计算统计数据
 */
function calculateStats(results) {
    const successResults = results.filter(r => r.success);

    if (successResults.length === 0) {
        return {
            successRate: 0,
            avgTtfb: 0,
            avgTotal: 0,
            minTotal: 0,
            maxTotal: 0
        };
    }

    const ttfbs = successResults.map(r => r.ttfb);
    const totals = successResults.map(r => r.totalTime);

    return {
        successRate: (successResults.length / results.length) * 100,
        avgDns: avg(successResults.map(r => r.dnsTime || 0)),
        avgTcp: avg(successResults.map(r => r.tcpTime || 0)),
        avgTls: avg(successResults.map(r => r.tlsTime || 0)),
        avgTtfb: avg(ttfbs),
        avgTotal: avg(totals),
        minTotal: Math.min(...totals),
        maxTotal: Math.max(...totals)
    };
}

function avg(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * 主测试函数
 */
async function runBenchmark() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 Gemini API Proxy Performance Benchmark');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
        console.error('❌ GEMINI_API_KEY not set');
        process.exit(1);
    }

    console.log(`📊 测试配置:`);
    console.log(`   - 每个代理测试次数: ${TEST_ITERATIONS}`);
    console.log(`   - API Key: ${apiKey.substring(0, 8)}...`);
    console.log('');

    const allResults = {};

    for (const proxy of PROXIES) {
        console.log(`\n🔍 测试代理: ${proxy.name}`);
        console.log(`   URL: ${proxy.baseUrl}`);
        console.log('   ─────────────────────────────────────────────────');

        const results = [];

        for (let i = 1; i <= TEST_ITERATIONS; i++) {
            process.stdout.write(`   [${i}/${TEST_ITERATIONS}] 测试中...`);
            const result = await testApiCall(proxy.baseUrl, apiKey, i);

            if (result.success) {
                console.log(` ✅ ${result.totalTime.toFixed(0)}ms (TTFB: ${result.ttfb.toFixed(0)}ms)`);
            } else {
                console.log(` ❌ ${result.error}`);
            }

            results.push(result);

            // 避免请求过快
            if (i < TEST_ITERATIONS) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        allResults[proxy.name] = {
            results,
            stats: calculateStats(results)
        };
    }

    // 输出对比报告
    console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📈 性能对比报告');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    for (const [proxyName, data] of Object.entries(allResults)) {
        const { stats } = data;
        console.log(`🔹 ${proxyName}`);
        console.log(`   成功率:        ${stats.successRate.toFixed(1)}%`);
        if (stats.successRate > 0) {
            console.log(`   DNS 解析:      ${stats.avgDns.toFixed(0)}ms`);
            console.log(`   TCP 连接:      ${stats.avgTcp.toFixed(0)}ms`);
            console.log(`   TLS 握手:      ${stats.avgTls.toFixed(0)}ms`);
            console.log(`   首字节时间:    ${stats.avgTtfb.toFixed(0)}ms (TTFB)`);
            console.log(`   平均总时间:    ${stats.avgTotal.toFixed(0)}ms`);
            console.log(`   最快/最慢:     ${stats.minTotal.toFixed(0)}ms / ${stats.maxTotal.toFixed(0)}ms`);
        }
        console.log('');
    }

    // 性能差异分析
    const proxyNames = Object.keys(allResults);
    if (proxyNames.length === 2) {
        const [proxy1, proxy2] = proxyNames;
        const stats1 = allResults[proxy1].stats;
        const stats2 = allResults[proxy2].stats;

        if (stats1.successRate > 0 && stats2.successRate > 0) {
            const diff = stats1.avgTotal - stats2.avgTotal;
            const diffPercent = (diff / stats2.avgTotal) * 100;

            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('🎯 结论');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

            if (Math.abs(diff) < 100) {
                console.log(`✅ 两个代理性能相近 (差异 ${Math.abs(diff).toFixed(0)}ms)`);
            } else if (diff > 0) {
                console.log(`⚠️  ${proxy1} 比 ${proxy2} 慢 ${diff.toFixed(0)}ms (${Math.abs(diffPercent).toFixed(1)}%)`);
            } else {
                console.log(`✅ ${proxy1} 比 ${proxy2} 快 ${Math.abs(diff).toFixed(0)}ms (${Math.abs(diffPercent).toFixed(1)}%)`);
            }
        }
    }

    console.log('\n💡 提示:');
    console.log('   - 如果 api.aievgo.com 明显更慢，建议检查其服务器位置和带宽');
    console.log('   - 如果 DNS/TCP/TLS 时间过长，可能是网络链路问题');
    console.log('   - 如果 TTFB 很高，可能是代理服务器处理慢或到 Google 的链路差');
    console.log('');
}

runBenchmark().catch(err => {
    console.error('❌ Benchmark failed:', err);
    process.exit(1);
});
