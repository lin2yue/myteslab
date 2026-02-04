/**
 * 数据库设置脚本
 * 用于在Supabase中创建表结构和导入初始数据
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// 从环境变量读取配置
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ 缺少环境变量: NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function setupDatabase() {
    console.log('🚀 开始设置数据库...\n')

    try {
        // 读取SQL文件
        const sqlPath = path.join(__dirname, 'schema.sql')
        const sql = fs.readFileSync(sqlPath, 'utf-8')

        console.log('📄 执行SQL脚本...')

        // 注意: Supabase客户端不直接支持执行原始SQL
        // 需要在Supabase Dashboard的SQL编辑器中手动执行
        console.log('\n⚠️  请在Supabase Dashboard中执行以下步骤:')
        console.log('1. 访问: https://app.supabase.com')
        console.log('2. 选择你的项目')
        console.log('3. 进入 SQL Editor')
        console.log('4. 复制并执行 database/schema.sql 文件内容\n')

        // 验证表是否创建成功
        console.log('🔍 验证表结构...')

        const { data: models, error: modelsError } = await supabase
            .from('models')
            .select('count')
            .limit(1)

        if (modelsError) {
            console.log('❌ models表不存在,请先执行schema.sql')
            return
        }

        const { data: wraps, error: wrapsError } = await supabase
            .from('wraps')
            .select('count')
            .limit(1)

        if (wrapsError) {
            console.log('❌ wraps表不存在,请先执行schema.sql')
            return
        }

        console.log('✅ 表结构验证成功!')

        // 检查初始数据
        const { data: modelsList } = await supabase
            .from('models')
            .select('*')

        console.log(`\n📊 当前车型数量: ${modelsList?.length || 0}`)
        if (modelsList && modelsList.length > 0) {
            console.log('车型列表:')
            modelsList.forEach(model => {
                console.log(`  - ${model.name} (${model.slug})`)
            })
        }

        console.log('\n✅ 数据库设置完成!')

    } catch (error) {
        console.error('❌ 设置失败:', error)
        process.exit(1)
    }
}

setupDatabase()
