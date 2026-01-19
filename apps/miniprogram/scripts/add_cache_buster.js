const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const repoRoot = path.resolve(__dirname, '../../..');
const loadEnvFileIfPresent = (filePath) => {
    const fs = require('fs');
    if (!filePath || !fs.existsSync(filePath)) return;
    const text = fs.readFileSync(filePath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
        const trimmed = String(line || '').trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex <= 0) continue;
        const key = trimmed.slice(0, eqIndex).trim();
        let value = trimmed.slice(eqIndex + 1).trim();
        if (!key || process.env[key]) continue;
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        process.env[key] = value;
    }
};

loadEnvFileIfPresent(path.join(repoRoot, '.env.local'));

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
    console.log('🔄 正在为 3D 模型 URL 添加缓存刷新参数...');
    const { data: models, error: fetchError } = await supabase
        .from('wrap_models')
        .select('id, slug, model_3d_url');

    if (fetchError) {
        console.error('❌ 获取模型列表失败:', fetchError.message);
        return;
    }

    const timestamp = Date.now();
    for (const model of models) {
        if (model.model_3d_url) {
            const baseUrl = model.model_3d_url.split('?')[0];
            const newUrl = `${baseUrl}?v=${timestamp}`;

            console.log(`Updating ${model.slug}: ${newUrl}`);
            const { error: updateError } = await supabase
                .from('wrap_models')
                .update({ model_3d_url: newUrl })
                .eq('id', model.id);

            if (updateError) {
                console.error(`❌ 更新 ${model.slug} 失败:`, updateError.message);
            }
        }
    }
    console.log('✅ 数据库地址已更新，CDN 缓存已绕过。');
}

main();
