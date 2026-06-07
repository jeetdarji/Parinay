import { motion } from 'framer-motion'
import SectionBlock, { Field } from './SectionBlock'
import { formatHeightCm, formatIncome } from '../../utils/formatters'

// Read-only biodata display. All 35+ fields grouped into editorial sections.
export default function ProfileCard({ client }) {
  if (!client) return null

  const langs = Array.isArray(client.languages)
    ? client.languages.join(', ')
    : client.languages

  const ug =
    client.ug_degree || client.ug_college
      ? [client.ug_degree, client.ug_college].filter(Boolean).join(', ')
      : null
  const pg =
    client.pg_degree || client.pg_college
      ? [client.pg_degree, client.pg_college].filter(Boolean).join(', ')
      : null

  const siblings = (() => {
    const b = client.siblings_brothers || 0
    const s = client.siblings_sisters || 0
    if (b === 0 && s === 0) return 'No siblings listed'
    const parts = []
    if (b) parts.push(`${b} brother${b === 1 ? '' : 's'}`)
    if (s) parts.push(`${s} sister${s === 1 ? '' : 's'}`)
    return parts.join(', ')
  })()

  const ageRange =
    client.pref_age_min || client.pref_age_max
      ? `${client.pref_age_min ?? '—'} – ${client.pref_age_max ?? '—'} yrs`
      : null

  const sections = [
    {
      title: 'Personal',
      fields: [
        ['Date of Birth', client.date_of_birth],
        ['Age', client.age],
        ['Gender', client.gender],
        ['Country', client.country],
        ['Languages', langs],
      ],
    },
    {
      title: 'Contact',
      fields: [
        ['Email', client.email],
        ['Phone', client.phone],
      ],
    },
    {
      title: 'Physical',
      fields: [
        ['Height', client.height_cm ? formatHeightCm(client.height_cm) : null],
        ['Complexion', client.complexion],
      ],
    },
    {
      title: 'Education',
      fields: [
        ['Undergraduate', ug],
        ['Postgraduate', pg],
      ],
    },
    {
      title: 'Career',
      fields: [
        ['Designation', client.designation],
        ['Company', client.current_company],
        ['Annual Income', client.income_annual ? formatIncome(client.income_annual) : null],
      ],
    },
    {
      title: 'Family',
      fields: [
        ['Marital Status', client.marital_status],
        ['Family Type', client.family_type],
        ["Father's Occupation", client.father_occupation],
        ["Mother's Occupation", client.mother_occupation],
        ['Siblings', siblings],
      ],
    },
    {
      title: 'Religion',
      fields: [
        ['Religion', client.religion],
        ['Caste', client.caste],
        ['Sub-caste', client.sub_caste],
        ['Caste Preference', client.pref_caste_open],
      ],
    },
    {
      title: 'Lifestyle',
      fields: [
        ['Want Kids', client.want_kids],
        ['Open to Relocate', client.open_to_relocate],
        ['Open to Pets', client.open_to_pets],
        ['Diet', client.diet],
        ['Drink', client.drink],
        ['Smoke', client.smoke],
        ['Hobbies', client.hobbies],
      ],
    },
    {
      title: 'Partner Preferences',
      fields: [
        ['Age Range', ageRange],
        ['Min Height', client.pref_height_min ? formatHeightCm(client.pref_height_min) : null],
        ['Min Income', client.pref_income_min ? formatIncome(client.pref_income_min) : null],
        ['City Preference', client.pref_city],
        ['Caste Openness', client.pref_caste_open],
      ],
    },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      {/* Identity block */}
      <div className="mb-8">
        <h2 className="font-playfair text-3xl text-[#1A1A1A]">
          {client.first_name} {client.last_name}
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-2 font-inter text-sm text-[#6C6863]">
          {client.age && <span>{client.age}</span>}
          {client.age && client.city && <span>·</span>}
          {client.city && <span>{client.city}</span>}
          {client.city && client.marital_status && <span>·</span>}
          {client.marital_status && <span>{client.marital_status}</span>}
        </div>
        <div className="mt-4 h-px w-12 bg-[#D4AF37]" />
      </div>

      {sections.map((section, index) => (
        <motion.div
          key={section.title}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: index * 0.08, ease: 'easeOut' }}
        >
          <SectionBlock title={section.title}>
            {section.fields.map(([label, value]) => (
              <Field key={label} label={label} value={value} />
            ))}
          </SectionBlock>
        </motion.div>
      ))}
    </motion.div>
  )
}
