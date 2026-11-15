-- ==============================================================================
-- Seed Data: Demo Enterprise Organization, Admin, and Default Configuration
-- ==============================================================================

-- 1. Create Demo Organization
INSERT INTO organizations (id, name, slug, plan)
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'Acme Global Enterprises', 'acme-global', 'enterprise')
ON CONFLICT (slug) DO NOTHING;

-- 2. Create Demo Admin User (Password: Password123!)
-- Hash generated using bcrypt for 'Password123!'
INSERT INTO users (id, email, password_hash, full_name, is_active)
VALUES 
    ('00000000-0000-0000-0000-000000000002', 'admin.kai@yopmail.com', '$2a$10$wT8f6sIq4Z9Zl1N6aC9Oeu248u7M.M8VjFz7P1o/uY1uO8a.9C1vG', 'Dr. Sarah Connor', TRUE)
ON CONFLICT (email) DO NOTHING;

-- 3. Link Demo Admin User to Acme Organization as Org Admin
INSERT INTO organization_members (organization_id, user_id, role)
VALUES 
    ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'org_admin')
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- 4. Default Organization RAG Settings
INSERT INTO organization_settings (
    organization_id, 
    top_k, 
    similarity_threshold, 
    chunk_size, 
    chunk_overlap, 
    hybrid_vector_weight, 
    hybrid_fts_weight, 
    reranking_enabled, 
    max_context_tokens
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    5,
    0.650,
    800,
    150,
    0.700,
    0.300,
    TRUE,
    3500
) ON CONFLICT (organization_id) DO NOTHING;

-- 5. Create Default Knowledge Base
INSERT INTO knowledge_bases (id, organization_id, name, description, created_by)
VALUES 
    (
        '00000000-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000001',
        'Enterprise Operations & Engineering Policies',
        'Standard Operating Procedures, Technical Architecture specifications, and Employee Handbook.',
        '00000000-0000-0000-0000-000000000002'
    )
ON CONFLICT (id) DO NOTHING;
