import { motion } from 'framer-motion'
import { formatNoteDate } from '../../utils/formatters'

export default function NotesList({ notes = [] }) {
  if (!notes.length) {
    return (
      <div>
        <p className="font-playfair text-lg italic text-[#6C6863]">
          No notes have been recorded for this client.
        </p>
        <p className="mt-2 font-inter text-xs uppercase tracking-[0.2em] text-[#6C6863]/60">
          Add the first note below
        </p>
      </div>
    )
  }

  return (
    <div>
      {notes.map((note) => (
        <motion.div
          key={note.id}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="mb-5 border-l-2 border-[#1A1A1A]/15 pl-4 transition-colors duration-500 hover:border-[#D4AF37]"
        >
          <p className="font-inter text-[11px] uppercase tracking-[0.2em] text-[#6C6863]">
            {formatNoteDate(note.created_at)}
          </p>
          <p className="mt-1 font-inter text-sm leading-relaxed text-[#1A1A1A]">
            {note.content}
          </p>
        </motion.div>
      ))}
    </div>
  )
}
