/* ============================================================================
 * File: 06_seed_demo_clients.js
 * Purpose: Seed ~10 REAL (non-dummy) clients assigned to the demo matchmaker
 *          (matchmaker@tdc.demo) so the dashboard, Kanban, alerts, notes,
 *          stage timeline, journey summary, and match history all have
 *          realistic data to render on first login.
 * Run order: AFTER seed.js (the dummy pool must exist for match_records FKs).
 * Run with:  node 06_seed_demo_clients.js
 * Requires:  npm install @supabase/supabase-js dotenv  (already installed)
 * Reads:     SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY from .env
 *
 * Notes:
 *   - Uses the SERVICE ROLE key (bypasses RLS).
 *   - Idempotent-safe: if any non-dummy clients already exist for the demo
 *     matchmaker, it prints a message and exits 0 (re-running won't duplicate).
 *   - These are is_dummy = false, matchmaker_id = DEMO_MATCHMAKER_ID.
 *   - Varied last_contacted_at so check-in alerts (Due Soon / Overdue) light up.
 *   - Each client gets notes + stage_history; two clients get a match_record.
 *
 * Demo matchmaker UUID (from 04_seed_matchmakers.sql):
 *   Demo Matchmaker -> 33333333-3333-3333-3333-333333333333
 * ==========================================================================*/

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('✗ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
});

const DEMO_MATCHMAKER_ID = '33333333-3333-3333-3333-333333333333';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** ISO timestamp for `daysAgo` days before now. */
function daysAgo(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
}

