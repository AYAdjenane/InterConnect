-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT CHECK(role IN ('student', 'company')) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Student profiles table
CREATE TABLE IF NOT EXISTS student_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone TEXT,
    university TEXT,
    bio TEXT,
    profile_strength INTEGER DEFAULT 0,
    avatar_url TEXT,
    skills TEXT DEFAULT ''
);

-- Company profiles table
CREATE TABLE IF NOT EXISTS company_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    description TEXT,
    field_of_activity TEXT,
    address TEXT,
    website TEXT,
    contact_email TEXT,
    logo_url TEXT
);

-- Offers table
CREATE TABLE IF NOT EXISTS offers (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT CHECK(type IN ('Internship', 'Job', 'PFE', 'Part-time', 'Full-time')) NOT NULL,
    location TEXT NOT NULL,
    description TEXT NOT NULL,
    field_of_study TEXT DEFAULT 'Computer Science',
    duration TEXT DEFAULT '3-6 months',
    status TEXT CHECK(status IN ('Active', 'Closed')) DEFAULT 'Active',
    published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    view_count INTEGER DEFAULT 0
);

-- Applications table
CREATE TABLE IF NOT EXISTS applications (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    offer_id INTEGER NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
    status TEXT CHECK(status IN ('Under Review', 'Interview', 'Viewed', 'Rejected', 'Accepted')) DEFAULT 'Under Review',
    cover_letter TEXT,
    cv_url TEXT,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, offer_id)
);

-- Saved offers table
CREATE TABLE IF NOT EXISTS saved_offers (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    offer_id INTEGER NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, offer_id)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    read INTEGER DEFAULT 0, -- 0 for false, 1 for true
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Match scores table
CREATE TABLE IF NOT EXISTS match_scores (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    offer_id INTEGER NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, offer_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_student_profiles_user ON student_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_company_profiles_user ON company_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_offers_company ON offers(company_id);
CREATE INDEX IF NOT EXISTS idx_applications_student ON applications(student_id);
CREATE INDEX IF NOT EXISTS idx_applications_offer ON applications(offer_id);
CREATE INDEX IF NOT EXISTS idx_saved_offers_student ON saved_offers(student_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_match_scores_student_offer ON match_scores(student_id, offer_id);
