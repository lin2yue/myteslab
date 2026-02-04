/**
 * 数据库多语言字段深度翻译脚本 (V2) - STRING CONCAT VERSION
 */
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;

if (!supabaseUrl || !supabaseKey || !geminiApiKey) {
    console.error('错误: 未找到必要的环境变量');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function translateText(name, prompt, retries = 3) {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=' + geminiApiKey;

    const combinedPrompt = 'You are a professional automotive wrap titler. ' +
        'Based on the existing Chinese name/prompt, generate a creative English title and short descriptions in both Chinese and English. ' +
        '\n\nInput:\nChinese Name: ' + name + '\nPrompt: ' + prompt +
        '\n\nReturn ONLY a valid JSON object with EXACTLY these keys: name_en, description, description_en. ' +
        'Keep name_en under 15 characters, descriptions under 50 characters.\nJSON output:';

    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: combinedPrompt }] }]
                })
            });

            if (!response.ok) {
                const errBody = await response.text();
                if (response.status === 429) {
                    console.log('RT... ');
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    continue;
                }
                throw new Error('Gemini API failed with status ' + response.status + ': ' + errBody);
            }

            const content = await response.json();
            const text = content.candidates[0].content.parts[0].text;
            if (!text) throw new Error('No text in Gemini response');

            const jsonMatch = text.match(/\{.*\}/s);
            const jsonStr = jsonMatch ? jsonMatch[0] : text;

            return JSON.parse(jsonStr);
        } catch (err) {
            if (i === retries - 1) {
                console.error('翻译 [' + name + '] 失败:', err.message);
                return null;
            }
            console.log('Retry... ');
            await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
        }
    }
}

async function startTranslation() {
    console.log('🚀 开始深度翻译现有数据...');

    const { data: wraps, error } = await supabase
        .from('wraps')
        .select('id, name, prompt, name_en');

    if (error) {
        console.error('获取数据失败:', error);
        return;
    }

    const pendingWraps = wraps.filter(w => !w.name_en || w.name_en === w.name);

    console.log('📊 共计 ' + wraps.length + ' 条记录，清理后需翻译 ' + pendingWraps.length + ' 条记录');

    for (let i = 0; i < pendingWraps.length; i++) {
        const wrap = pendingWraps[i];
        process.stdout.write('[' + (i + 1) + '/' + pendingWraps.length + '] 正在处理: ' + wrap.name + '... ');

        const result = await translateText(wrap.name, wrap.prompt);

        if (result) {
            const { error: updateError } = await supabase
                .from('wraps')
                .update({
                    name_en: result.name_en,
                    description_en: result.description_en
                })
                .eq('id', wrap.id);

            if (updateError) {
                console.log('❌ 更新失败');
                console.error(updateError);
            } else {
                console.log('✅ -> ' + result.name_en);
            }
        } else {
            console.log('⏩ 跳过');
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('✨ 所有存量数据翻译完成！');
}

startTranslation();
