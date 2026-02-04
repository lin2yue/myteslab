/**
 * 数据库多语言字段自动填充脚本
 * 
 * 逻辑:
 * 1. 从 wraps 表读取所有 name_en 为空的记录
 * 2. 对名称进行简单的翻译转换 (MVP阶段可以使用简单规则或调用翻译API)
 * 3. 更新数据库
 */
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('错误: 未找到 Supabase 环境变量');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function translateData() {
    console.log('开始同步多语言数据...');

    // 1. 获取未翻译的贴图
    const { data: wraps, error } = await supabase
        .from('wraps')
        .select('id, name, slug')
        .or('name_en.is.null,name_en.eq.""');

    if (error) {
        console.error('获取数据失败:', error);
        return;
    }

    console.log(`发现 ${wraps.length} 条待翻译记录`);

    for (const wrap of wraps) {
        // 简单的翻译逻辑: 如果是英文名则直接使用，如果是中文则转换为 Slug 格式或保留
        // 在实际生产中，这里可以调用 OpenAI/Azure 翻译 API
        let nameEn = wrap.name;

        // 尝试从 Slug 恢复英文名 (例如 model-3-acid-drip -> Acid Drip)
        if (wrap.slug) {
            const parts = wrap.slug.split('-');
            // 去掉前缀 (如 model-3)
            const nameParts = parts.slice(2).map(p => p.charAt(0).toUpperCase() + p.slice(1));
            if (nameParts.length > 0) {
                nameEn = nameParts.join(' ');
            }
        }

        console.log(`正在更新 [${wrap.name}] -> [${nameEn}]`);

        const { error: updateError } = await supabase
            .from('wraps')
            .update({
                name_en: nameEn,
                description_en: `3D preview and download for ${nameEn} wrap.` // 默认英文描述
            })
            .eq('id', wrap.id);

        if (updateError) {
            console.error(`更新 ${wrap.id} 失败:`, updateError);
        }
    }

    console.log('多语言数据同步完成！');
}

translateData();
