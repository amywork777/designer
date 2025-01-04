'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const loadingStates = [
  {
    icon: "✨",
    text: "Analyzing your request..."
  },
  {
    icon: "🎨",
    text: "Creating your vision..."
  },
  {
    icon: "⚡",
    text: "Enhancing details..."
  },
  {
    icon: "✅",
    text: "Finalizing your image..."
  }
];

interface LoadingScreenProps {
  onComplete?: () => void;
}

export function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [currentState, setCurrentState] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentState((prev) => {
        if (prev === 3) {
          if (onComplete) onComplete();
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 2000); // Change state every 2 seconds

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div className="flex items-center justify-center min-h-[200px] w-full bg-white rounded-xl shadow-lg p-8">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentState}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-4xl mb-4"
          >
            {loadingStates[currentState].icon}
          </motion.div>
          <p className="text-gray-700 text-lg">
            {loadingStates[currentState].text}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
} 