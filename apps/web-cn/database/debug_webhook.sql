-- Create a table to log raw webhook events for debugging
CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider VARCHAR(20) NOT NULL, -- 'alipay', 'polar'
    payload JSONB,
    headers JSONB,
    status VARCHAR(50), -- 'received', 'success', 'failed'
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
