
import csv
import json

input_file = '/Users/linpengfei/work/tesla-studio-monorepo/assets/wraps_rows_clean.csv'
output_file = '/Users/linpengfei/work/tesla-studio-monorepo/apps/web/database/seed_wraps.sql'

def escape_sql(value):
    if value is None or value == '':
        return 'NULL'
    # Escape single quotes
    val_str = str(value).replace("'", "''")
    return f"'{val_str}'"

try:
    with open(input_file, 'r', encoding='utf-8') as f_in, open(output_file, 'w', encoding='utf-8') as f_out:
        reader = csv.DictReader(f_in)
        
        f_out.write("-- Seed data for wraps table\n")
        f_out.write("BEGIN;\n")
        
        count = 0
        for row in reader:
            # Map CSV columns to Table columns
            # CSV: id,name,category,texture_url,preview_url,user_id,model_slug,is_public, ...
            
            # Skip if critical fields are missing
            if not row.get('name') or not row.get('texture_url'):
                continue

            id_val = escape_sql(row.get('id'))
            name_val = escape_sql(row.get('name'))
            category_val = escape_sql(row.get('category'))
            texture_url_val = escape_sql(row.get('texture_url'))
            preview_url_val = escape_sql(row.get('preview_url') or row.get('thumb_url') or row.get('thumbnail_url')) 
            # Note: CSV has multiple url fields, Supabase schema requires preview_url NOT NULL.
            # If preview_url is empty in CSV, force it from texture_url or a placeholder
            if  row.get('preview_url') == '':
                 if row.get('thumb_url'): preview_url_val = escape_sql(row.get('thumb_url'))
                 elif row.get('thumbnail_url'): preview_url_val = escape_sql(row.get('thumbnail_url'))
                 else: preview_url_val = texture_url_val # Fallback

            model_slug_val = escape_sql(row.get('model_slug'))
            is_public_val = row.get('is_public', 'true').lower() 
            if is_public_val not in ['true', 'false']: is_public_val = 'true'
            
            prompt_val = escape_sql(row.get('prompt'))
            desc_val = escape_sql(row.get('description'))
            
            # user_id is NULL as per plan
            
            sql = f"""
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ({id_val}, {name_val}, {category_val}, {texture_url_val}, {preview_url_val}, {model_slug_val}, {is_public_val}, {prompt_val}, {desc_val}, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            """
            f_out.write(sql)
            count += 1

        f_out.write("COMMIT;\n")
        print(f"Generated SQL for {count} rows.")

except Exception as e:
    print(f"An error occurred: {e}")
