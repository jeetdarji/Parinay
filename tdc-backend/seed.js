/* ============================================================================
 * File: seed.js
 * Purpose: Insert 120 male + 120 female dummy profiles (240 total) into the
 *          Supabase `profiles` table for the TDC Matchmaker demo pool.
 * Run order: after 00..04 SQL files have been run.
 * Run with:  node seed.js
 * Requires:  npm install @supabase/supabase-js dotenv
 * Reads:     SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY from .env
 *
 * Notes:
 *   - Uses the SERVICE ROLE key, which bypasses RLS (required for seeding
 *     dummy profiles that have matchmaker_id = NULL).
 *   - Idempotent-safe: if >= 240 dummy profiles already exist, it skips.
 *   - Dummy profiles: is_dummy = true, matchmaker_id = null,
 *     stage = 'Active - Searching'.
 *
 * Matchmaker UUIDs (from 04_seed_matchmakers.sql, kept here for Phase 4 ref):
 *   Kawaljeet Kaur  -> 11111111-1111-1111-1111-111111111111
 *   Shimpi Sharma   -> 22222222-2222-2222-2222-222222222222
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

// ===========================================================================
// HELPERS
// ===========================================================================

/** Pick a random element from an array. */
function randomFrom(array) {
    return array[Math.floor(Math.random() * array.length)];
}

/** Inclusive random integer between min and max. */
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Weighted random selection.
 * @param {Array} options  values to choose from
 * @param {number[]} weights  relative weights (need not sum to 1)
 * @returns one option chosen with probability proportional to its weight
 */
function weightedRandom(options, weights) {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < options.length; i++) {
        r -= weights[i];
        if (r <= 0) return options[i];
    }
    return options[options.length - 1];
}

/**
 * Return a DATE string (YYYY-MM-DD) for a person of a random age in
 * [minAge, maxAge]. Skews toward the center of the range to mirror the
 * 28–33 concentration of TDC's clientele.
 */
