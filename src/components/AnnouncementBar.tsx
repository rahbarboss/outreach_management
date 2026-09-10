import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Megaphone } from 'lucide-react';
import { Announcement } from '../types';

interface Props {
  announcements: Announcement[];
}

export const AnnouncementBar: React.FC<Props> = ({ announcements }) => {
  const activeAnnouncements = announcements.filter(a => a.isActive).sort((a, b) => a.displayOrder - b.displayOrder);

  if (activeAnnouncements.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white overflow-hidden relative border-b border-blue-800/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center">
        <div className="flex items-center gap-2 shrink-0 mr-4 z-10 bg-inherit pr-2">
          <Megaphone className="w-4 h-4 text-amber-300 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-blue-100 hidden sm:inline-block">Update</span>
        </div>
        
        <div className="flex-1 relative h-5 overflow-hidden flex items-center">
          <motion.div
            animate={{ x: ["100%", "-100%"] }}
            transition={{
              repeat: Infinity,
              duration: Math.max(15, activeAnnouncements.length * 10),
              ease: "linear",
            }}
            className="absolute whitespace-nowrap flex gap-12 text-sm font-medium"
          >
            {activeAnnouncements.map((ann, idx) => (
              <span key={ann.id || idx} className="inline-flex items-center gap-2">
                {ann.message}
                {ann.link && (
                  <a href={ann.link} target="_blank" rel="noopener noreferrer" className="underline text-amber-200 hover:text-white transition-colors">
                    Learn More
                  </a>
                )}
                {idx !== activeAnnouncements.length - 1 && <span className="text-blue-400 mx-4">•</span>}
              </span>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
};
