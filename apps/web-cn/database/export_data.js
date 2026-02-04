/**
 * 从现有Supabase数据库导出贴图数据
 * 用于在Web版中导入
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// 从小程序的环境变量读取(需要先设置)
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ 缺少环境变量: SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY')
    console.log('\n请设置环境变量:')
    console.log('export SUPABASE_URL=your_url')
    console.log('export SUPABASE_SERVICE_ROLE_KEY=your_key\n')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function exportData() {
    console.log('🚀 开始导出数据...\n')

    try {
        // 1. 导出车型数据
        console.log('📊 导出车型数据...')
        const { data: models, error: modelsError } = await supabase
            .from('models')
            .select('*')
            .order('created_at', { ascending: true })

        if (modelsError) {
            console.error('❌ 导出车型失败:', modelsError)
            return
        }

        console.log(`✅ 找到 ${models.length} 个车型`)
        models.forEach(m => console.log(`  - ${m.name} (${m.slug})`))

        // 2. 导出贴图数据
        console.log('\n📊 导出贴图数据...')
        const { data: wraps, error: wrapsError } = await supabase
            .from('wraps')
            .select('*')
            .eq('category', 'official')  // 只导出官方贴图
            .order('created_at', { ascending: true })

        if (wrapsError) {
            console.error('❌ 导出贴图失败:', wrapsError)
            return
        }

        console.log(`✅ 找到 ${wraps.length} 个官方贴图`)

        // 3. 导出车型-贴图关联
        console.log('\n📊 导出关联数据...')
        const { data: modelWraps, error: modelWrapsError } = await supabase
            .from('model_wraps')
            .select('*')

        if (modelWrapsError) {
            console.error('❌ 导出关联失败:', modelWrapsError)
        } else {
            console.log(`✅ 找到 ${modelWraps?.length || 0} 条关联记录`)
        }

        // 4. 保存到JSON文件
        const exportData = {
            models,
            wraps,
            model_wraps: modelWraps || [],
            exported_at: new Date().toISOString(),
            total_models: models.length,
            total_wraps: wraps.length
        }

        const outputPath = path.join(__dirname, 'exported_data.json')
        fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2))

        console.log(`\n✅ 数据已导出到: ${outputPath}`)
        console.log('\n📊 导出统计:')
        console.log(`  - 车型: ${models.length}`)
        console.log(`  - 贴图: ${wraps.length}`)
        console.log(`  - 关联: ${modelWraps?.length || 0}`)

        // 5. 生成SQL导入脚本
        console.log('\n📝 生成SQL导入脚本...')
        generateImportSQL(exportData)

    } catch (error) {
        console.error('❌ 导出失败:', error)
    }
}

function generateImportSQL(data) {
    const lines = []

    lines.push('-- Tesla Studio 贴图数据导入')
    lines.push('-- 生成时间: ' + new Date().toISOString())
    lines.push('')

    // 生成wraps插入语句
    if (data.wraps.length > 0) {
        lines.push('-- 插入贴图数据')
        lines.push('INSERT INTO wraps (id, slug, name, description, texture_url, preview_url, category, download_count, created_at) VALUES')

        const wrapValues = data.wraps.map((wrap, index) => {
            const values = [
                `'${wrap.id}'`,
                `'${wrap.slug}'`,
                `'${wrap.name.replace(/'/g, "''")}'`,
                wrap.description ? `'${wrap.description.replace(/'/g, "''")}'` : 'NULL',
                `'${wrap.texture_url}'`,
                `'${wrap.preview_url}'`,
                `'${wrap.category}'`,
                wrap.download_count || 0,
                `'${wrap.created_at}'`
            ]
            const isLast = index === data.wraps.length - 1
            return `  (${values.join(', ')})${isLast ? ';' : ','}`
        })

        lines.push(...wrapValues)
        lines.push('')
    }

    // 生成model_wraps插入语句
    if (data.model_wraps.length > 0) {
        lines.push('-- 插入车型-贴图关联')
        lines.push('INSERT INTO model_wraps (model_id, wrap_id) VALUES')

        const relationValues = data.model_wraps.map((rel, index) => {
            const isLast = index === data.model_wraps.length - 1
            return `  ('${rel.model_id}', '${rel.wrap_id}')${isLast ? ';' : ','}`
        })

        lines.push(...relationValues)
    }

    const sqlPath = path.join(__dirname, 'import_wraps.sql')
    fs.writeFileSync(sqlPath, lines.join('\n'))
    console.log(`✅ SQL脚本已生成: ${sqlPath}`)
}

exportData()