function generateDOB(minAge, maxAge) {
    // Average two uniform draws -> triangular distribution peaked at center.
    const a = randomInt(minAge, maxAge);
    const b = randomInt(minAge, maxAge);
    const age = Math.round((a + b) / 2);

    const today = new Date();
    const birthYear = today.getFullYear() - age;
    const month = randomInt(1, 12);
    const day = randomInt(1, 28); // safe for all months
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${birthYear}-${mm}-${dd}`;
}

/** Age (years) from a YYYY-MM-DD DOB string. */
function ageFromDOB(dob) {
    const d = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
    return age;
}

/** Normal-ish value via central limit (avg of uniforms), clamped to [min,max]. */
function normalInt(mean, spread, min, max) {
    // Average of 3 uniform deviations -> bell-shaped result around `mean`.
    let s = 0;
    for (let i = 0; i < 3; i++) s += (Math.random() * 2 - 1) * spread;
    let v = Math.round(mean + s / 3);
    if (v < min) v = min;
    if (v > max) v = max;
    return v;
}

/** Pick `count` distinct random elements from an array. */
function sampleDistinct(array, count) {
    const pool = [...array];
    const out = [];
    for (let i = 0; i < count && pool.length; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        out.push(pool.splice(idx, 1)[0]);
    }
    return out;
}

// ===========================================================================
// DATA POOLS
// ===========================================================================

// --- Cities (weighted) + country + primary language ---
const CITY_DATA = [
    { city: 'Mumbai',       country: 'India',     lang: 'Marathi',   weight: 25 },
    { city: 'Bangalore',    country: 'India',     lang: 'Kannada',   weight: 20 },
    { city: 'Delhi',        country: 'India',     lang: 'Hindi',     weight: 6  },
    { city: 'Gurgaon',      country: 'India',     lang: 'Hindi',     weight: 5  },
    { city: 'Noida',        country: 'India',     lang: 'Hindi',     weight: 4  },
    { city: 'Hyderabad',    country: 'India',     lang: 'Telugu',    weight: 10 },
    { city: 'Pune',         country: 'India',     lang: 'Marathi',   weight: 8  },
    { city: 'Chennai',      country: 'India',     lang: 'Tamil',     weight: 5  },
    { city: 'Singapore',    country: 'Singapore', lang: 'English',   weight: 5  },
    { city: 'Dubai',        country: 'UAE',       lang: 'English',   weight: 3  },
    { city: 'Abu Dhabi',    country: 'UAE',       lang: 'English',   weight: 2  },
    { city: 'London',       country: 'UK',        lang: 'English',   weight: 4  },
    { city: 'New York',     country: 'USA',       lang: 'English',   weight: 2  },
    { city: 'New Jersey',   country: 'USA',       lang: 'English',   weight: 1  },
];
const NRI_CITIES = ['Singapore', 'Dubai', 'Abu Dhabi', 'London', 'New York', 'New Jersey'];

// --- Names ---
const MALE_FIRST = [
    'Aarav', 'Arjun', 'Vivek', 'Rohan', 'Karan', 'Aditya', 'Siddharth', 'Rahul',
    'Nikhil', 'Ankit', 'Varun', 'Aman', 'Ishaan', 'Kabir', 'Dhruv', 'Yash',
    'Harsh', 'Manish', 'Sanjay', 'Pranav', 'Akshay', 'Gautam', 'Devansh', 'Raghav',
    'Tushar', 'Vikram', 'Aryan', 'Shaurya', 'Naveen', 'Rishabh', 'Sahil', 'Tarun',
    'Abhinav', 'Mayank', 'Parth', 'Kunal', 'Saurabh', 'Vishal', 'Anand', 'Rajat',
    'Imran', 'Zaid', 'Faizan', 'Daniel', 'Joel', 'Ryan', 'Gurpreet', 'Harman',
    'Jaspreet', 'Aniket', 'Shubham', 'Nitin', 'Aakash', 'Deepak',
];
const FEMALE_FIRST = [
    'Aanya', 'Ananya', 'Diya', 'Ishita', 'Kavya', 'Meera', 'Nisha', 'Priya',
    'Riya', 'Sneha', 'Tanvi', 'Aditi', 'Pooja', 'Neha', 'Shreya', 'Aishwarya',
    'Divya', 'Ria', 'Sakshi', 'Anjali', 'Swati', 'Megha', 'Pallavi', 'Richa',
    'Sanya', 'Tara', 'Naina', 'Ira', 'Mahima', 'Simran', 'Komal', 'Nidhi',
    'Vaishnavi', 'Sonal', 'Bhavna', 'Charvi', 'Prerna', 'Kriti', 'Anushka', 'Saloni',
    'Ayesha', 'Zoya', 'Sara', 'Maria', 'Grace', 'Emily', 'Harleen', 'Manpreet',
    'Gurleen', 'Aarohi', 'Trisha', 'Damini', 'Ruchi', 'Snehal',
];
const SURNAMES = [
    'Sharma', 'Verma', 'Gupta', 'Agarwal', 'Mehta', 'Shah', 'Patel', 'Reddy',
    'Nair', 'Menon', 'Iyer', 'Iyengar', 'Rao', 'Naidu', 'Kapoor', 'Khanna',
    'Malhotra', 'Chopra', 'Bhatia', 'Sethi', 'Bansal', 'Mittal', 'Jain', 'Goyal',
    'Singh', 'Kaur', 'Gill', 'Dhillon', 'Sandhu', 'Bedi', 'Chatterjee', 'Banerjee',
    'Mukherjee', 'Das', 'Bose', 'Ghosh', 'Deshpande', 'Joshi', 'Kulkarni', 'Patil',
    'Khan', 'Ahmed', 'Sayyed', 'Sheikh', 'Qureshi', 'Fernandes', 'D Souza', 'Pereira',
    'Thomas', 'Mathew', 'Pillai', 'Saxena', 'Trivedi', 'Chauhan', 'Yadav', 'Pandey',
    'Mishra', 'Dubey', 'Tiwari', 'Bhatt',
];

// --- Professions ---
const TECH_COMPANIES = [
    'Infosys', 'TCS', 'Wipro', 'Google', 'Microsoft', 'Amazon', 'Flipkart',
    'Razorpay', 'CRED', 'Zomato', 'Swiggy', 'PhonePe', 'Atlassian',
    'Goldman Sachs Tech', 'JP Morgan Tech',
];
const TECH_ROLES = ['Software Engineer', 'Senior Software Engineer', 'Tech Lead'];
const CONSULT_COMPANIES = ['McKinsey', 'BCG', 'Deloitte', 'EY', 'KPMG', 'Accenture'];
const CONSULT_ROLES = ['Consultant', 'Manager', 'Senior Manager'];
const BANK_COMPANIES = ['HDFC Bank', 'ICICI Bank', 'Kotak', 'Axis Bank', 'Goldman Sachs', 'Morgan Stanley', 'Citi'];
const BANK_ROLES = ['Associate', 'AVP', 'VP'];
const HOSPITALS = ['Apollo', 'Fortis', 'Max Healthcare', 'Manipal', 'AIIMS'];
const MALE_DOCTOR_ROLES = ['Doctor', 'Senior Resident', 'Consultant'];

// Female-specific pools
const MKT_COMPANIES = ['HUL', 'P&G', 'Nestlé', "L'Oréal", 'Marico', "Byju's", 'Nykaa', 'Meesho'];
const MKT_ROLES = ['Marketing Manager', 'Brand Manager', 'Senior Marketing Manager'];
const DESIGN_ROLES = ['UX Designer', 'Product Designer', 'Senior Designer'];
const MEDIA_COMPANIES = ['Times of India', 'Hindustan Times', 'NDTV', 'Vogue India', 'Condé Nast'];
const MEDIA_ROLES = ['Content Strategist', 'Journalist', 'Editor'];
const FEMALE_DOCTOR_ROLES = ['Doctor', 'Physiotherapist', 'Psychologist'];
const HR_COMPANIES = ['HUL', 'Accenture', 'Deloitte', 'Amazon', 'Microsoft', 'Capgemini'];
const HR_ROLES = ['HR Manager', 'HRBP', 'Talent Acquisition Lead'];
const ACADEMIC_INST = ['IIT Bombay', 'IIM Ahmedabad', 'Delhi University', 'BITS Pilani'];
const ACADEMIC_ROLES = ['Assistant Professor', 'Lecturer', 'Teacher'];
const LAW_FIRMS = ['AZB & Partners', 'Trilegal', 'Cyril Amarchand Mangaldas'];
const LAW_ROLES = ['Lawyer', 'Associate'];

// --- Education ---
const UG_COLLEGES = [
    'IIT Bombay', 'IIT Delhi', 'IIT Madras', 'BITS Pilani', 'NIT Warangal',
    'SRCC', 'LSR', 'Miranda House', 'Symbiosis', 'Christ University', 'VIT', 'Manipal',
];
const PG_COLLEGES = [
    'IIM Ahmedabad', 'IIM Bangalore', 'IIM Calcutta', 'XLRI', 'FMS Delhi',
    'ISB Hyderabad', 'BITS Pilani', 'IIT Bombay', 'London School of Economics',
    'NUS', 'NYU Stern', 'University of Michigan',
];
const UG_DEGREES = ['B.Tech', 'B.E.', 'B.Com', 'B.A.', 'B.Sc', 'BBA', 'MBBS', 'LLB'];
const PG_DEGREES = ['MBA', 'M.Tech', 'MS', 'MD', 'LLM', 'M.A.', 'M.Sc'];

// --- Hobbies (30+) ---
const HOBBIES = [
    'hiking and trekking', 'playing the guitar', 'reading literary fiction',
    'cooking and experimenting with cuisines', 'photography',
    'travelling to offbeat destinations', 'yoga and meditation',
    'running and half-marathons', 'watching documentaries', 'chess and strategy games',
    'sketching and watercolors', 'cycling', 'scuba diving', 'stand-up comedy',
    'theatre and improv', 'investing and personal finance', 'video games',
    'writing poetry', 'football (playing and watching)', 'cricket (playing and watching)',
    'tennis', 'dancing (Bharatanatyam / salsa / hip-hop)', 'volunteering and NGO work',
    'podcast listening (true crime, history, tech)', 'board games and D&D', 'baking',
    'learning new languages', 'astronomy and stargazing',
    'interior design and DIY home projects', 'music production', 'painting',
    'pottery and ceramics', 'wine tasting', 'birdwatching',
];

// --- Misc occupations for parents ---
const FATHER_OCC = [
    'Retired Government Officer', 'Businessman', 'Doctor', 'Bank Manager',
    'Chartered Accountant', 'Engineer', 'Professor', 'Army Officer (Retired)',
    'Civil Servant', 'Entrepreneur', 'Architect',
];
const MOTHER_OCC = [
    'Homemaker', 'Teacher', 'Doctor', 'Bank Employee', 'Government Officer',
    'Professor', 'Entrepreneur', 'Homemaker', 'Designer',
];

const COMPLEXIONS = ['Fair', 'Wheatish', 'Dark', 'Prefer not to say'];

// ===========================================================================
// RELIGION / CASTE
// ===========================================================================
function pickReligionCaste() {
    const religion = weightedRandom(
        ['Hindu', 'Muslim', 'Christian', 'Sikh', 'Jain', 'Other'],
        [68, 10, 8, 7, 5, 2]
    );
    let caste = null;
    let sub_caste = null;

    if (religion === 'Hindu') {
        caste = weightedRandom(
            ['Brahmin', 'Kshatriya', 'Vaishya', 'Kayastha', 'OBC'],
            [25, 15, 20, 15, 25]
        );
    } else if (religion === 'Sikh') {
        caste = randomFrom(['Jat Sikh', 'Khatri', 'Ramgarhia']);
    } else if (religion === 'Jain') {
        caste = randomFrom(['Digambar', 'Svetambar']);
    } else if (religion === 'Christian') {
        caste = randomFrom(['Roman Catholic', 'Protestant', 'Syrian Christian']);
    }
    // Muslim / Other -> caste & sub_caste left null
    return { religion, caste, sub_caste };
}

// ===========================================================================
// PROFESSION SELECTION
// ===========================================================================
function pickMaleProfession() {
    const bucket = weightedRandom(
        ['tech', 'consult', 'bank', 'doctor', 'ca', 'founder'],
        [45, 20, 17, 8, 5, 5]
    );
    switch (bucket) {
        case 'tech':    return { designation: randomFrom(TECH_ROLES),    company: randomFrom(TECH_COMPANIES) };
        case 'consult': return { designation: randomFrom(CONSULT_ROLES), company: randomFrom(CONSULT_COMPANIES) };
        case 'bank':    return { designation: randomFrom(BANK_ROLES),    company: randomFrom(BANK_COMPANIES) };
        case 'doctor':  return { designation: randomFrom(MALE_DOCTOR_ROLES), company: randomFrom(HOSPITALS) };
        case 'ca':      return { designation: randomFrom(['CA', 'Senior CA', 'Finance Manager']), company: randomFrom(['Independent Practice', 'Deloitte', 'EY', 'KPMG']) };
        case 'founder': return { designation: randomFrom(['Entrepreneur', 'Co-Founder', 'Founder']), company: randomFrom(['Early-stage Startup', 'Bootstrapped Venture', 'Series A Startup']) };
    }
}

function pickFemaleProfession() {
    const bucket = weightedRandom(
        ['tech', 'marketing', 'design', 'media', 'doctor', 'hr', 'academic', 'law'],
        [15, 18, 12, 10, 12, 13, 12, 8]
    );
    switch (bucket) {
        case 'tech':      return { designation: randomFrom(TECH_ROLES),   company: randomFrom(TECH_COMPANIES) };
        case 'marketing': return { designation: randomFrom(MKT_ROLES),    company: randomFrom(MKT_COMPANIES) };
        case 'design':    return { designation: randomFrom(DESIGN_ROLES), company: randomFrom(TECH_COMPANIES) };
        case 'media':     return { designation: randomFrom(MEDIA_ROLES),  company: randomFrom(MEDIA_COMPANIES) };
        case 'doctor':    return { designation: randomFrom(FEMALE_DOCTOR_ROLES), company: randomFrom(HOSPITALS) };
        case 'hr':        return { designation: randomFrom(HR_ROLES),     company: randomFrom(HR_COMPANIES) };
        case 'academic':  return { designation: randomFrom(ACADEMIC_ROLES), company: randomFrom(ACADEMIC_INST) };
        case 'law':       return { designation: randomFrom(LAW_ROLES),    company: randomFrom(LAW_FIRMS) };
    }
}

// ===========================================================================
// INCOME (INR), with NRI multiplier
// ===========================================================================
function baseIncome(age, gender) {
    let low, high;
    if (age <= 29)      { low = 800000;  high = 1800000; }   // Junior 27-29
    else if (age <= 33) { low = 1500000; high = 4000000; }   // Mid 30-33
    else                { low = 3000000; high = 8000000; }   // Senior 34-38

    let income = randomInt(low, high);
    // Female median slightly lower (intentional dataset realism).
    if (gender === 'Female') income = Math.round(income * 0.9);
    return income;
}

function applyNRIMultiplier(income, city) {
    if (NRI_CITIES.includes(city)) {
        const mult = 1.5 + Math.random() * 1.0; // 1.5x – 2.5x
        return Math.round(income * mult);
    }
    return income;
}

// ===========================================================================
// LANGUAGES
// ===========================================================================
function buildLanguages(cityData) {
    const langs = new Set();
    langs.add('English'); // everyone

    if (cityData.country === 'India') {
        if (cityData.city === 'Chennai') {
            langs.add('Tamil');
        } else {
            langs.add('Hindi');
            if (cityData.lang !== 'Hindi') langs.add(cityData.lang);
        }
    } else {
        // NRI: keep an Indian heritage language for realism
        langs.add('Hindi');
    }

    // 30% get a 3rd/extra language
    if (Math.random() < 0.30) {
        const extra = randomFrom(['Punjabi', 'Bengali', 'Gujarati', 'Telugu', 'Kannada', 'Malayalam', 'French', 'Spanish']);
        langs.add(extra);
    }
    return Array.from(langs);
}

// ===========================================================================
// EDUCATION
// ===========================================================================
function buildEducation() {
    const ug_college = randomFrom(UG_COLLEGES);
    const ug_degree = randomFrom(UG_DEGREES);
    const hasPG = Math.random() < 0.70; // 70% postgraduate
    return {
        ug_college,
        ug_degree,
        pg_college: hasPG ? randomFrom(PG_COLLEGES) : null,
        pg_degree:  hasPG ? randomFrom(PG_DEGREES)  : null,
    };
}

// ===========================================================================
// PARTNER PREFERENCES
// ===========================================================================
function buildPreferences(gender, age, income, cityData) {
    if (gender === 'Male') {
        return {
            pref_age_min: Math.max(22, age - 5),
            pref_age_max: age - 1,
            pref_height_min: 152,
            pref_income_min: Math.random() < 0.60 ? 0 : Math.round(income * 0.3),
            pref_caste_open: weightedRandom(['Open', 'Same Preferred', 'Same Only'], [50, 35, 15]),
            pref_city: cityData.city,
        };
    }
    // Female
    return {
        pref_age_min: age,
        pref_age_max: age + 7,
        pref_height_min: Math.random() < 0.80 ? 168 : 165,
        pref_income_min: Math.round(income * 0.8),
        pref_caste_open: weightedRandom(['Open', 'Same Preferred', 'Same Only'], [55, 30, 15]),
        pref_city: cityData.city,
    };
}

// ===========================================================================
// BUILD A SINGLE PROFILE
// ===========================================================================
function buildProfile(gender, index = 0) {
    const cityData = weightedRandom(CITY_DATA, CITY_DATA.map(c => c.weight));

    const dob = gender === 'Male' ? generateDOB(27, 38) : generateDOB(24, 35);
    const age = ageFromDOB(dob);

    const height = gender === 'Male'
        ? normalInt(173, 7, 165, 185)
        : normalInt(161, 6, 152, 170);

    let income = baseIncome(age, gender);
    income = applyNRIMultiplier(income, cityData.city);

    const profession = gender === 'Male' ? pickMaleProfession() : pickFemaleProfession();
    const education = buildEducation();
    const { religion, caste, sub_caste } = pickReligionCaste();
    const prefs = buildPreferences(gender, age, income, cityData);

    const firstName = gender === 'Male' ? randomFrom(MALE_FIRST) : randomFrom(FEMALE_FIRST);
    const lastName = randomFrom(SURNAMES);

    const hobbies = sampleDistinct(HOBBIES, randomInt(3, 5)).join(', ');

    return {
        is_dummy: true,
        matchmaker_id: null,
        first_name: firstName,
        last_name: lastName,
        gender,
        date_of_birth: dob,

        email: `${firstName}.${lastName}.${randomInt(100, 999)}@example.com`.toLowerCase().replace(/\s+/g, ''),
        phone: `+91${randomInt(70, 99)}${randomInt(10000000, 99999999)}`,
        city: cityData.city,
        country: cityData.country,

        height_cm: height,
        complexion: weightedRandom(COMPLEXIONS, [35, 45, 10, 10]),

        ug_college: education.ug_college,
        ug_degree: education.ug_degree,
        pg_college: education.pg_college,
        pg_degree: education.pg_degree,

        current_company: profession.company,
        designation: profession.designation,
        income_annual: income,

        marital_status: weightedRandom(
            ['Never Married', 'Divorced', 'Widowed', 'Separated'],
            [82, 12, 2, 4]
        ),
        father_occupation: randomFrom(FATHER_OCC),
        mother_occupation: randomFrom(MOTHER_OCC),
        siblings_brothers: weightedRandom([0, 1, 2], [45, 40, 15]),
        siblings_sisters: weightedRandom([0, 1, 2], [45, 40, 15]),
        family_type: weightedRandom(['Nuclear', 'Joint', 'Extended'], [55, 35, 10]),

        religion,
        caste,
        sub_caste,

        want_kids: weightedRandom(['Yes', 'Maybe', 'No'], [55, 30, 15]),
        open_to_relocate: weightedRandom(['Yes', 'Maybe', 'No'], [40, 35, 25]),
        open_to_pets: weightedRandom(['Yes', 'No', 'Maybe'], [35, 40, 25]),
        diet: weightedRandom(
            ['Vegetarian', 'Non-Vegetarian', 'Eggetarian', 'Vegan'],
            [40, 45, 12, 3]
        ),
        drink: weightedRandom(['Never', 'Socially', 'Regularly'], [35, 50, 15]),
        smoke: weightedRandom(['Never', 'Occasionally', 'Regularly'], [65, 25, 10]),
        languages: buildLanguages(cityData),
        hobbies,

        pref_age_min: prefs.pref_age_min,
        pref_age_max: prefs.pref_age_max,
        pref_height_min: prefs.pref_height_min,
        pref_income_min: prefs.pref_income_min,
        pref_caste_open: prefs.pref_caste_open,
        pref_city: prefs.pref_city,

        stage: 'Active - Searching',
        // Gender-appropriate demo portrait (randomuser.me has men/0-99 and
        // women/0-99). Gives every dummy profile a realistic avatar so match
        // cards never render a blank photo.
        photo_url: gender === 'Female'
            ? `https://randomuser.me/api/portraits/women/${index % 100}.jpg`
            : `https://randomuser.me/api/portraits/men/${index % 100}.jpg`,
    };
}

