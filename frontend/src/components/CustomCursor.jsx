import { useEffect, useState } from 'react';
import { motion, useMotionValue } from 'framer-motion';

function CustomCursor() {
  const [isPointer, setIsPointer] = useState(false);
  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);

  useEffect(() => {
    const moveCursor = (e) => {
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);

      const target = e.target;
      const isClickable =
        target.tagName === 'BUTTON' ||
        target.tagName === 'A' ||
        target.closest('button') ||
        target.closest('a') ||
        target.style.cursor === 'pointer';

      setIsPointer(isClickable);
    };

    window.addEventListener('mousemove', moveCursor);
    return () => window.removeEventListener('mousemove', moveCursor);
  }, [cursorX, cursorY]);

  return (
    <>
      <style>{`
        * {
          cursor: none !important;
        }
      `}</style>

      {/* All circles share the same center point as the cursor */}
      <motion.div
        className="pointer-events-none fixed z-[9999]"
        style={{
          left: 0,
          top: 0,
          x: cursorX,
          y: cursorY,
        }}
      >
        {/* Largest glow circle - REDUCED OPACITY */}
        <motion.div
          className="absolute"
          style={{
            width: '300px',
            height: '300px',
            left: '-150px',
            top: '-150px',
          }}
          animate={{
            scale: isPointer ? 1.2 : 1,
          }}
          transition={{ duration: 0.3 }}
        >
          <div
            className="w-full h-full rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(255,68,0,0.12) 0%, rgba(255,68,0,0.08) 40%, rgba(255,68,0,0.04) 70%, transparent 100%)',
              filter: 'blur(50px)',
            }}
          />
        </motion.div>

        {/* Medium glow circle - REDUCED OPACITY */}
        <motion.div
          className="absolute"
          style={{
            width: '180px',
            height: '180px',
            left: '-90px',
            top: '-90px',
          }}
          animate={{
            scale: isPointer ? 1.15 : 1,
          }}
          transition={{ duration: 0.3 }}
        >
          <div
            className="w-full h-full rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(255,68,0,0.2) 0%, rgba(255,68,0,0.12) 50%, rgba(255,68,0,0.05) 80%, transparent 100%)',
              filter: 'blur(30px)',
            }}
          />
        </motion.div>

        {/* Small glow circle - REDUCED OPACITY */}
        <motion.div
          className="absolute"
          style={{
            width: '80px',
            height: '80px',
            left: '-40px',
            top: '-40px',
          }}
          animate={{
            scale: isPointer ? 1.1 : 1,
          }}
          transition={{ duration: 0.2 }}
        >
          <div
            className="w-full h-full rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(255,68,0,0.3) 0%, rgba(255,68,0,0.18) 60%, transparent 100%)',
              filter: 'blur(15px)',
            }}
          />
        </motion.div>

        {/* The pointer itself - 6px radius (12px diameter) */}
        <motion.div
          className="absolute"
          style={{
            width: '12px',
            height: '12px',
            left: '-6px',
            top: '-6px',
          }}
          animate={{
            scale: isPointer ? 1.5 : 1,
          }}
          transition={{ duration: 0.2 }}
        >
          <div
            className="w-full h-full rounded-full bg-red-500"
            style={{
              boxShadow: '0 0 10px rgba(255,68,0,1), 0 0 20px rgba(255,68,0,0.8), 0 0 30px rgba(255,68,0,0.5)',
            }}
          />
        </motion.div>
      </motion.div>
    </>
  );
}

export default CustomCursor;
