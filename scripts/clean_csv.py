import csv
import sys

# 增加字段长度限制以避免报错，然后我们在逻辑中手动过滤掉它们
csv.field_size_limit(sys.maxsize)

input_file = '/Users/linpengfei/work/tesla-studio-monorepo/assets/wraps_rows 2.csv'
output_file = '/Users/linpengfei/work/tesla-studio-monorepo/assets/wraps_rows_clean.csv'

try:
    with open(input_file, 'r', encoding='utf-8') as f_in, open(output_file, 'w', encoding='utf-8', newline='') as f_out:
        reader = csv.DictReader(f_in)
        if not reader.fieldnames:
             print("Error: Empty CSV or no headers.")
             sys.exit(1)
        
        # 确保 user_id 在字段列表中
        fieldnames = reader.fieldnames
        
        writer = csv.DictWriter(f_out, fieldnames=fieldnames)
        writer.writeheader()
        
        count = 0
        skipped_count = 0
        
        for row in reader:
            try:
                # 检查是否有超长字段（比如 Base64 图片误入 URL 字段）
                # 正常 URL 很少超过 2000 字符。Base64 通常是几万字符。
                is_bad_row = False
                for k, v in row.items():
                    if v and len(v) > 2000:
                        is_bad_row = True
                        break
                
                if is_bad_row:
                    skipped_count += 1
                    continue

                # 清空 user_id
                if 'user_id' in row:
                    row['user_id'] = ''
                
                # 简单清洗：将 'TRUE'/'FALSE' 转为小写
                for key, value in row.items():
                    if value == 'TRUE':
                        row[key] = 'true'
                    elif value == 'FALSE':
                        row[key] = 'false'
                
                writer.writerow(row)
                count += 1
            except Exception as e:
                skipped_count += 1
                continue
                
        print(f"Successfully processed {count} rows. Skipped {skipped_count} rows containing errors or huge data.")

except Exception as e:
    print(f"An error occurred: {e}")