/** DATE string (YYYY-MM-DD) for a person of the given age. */
function dobForAge(age) {
    const today = new Date();
    const y = today.getFullYear() - age;
    const m = String(((age * 7) % 12) + 1).padStart(2, '0');
    const day = String(((age * 3) % 27) + 1).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// ---------------------------------------------------------------------------
// Demo client definitions (realistic TDC clientele; mix of genders + stages).
// last_contacted_at is spread so the alert engine shows a realistic mix:
//   <7 days = calm, 7-13 = Due Soon, 14+ = Overdue, Date Completed + >3d = Feedback
// ---------------------------------------------------------------------------
const DEMO_CLIENTS = [
    {
        first_name: 'Ananya', last_name: 'Krishnan', gender: 'Female', age: 29,
        city: 'Mumbai', country: 'India', height_cm: 164, complexion: 'Wheatish',
        email: 'ananya.krishnan@example.com', phone: '+919820012345',
        ug_college: 'St. Xavier\'s College', ug_degree: 'B.A. Economics',
        pg_college: 'IIM Bangalore', pg_degree: 'MBA',
        current_company: 'Nykaa', designation: 'Senior Brand Manager',
        income_annual: 2800000, marital_status: 'Never Married',
        father_occupation: 'Retired Banker', mother_occupation: 'Homemaker',
        siblings_brothers: 1, siblings_sisters: 0, family_type: 'Nuclear',
        religion: 'Hindu', caste: 'Brahmin',
        want_kids: 'Yes', open_to_relocate: 'Maybe', open_to_pets: 'Yes',
        diet: 'Vegetarian', drink: 'Socially', smoke: 'Never',
        languages: ['English', 'Hindi', 'Tamil'],
        hobbies: 'reading literary fiction, pottery and ceramics, travelling to offbeat destinations, yoga and meditation',
        pref_age_min: 29, pref_age_max: 36, pref_height_min: 170, pref_income_min: 2500000,
        pref_caste_open: 'Open', pref_city: 'Mumbai',
        stage: 'Feedback Pending', last_contacted_at: daysAgo(5),
        photo_url: 'https://randomuser.me/api/portraits/women/65.jpg',
    },
    {
        first_name: 'Rohan', last_name: 'Malhotra', gender: 'Male', age: 33,
        city: 'Bangalore', country: 'India', height_cm: 180, complexion: 'Fair',
        email: 'rohan.malhotra@example.com', phone: '+919845098765',
        ug_college: 'BITS Pilani', ug_degree: 'B.E. Computer Science',
        pg_college: 'ISB Hyderabad', pg_degree: 'MBA',
        current_company: 'CRED', designation: 'Director of Product',
        income_annual: 6500000, marital_status: 'Never Married',
        father_occupation: 'Businessman', mother_occupation: 'Professor',
        siblings_brothers: 0, siblings_sisters: 1, family_type: 'Nuclear',
        religion: 'Hindu', caste: 'Khatri',
        want_kids: 'Yes', open_to_relocate: 'No', open_to_pets: 'Maybe',
        diet: 'Non-Vegetarian', drink: 'Socially', smoke: 'Never',
        languages: ['English', 'Hindi', 'Punjabi'],
        hobbies: 'cycling, investing and personal finance, cooking and experimenting with cuisines, watching documentaries',
        pref_age_min: 27, pref_age_max: 32, pref_height_min: 160, pref_income_min: 0,
        pref_caste_open: 'Same Preferred', pref_city: 'Bangalore',
        stage: 'Intro Sent', last_contacted_at: daysAgo(11),
        photo_url: 'https://randomuser.me/api/portraits/men/52.jpg',
    },
    {
        first_name: 'Saanvi', last_name: 'Reddy', gender: 'Female', age: 27,
        city: 'Hyderabad', country: 'India', height_cm: 160, complexion: 'Wheatish',
        email: 'saanvi.reddy@example.com', phone: '+919701023456',
        ug_college: 'Christ University', ug_degree: 'B.Com',
        pg_college: null, pg_degree: null,
        current_company: 'Deloitte', designation: 'Consultant',
        income_annual: 1800000, marital_status: 'Never Married',
        father_occupation: 'Civil Servant', mother_occupation: 'Doctor',
        siblings_brothers: 1, siblings_sisters: 1, family_type: 'Joint',
        religion: 'Hindu', caste: 'Reddy',
        want_kids: 'Maybe', open_to_relocate: 'Yes', open_to_pets: 'Yes',
        diet: 'Non-Vegetarian', drink: 'Never', smoke: 'Never',
        languages: ['English', 'Telugu', 'Hindi'],
        hobbies: 'dancing (Bharatanatyam / salsa / hip-hop), photography, baking, podcast listening (true crime, history, tech)',
        pref_age_min: 27, pref_age_max: 34, pref_height_min: 168, pref_income_min: 1500000,
        pref_caste_open: 'Open', pref_city: 'Hyderabad',
        stage: 'Active - Searching', last_contacted_at: daysAgo(3),
        photo_url: 'https://randomuser.me/api/portraits/women/44.jpg',
    },
    {
        first_name: 'Karan', last_name: 'Bedi', gender: 'Male', age: 35,
        city: 'Delhi', country: 'India', height_cm: 178, complexion: 'Wheatish',
        email: 'karan.bedi@example.com', phone: '+919811034567',
        ug_college: 'SRCC', ug_degree: 'B.Com',
        pg_college: 'FMS Delhi', pg_degree: 'MBA',
        current_company: 'HDFC Bank', designation: 'Vice President',
        income_annual: 5200000, marital_status: 'Divorced',
        father_occupation: 'Army Officer (Retired)', mother_occupation: 'Homemaker',
        siblings_brothers: 1, siblings_sisters: 0, family_type: 'Nuclear',
        religion: 'Sikh', caste: 'Jat Sikh',
        want_kids: 'No', open_to_relocate: 'Maybe', open_to_pets: 'No',
        diet: 'Non-Vegetarian', drink: 'Socially', smoke: 'Occasionally',
        languages: ['English', 'Hindi', 'Punjabi'],
        hobbies: 'running and half-marathons, single malt appreciation, golf, reading literary fiction',
        pref_age_min: 30, pref_age_max: 38, pref_height_min: 160, pref_income_min: 0,
        pref_caste_open: 'Open', pref_city: 'Delhi',
        stage: 'Re-matching', last_contacted_at: daysAgo(16),
        photo_url: 'https://randomuser.me/api/portraits/men/76.jpg',
    },
    {
        first_name: 'Meera', last_name: 'Joshi', gender: 'Female', age: 31,
        city: 'Pune', country: 'India', height_cm: 166, complexion: 'Fair',
        email: 'meera.joshi@example.com', phone: '+919922045678',
        ug_college: 'Symbiosis', ug_degree: 'B.B.A.',
        pg_college: 'XLRI', pg_degree: 'MBA HR',
        current_company: 'Accenture', designation: 'HR Business Partner',
        income_annual: 2400000, marital_status: 'Never Married',
        father_occupation: 'Engineer', mother_occupation: 'Teacher',
        siblings_brothers: 0, siblings_sisters: 1, family_type: 'Nuclear',
        religion: 'Hindu', caste: 'Deshastha Brahmin',
        want_kids: 'Yes', open_to_relocate: 'Yes', open_to_pets: 'Yes',
        diet: 'Vegetarian', drink: 'Never', smoke: 'Never',
        languages: ['English', 'Marathi', 'Hindi'],
        hobbies: 'hiking and trekking, sketching and watercolors, learning new languages, theatre and improv',
        pref_age_min: 31, pref_age_max: 38, pref_height_min: 172, pref_income_min: 2200000,
        pref_caste_open: 'Same Preferred', pref_city: 'Pune',
        stage: 'Date Completed', last_contacted_at: daysAgo(6),
        photo_url: 'https://randomuser.me/api/portraits/women/33.jpg',
    },
    {
        first_name: 'Aditya', last_name: 'Iyer', gender: 'Male', age: 30,
        city: 'Singapore', country: 'Singapore', height_cm: 176, complexion: 'Wheatish',
        email: 'aditya.iyer@example.com', phone: '+6591234567',
        ug_college: 'NUS', ug_degree: 'B.Eng',
        pg_college: 'NUS', pg_degree: 'M.Sc Data Science',
        current_company: 'Goldman Sachs Tech', designation: 'Senior Software Engineer',
        income_annual: 9800000, marital_status: 'Never Married',
        father_occupation: 'Chartered Accountant', mother_occupation: 'Homemaker',
        siblings_brothers: 0, siblings_sisters: 0, family_type: 'Nuclear',
        religion: 'Hindu', caste: 'Iyer',
        want_kids: 'Yes', open_to_relocate: 'Yes', open_to_pets: 'No',
        diet: 'Vegetarian', drink: 'Socially', smoke: 'Never',
        languages: ['English', 'Tamil', 'Hindi'],
        hobbies: 'scuba diving, music production, astronomy and stargazing, travelling to offbeat destinations',
        pref_age_min: 25, pref_age_max: 30, pref_height_min: 158, pref_income_min: 0,
        pref_caste_open: 'Same Preferred', pref_city: 'Singapore',
        stage: 'New', last_contacted_at: daysAgo(1),
        photo_url: 'https://randomuser.me/api/portraits/men/29.jpg',
    },
    {
        first_name: 'Ishita', last_name: 'Bose', gender: 'Female', age: 33,
        city: 'Bangalore', country: 'India', height_cm: 168, complexion: 'Fair',
        email: 'ishita.bose@example.com', phone: '+919886056789',
        ug_college: 'Jadavpur University', ug_degree: 'B.Tech',
        pg_college: 'IIM Calcutta', pg_degree: 'MBA',
        current_company: 'Flipkart', designation: 'Principal Product Manager',
        income_annual: 7200000, marital_status: 'Never Married',
        father_occupation: 'Professor', mother_occupation: 'Professor',
        siblings_brothers: 0, siblings_sisters: 0, family_type: 'Nuclear',
        religion: 'Hindu', caste: 'Kayastha',
        want_kids: 'Maybe', open_to_relocate: 'No', open_to_pets: 'Yes',
        diet: 'Non-Vegetarian', drink: 'Socially', smoke: 'Never',
        languages: ['English', 'Bengali', 'Hindi'],
        hobbies: 'writing poetry, watching documentaries, cooking and experimenting with cuisines, volunteering and NGO work',
        pref_age_min: 33, pref_age_max: 40, pref_height_min: 175, pref_income_min: 6000000,
        pref_caste_open: 'Open', pref_city: 'Bangalore',
        stage: 'Profile Verified', last_contacted_at: daysAgo(9),
        photo_url: 'https://randomuser.me/api/portraits/women/68.jpg',
    },
    {
        first_name: 'Vikram', last_name: 'Nair', gender: 'Male', age: 38,
        city: 'Chennai', country: 'India', height_cm: 182, complexion: 'Dark',
        email: 'vikram.nair@example.com', phone: '+919840067890',
        ug_college: 'IIT Madras', ug_degree: 'B.Tech',
        pg_college: 'Stanford', pg_degree: 'MS',
        current_company: 'Independent Practice', designation: 'Founder & CEO',
        income_annual: 12000000, marital_status: 'Widowed',
        father_occupation: 'Doctor', mother_occupation: 'Doctor',
        siblings_brothers: 1, siblings_sisters: 1, family_type: 'Joint',
        religion: 'Hindu', caste: 'Nair',
        want_kids: 'Maybe', open_to_relocate: 'No', open_to_pets: 'Yes',
        diet: 'Non-Vegetarian', drink: 'Socially', smoke: 'Never',
        languages: ['English', 'Tamil', 'Malayalam'],
        hobbies: 'sailing, chess and strategy games, investing and personal finance, photography',
        pref_age_min: 30, pref_age_max: 38, pref_height_min: 160, pref_income_min: 0,
        pref_caste_open: 'Open', pref_city: 'Chennai',
        stage: 'On Hold', last_contacted_at: daysAgo(24),
        photo_url: 'https://randomuser.me/api/portraits/men/41.jpg',
    },
    {
        first_name: 'Priya', last_name: 'Sharma', gender: 'Female', age: 28,
        city: 'Gurgaon', country: 'India', height_cm: 162, complexion: 'Fair',
        email: 'priya.sharma.demo@example.com', phone: '+919810078901',
        ug_college: 'Lady Shri Ram College', ug_degree: 'B.A. Psychology',
        pg_college: 'TISS Mumbai', pg_degree: 'M.A. Clinical Psychology',
        current_company: 'Practo', designation: 'Lead Psychologist',
        income_annual: 1600000, marital_status: 'Never Married',
        father_occupation: 'Government Officer', mother_occupation: 'Homemaker',
        siblings_brothers: 1, siblings_sisters: 0, family_type: 'Nuclear',
        religion: 'Hindu', caste: 'Brahmin',
        want_kids: 'Yes', open_to_relocate: 'Yes', open_to_pets: 'Yes',
        diet: 'Vegetarian', drink: 'Never', smoke: 'Never',
        languages: ['English', 'Hindi'],
        hobbies: 'yoga and meditation, baking, reading literary fiction, volunteering and NGO work',
        pref_age_min: 28, pref_age_max: 34, pref_height_min: 170, pref_income_min: 2000000,
        pref_caste_open: 'Same Preferred', pref_city: 'Gurgaon',
        stage: 'Matched', last_contacted_at: daysAgo(4),
        photo_url: 'https://randomuser.me/api/portraits/women/12.jpg',
    },
    {
        first_name: 'Arjun', last_name: 'Mehta', gender: 'Male', age: 31,
        city: 'Mumbai', country: 'India', height_cm: 179, complexion: 'Wheatish',
        email: 'arjun.mehta.demo@example.com', phone: '+919820089012',
        ug_college: 'VJTI Mumbai', ug_degree: 'B.Tech',
        pg_college: 'IIM Ahmedabad', pg_degree: 'MBA',
        current_company: 'McKinsey & Company', designation: 'Engagement Manager',
        income_annual: 8500000, marital_status: 'Never Married',
        father_occupation: 'Entrepreneur', mother_occupation: 'Architect',
        siblings_brothers: 0, siblings_sisters: 1, family_type: 'Nuclear',
        religion: 'Hindu', caste: 'Vaishya',
        want_kids: 'Yes', open_to_relocate: 'Yes', open_to_pets: 'Maybe',
        diet: 'Vegetarian', drink: 'Socially', smoke: 'Never',
        languages: ['English', 'Hindi', 'Gujarati'],
        hobbies: 'hiking and trekking, reading literary fiction, cooking and experimenting with cuisines, tennis',
        pref_age_min: 26, pref_age_max: 30, pref_height_min: 158, pref_income_min: 0,
        pref_caste_open: 'Open', pref_city: 'Mumbai',
        stage: 'Active - Searching', last_contacted_at: daysAgo(8),
        photo_url: 'https://randomuser.me/api/portraits/men/22.jpg',
    },
];

// Notes keyed by client first_name (chronological; created_at drives ordering).
const NOTES_BY_NAME = {
    Ananya: [
        { daysAgo: 40, content: 'Onboarding call complete. Ananya is articulate and clear about wanting an intellectually curious partner who respects her career. Family is supportive, no pressure on timeline.' },
        { daysAgo: 22, content: 'Sent first introduction — a product leader from Bangalore. She appreciated the curation but felt the values alignment was slightly off.' },
        { daysAgo: 5, content: 'First date completed with the second introduction. Positive energy reported on both sides. Awaiting her detailed feedback before planning a second meeting.' },
    ],
    Rohan: [
        { daysAgo: 30, content: 'Rohan is decisive and knows what he wants. Prefers someone settled in Bangalore as he is not open to relocating. Strong family involvement expected.' },
        { daysAgo: 11, content: 'Introduction sent to a brand manager in Mumbai. Geography may be a friction point — flagged for follow-up.' },
    ],
    Saanvi: [
        { daysAgo: 14, content: 'Saanvi is early in her search and open-minded. Career-focused but warm. Open to relocating for the right person.' },
        { daysAgo: 3, content: 'Profile polished and activated. Beginning to shortlist candidates from the Hyderabad and Bangalore pools.' },
    ],
    Karan: [
        { daysAgo: 35, content: 'Karan is divorced, very self-aware about what went wrong previously. Looking for emotional maturity over checklists. Does not want children.' },
        { daysAgo: 16, content: 'Previous introduction did not progress past the first call. Moving him back to re-matching to refine the brief around lifestyle compatibility.' },
    ],
    Meera: [
        { daysAgo: 28, content: 'Meera is warm, grounded, and family-oriented. Open to relocation. Clear preference for a partner who shares her vegetarian lifestyle.' },
        { daysAgo: 13, content: 'Introduction arranged with a consultant. Both keen to meet.' },
        { daysAgo: 6, content: 'Date completed. Meera enjoyed the conversation and is optimistic. Will call her in two days for structured feedback.' },
    ],
    Aditya: [
        { daysAgo: 1, content: 'Initial application reviewed. NRI client based in Singapore, open to relocating back to India for the right match. Strong profile — fast-track verification.' },
    ],
    Ishita: [
        { daysAgo: 18, content: 'Ishita is exceptionally accomplished and values intellectual parity highly. Not open to relocation from Bangalore. Slightly ambivalent about children.' },
        { daysAgo: 9, content: 'Profile verified and approved. Beginning curation — prioritising senior professionals in Bangalore.' },
    ],
    Vikram: [
        { daysAgo: 50, content: 'Vikram is a widower and a successful founder. Thoughtful and patient about the process. Has a young child; seeks a partner comfortable with that.' },
        { daysAgo: 24, content: 'Client requested a pause for two weeks due to a business commitment. Status moved to On Hold. Resume contact end of month.' },
    ],
    Priya: [
        { daysAgo: 60, content: 'Priya is empathetic and self-aware (clinical psychologist). Clear about wanting a partner with emotional intelligence. Open to relocation.' },
        { daysAgo: 30, content: 'Introduced to a consultant from Mumbai. Strong initial rapport.' },
        { daysAgo: 12, content: 'Second date went very well. Both families have spoken. Moving toward commitment.' },
        { daysAgo: 4, content: 'Priya and her match have decided to take things forward exclusively. Marking as Matched. A wonderful outcome — staying available for support.' },
    ],
    Arjun: [
        { daysAgo: 20, content: 'Arjun is ambitious and easy-going. Frequent traveller for work. Wants a partner who is independent and career-driven.' },
        { daysAgo: 8, content: 'Profile active. Reviewing the female pool in Mumbai and open-to-relocate candidates.' },
    ],
};

// Stage history keyed by first_name (chronological). old_stage null for first.
const STAGE_HISTORY_BY_NAME = {
    Ananya: [
        { old: null, neu: 'New', daysAgo: 42 },
        { old: 'New', neu: 'Profile Verified', daysAgo: 40 },
        { old: 'Profile Verified', neu: 'Active - Searching', daysAgo: 35 },
        { old: 'Active - Searching', neu: 'Intro Sent', daysAgo: 22 },
        { old: 'Intro Sent', neu: 'Date Completed', daysAgo: 8 },
        { old: 'Date Completed', neu: 'Feedback Pending', daysAgo: 5 },
    ],
    Rohan: [
        { old: null, neu: 'New', daysAgo: 32 },
        { old: 'New', neu: 'Profile Verified', daysAgo: 30 },
        { old: 'Profile Verified', neu: 'Active - Searching', daysAgo: 25 },
        { old: 'Active - Searching', neu: 'Intro Sent', daysAgo: 11 },
    ],
    Saanvi: [
        { old: null, neu: 'New', daysAgo: 15 },
        { old: 'New', neu: 'Profile Verified', daysAgo: 14 },
        { old: 'Profile Verified', neu: 'Active - Searching', daysAgo: 3 },
    ],
    Karan: [
        { old: null, neu: 'New', daysAgo: 38 },
        { old: 'New', neu: 'Profile Verified', daysAgo: 35 },
        { old: 'Profile Verified', neu: 'Active - Searching', daysAgo: 30 },
        { old: 'Active - Searching', neu: 'Intro Sent', daysAgo: 25 },
        { old: 'Intro Sent', neu: 'Re-matching', daysAgo: 16 },
    ],
    Meera: [
        { old: null, neu: 'New', daysAgo: 30 },
        { old: 'New', neu: 'Profile Verified', daysAgo: 28 },
        { old: 'Profile Verified', neu: 'Active - Searching', daysAgo: 22 },
        { old: 'Active - Searching', neu: 'Intro Sent', daysAgo: 13 },
        { old: 'Intro Sent', neu: 'Date Completed', daysAgo: 6 },
    ],
    Aditya: [
        { old: null, neu: 'New', daysAgo: 1 },
    ],
    Ishita: [
        { old: null, neu: 'New', daysAgo: 20 },
        { old: 'New', neu: 'Profile Verified', daysAgo: 9 },
    ],
    Vikram: [
        { old: null, neu: 'New', daysAgo: 52 },
        { old: 'New', neu: 'Profile Verified', daysAgo: 50 },
        { old: 'Profile Verified', neu: 'Active - Searching', daysAgo: 45 },
        { old: 'Active - Searching', neu: 'On Hold', daysAgo: 24 },
    ],
    Priya: [
        { old: null, neu: 'New', daysAgo: 62 },
        { old: 'New', neu: 'Profile Verified', daysAgo: 60 },
        { old: 'Profile Verified', neu: 'Active - Searching', daysAgo: 50 },
        { old: 'Active - Searching', neu: 'Intro Sent', daysAgo: 30 },
        { old: 'Intro Sent', neu: 'Date Completed', daysAgo: 20 },
        { old: 'Date Completed', neu: 'Matched', daysAgo: 4 },
    ],
    Arjun: [
        { old: null, neu: 'New', daysAgo: 22 },
        { old: 'New', neu: 'Profile Verified', daysAgo: 20 },
        { old: 'Profile Verified', neu: 'Active - Searching', daysAgo: 8 },
    ],
};

// ===========================================================================
// MAIN
// ===========================================================================
async function main() {
    console.log('TDC demo-client seeder starting...');

    // Idempotency guard — skip if demo matchmaker already has real clients.
    const { count, error: countErr } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('matchmaker_id', DEMO_MATCHMAKER_ID)
        .eq('is_dummy', false);

    if (countErr) {
        console.error('✗ Count check failed:', countErr.message);
        process.exit(1);
    }
    if ((count || 0) > 0) {
        console.log(`Demo clients already seeded (${count} found). Skipping.`);
        process.exit(0);
    }

    // 1. Insert client profiles.
    const rows = DEMO_CLIENTS.map((c) => ({
        ...c,
        is_dummy: false,
        matchmaker_id: DEMO_MATCHMAKER_ID,
        date_of_birth: dobForAge(c.age),
    }));
    // age is a trigger-maintained column — never send it.
    rows.forEach((r) => delete r.age);

    const { data: inserted, error: insErr } = await supabase
        .from('profiles')
        .insert(rows)
        .select('id, first_name');

    if (insErr) {
        console.error('✗ Profile insert failed:', insErr.message);
        process.exit(1);
    }
    console.log(`✓ Inserted ${inserted.length} demo clients.`);

    const idByName = {};
    inserted.forEach((r) => { idByName[r.first_name] = r.id; });

    // 2. Insert notes.
    const noteRows = [];
    for (const [name, notes] of Object.entries(NOTES_BY_NAME)) {
        const cid = idByName[name];
        if (!cid) continue;
        for (const n of notes) {
            noteRows.push({
                client_id: cid,
                matchmaker_id: DEMO_MATCHMAKER_ID,
                content: n.content,
                created_at: daysAgo(n.daysAgo),
            });
        }
    }
    const { error: noteErr } = await supabase.from('notes').insert(noteRows);
    if (noteErr) {
        console.error('✗ Notes insert failed:', noteErr.message);
        process.exit(1);
    }
    console.log(`✓ Inserted ${noteRows.length} notes.`);

    // NOTE: the notes-insert trigger overwrites last_contacted_at with each
    // note's created_at. Re-assert the intended last_contacted_at afterwards
    // so the alert engine shows the spread we designed.
    for (const c of DEMO_CLIENTS) {
        const cid = idByName[c.first_name];
        if (!cid) continue;
        await supabase.from('profiles')
            .update({ last_contacted_at: c.last_contacted_at })
            .eq('id', cid);
    }
    console.log('✓ Re-asserted last_contacted_at for alert spread.');

    // 3. Insert stage history.
    const shRows = [];
    for (const [name, hist] of Object.entries(STAGE_HISTORY_BY_NAME)) {
        const cid = idByName[name];
        if (!cid) continue;
        for (const h of hist) {
            shRows.push({
                client_id: cid,
                old_stage: h.old,
                new_stage: h.neu,
                changed_by: DEMO_MATCHMAKER_ID,
                changed_at: daysAgo(h.daysAgo),
            });
        }
    }
    const { error: shErr } = await supabase.from('stage_history').insert(shRows);
    if (shErr) {
        console.error('✗ Stage history insert failed:', shErr.message);
        process.exit(1);
    }
    console.log(`✓ Inserted ${shRows.length} stage-history rows.`);

    // 4. Insert a couple of match_records (link a client to a dummy of the
    //    opposite gender). Priya (Matched) and Meera (Date Completed) get one.
    const matchClients = ['Priya', 'Meera'];
    const mrRows = [];
    for (const name of matchClients) {
        const client = DEMO_CLIENTS.find((c) => c.first_name === name);
        const cid = idByName[name];
        if (!cid) continue;
        const oppGender = client.gender === 'Female' ? 'Male' : 'Female';
        const { data: dummies } = await supabase
            .from('profiles')
            .select('id, first_name, last_name')
            .eq('is_dummy', true)
            .eq('gender', oppGender)
            .limit(1);
        if (!dummies || !dummies.length) continue;
        const score = name === 'Priya' ? 88 : 74;
        const label = score >= 80 ? 'High Potential Match'
            : score >= 60 ? 'Good Match' : 'Possible';
        mrRows.push({
            client_id: cid,
            matched_with_id: dummies[0].id,
            match_score: score,
            score_label: label,
            ai_headline: name === 'Priya'
                ? 'Two grounded minds with a shared sense of purpose'
                : 'Aligned values and a love for the outdoors',
            ai_explanation: {
                headline: name === 'Priya'
                    ? 'Two grounded minds with a shared sense of purpose'
                    : 'Aligned values and a love for the outdoors',
                why_this_works: [
                    'Both prioritise emotional intelligence and open communication.',
                    'Shared openness to relocation removes a common friction point.',
                    'Complementary professional ambitions with mutual respect.',
                ],
                talking_points: ['Life goals', 'Travel', 'Family values'],
            },
            intro_email_sent: `Hi ${name}, I'd love to introduce you to ${dummies[0].first_name}. I have a strong feeling you'll connect — more details to follow.`,
            sent_at: daysAgo(name === 'Priya' ? 30 : 13),
            sent_by: DEMO_MATCHMAKER_ID,
        });
    }
    if (mrRows.length) {
        const { error: mrErr } = await supabase.from('match_records').insert(mrRows);
        if (mrErr) {
            console.error('✗ Match records insert failed:', mrErr.message);
            process.exit(1);
        }
        console.log(`✓ Inserted ${mrRows.length} match records.`);
    }

    console.log('');
    console.log('✓ Demo clients seeded successfully for matchmaker@tdc.demo');
    console.log(`  Clients: ${inserted.length} | Notes: ${noteRows.length} | `
        + `Stage rows: ${shRows.length} | Matches: ${mrRows.length}`);
    process.exit(0);
}

main().catch((err) => {
    console.error('✗ Unexpected error:', err);
    process.exit(1);
});