// ===========================================================================
// MAIN
// ===========================================================================
async function main() {
    console.log('TDC dummy profile seeder starting...');

    // Idempotency guard.
    const { count, error: countError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_dummy', true);

    if (countError) {
        console.error('✗ Failed to count existing dummy profiles:', countError.message);
        process.exit(1);
    }

    if ((count || 0) >= 240) {
        console.log('Dummy profiles already seeded. Skipping.');
        process.exit(0);
    }

    // Generate 120 male + 120 female.
    const profiles = [];
    for (let i = 0; i < 120; i++) profiles.push(buildProfile('Male', i));
    for (let i = 0; i < 120; i++) profiles.push(buildProfile('Female', i));

    const BATCH_SIZE = 20;
    const totalBatches = Math.ceil(profiles.length / BATCH_SIZE); // 12
    let inserted = 0;

    for (let b = 0; b < totalBatches; b++) {
        const start = b * BATCH_SIZE;
        const batch = profiles.slice(start, start + BATCH_SIZE);
        const from = start + 1;
        const to = start + batch.length;

        console.log(`Inserting batch ${b + 1}/${totalBatches} (profiles ${from}–${to})...`);

        const { error } = await supabase.from('profiles').insert(batch);
        if (error) {
            console.error(`✗ Insert failed on batch ${b + 1}:`, error.message);
            process.exit(1);
        }
        inserted += batch.length;
    }

    // Final summary.
    const males = profiles.filter(p => p.gender === 'Male').length;
    const females = profiles.filter(p => p.gender === 'Female').length;
    console.log('');
    console.log(`✓ Seeded 240 dummy profiles successfully`);
    console.log(`  Total inserted: ${inserted}`);
    console.log(`  Male:   ${males}`);
    console.log(`  Female: ${females}`);
    console.log(`  All: is_dummy=true, matchmaker_id=null, stage='Active - Searching'`);
    process.exit(0);
}

main().catch((err) => {
    console.error('✗ Unexpected error:', err);
    process.exit(1);
});
