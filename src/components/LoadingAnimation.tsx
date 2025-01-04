import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

export function LoadingAnimation() {
  return (
    <div className="flex flex-col items-center justify-center p-8">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      >
        <Sparkles className="w-8 h-8 text-blue-500" />
      </motion.div>
      <p className="mt-4 text-gray-600">Generating your designs...</p>
    </div>
  );
} 