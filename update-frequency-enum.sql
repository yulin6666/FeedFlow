-- FeedFlow: 更新 frequency 枚举类型从 daily/weekly/realtime 改为 monthly
-- 请在 TablePlus 里执行这个 SQL 文件

BEGIN;

-- 1. 把列改成 text 类型（解除枚举依赖）
ALTER TABLE subscriptions ALTER COLUMN frequency TYPE text;

-- 2. 删除默认值约束（这样才能删除枚举类型）
ALTER TABLE subscriptions ALTER COLUMN frequency DROP DEFAULT;

-- 3. 删除旧枚举类型
DROP TYPE subscriptions_frequency_enum;

-- 4. 创建新枚举类型（只有 monthly）
CREATE TYPE subscriptions_frequency_enum AS ENUM('monthly');

-- 5. 把所有订阅改成 monthly
UPDATE subscriptions SET frequency = 'monthly';

-- 6. 列改回枚举类型
ALTER TABLE subscriptions
ALTER COLUMN frequency TYPE subscriptions_frequency_enum
USING frequency::subscriptions_frequency_enum;

-- 7. 设置默认值
ALTER TABLE subscriptions ALTER COLUMN frequency SET DEFAULT 'monthly';

COMMIT;
