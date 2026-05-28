'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
import { motion } from 'framer-motion';

interface TotoroProps {
  typingPulse: number;
  passwordLength: number;
  showPassword: boolean;
  isPasswordFocused: boolean;
}

export function TotoroIllustration({
  typingPulse,
  passwordLength,
  showPassword,
  isPasswordFocused,
}: TotoroProps) {
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isTypingNormal, setIsTypingNormal] = useState(false);
  const typingTimer = useRef<number>(0);

  useEffect(() => {
    setMouseX(window.innerWidth / 2);
    setMouseY(window.innerHeight * 2);

    const handleMouseMove = (e: MouseEvent) => {
      setMouseX(e.clientX);
      setMouseY(e.clientY);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    if (typingPulse > 0) {
      clearTimeout(typingTimer.current);
      setIsTypingNormal(true);
      typingTimer.current = window.setTimeout(() => {
        setIsTypingNormal(false);
      }, 800);
    }
  }, [typingPulse]);

  const getPupilOffset = () => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = mouseX - centerX;
    const dy = mouseY - centerY;
    
    return {
      x: Math.max(-8, Math.min(8, dx / 25)),
      y: Math.max(-6, Math.min(6, dy / 25)),
    };
  };

  const [isBlinking, setIsBlinking] = useState(false);
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const scheduleNextBlink = () => {
      const nextBlinkTime = Math.random() * 3000 + 3000;
      timeoutId = setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => setIsBlinking(false), 150);
        scheduleNextBlink();
      }, nextBlinkTime);
    };
    scheduleNextBlink();
    return () => clearTimeout(timeoutId);
  }, []);

  const [isEntering, setIsEntering] = useState(true);
  useEffect(() => {
    const enterTimer = setTimeout(() => setIsEntering(false), 500);
    return () => clearTimeout(enterTimer);
  }, []);

  const pupilOffset = getPupilOffset();

  const isHiding = !isEntering && isPasswordFocused && !showPassword;
  const isPeeking = !isEntering && !isHiding && isTypingNormal;
  const isIdle = !isEntering && !isHiding && !isPeeking;

  return (
    <div 
      ref={containerRef}
      className="relative w-[320px] h-[140px] pointer-events-none mx-auto"
    >
      <div className="absolute bottom-[10px] w-full h-[300px] overflow-hidden">
        <motion.div 
          className="absolute bottom-0 left-1/2 w-[220px] h-[160px] origin-bottom"
          initial={{ x: '-50%', y: 160, opacity: 0, scaleY: 1.1, scaleX: 0.9 }}
          animate={{
            x: '-50%',
            y: isEntering ? 160 : isHiding ? 70 : isPeeking ? 15 : 30,
            scaleY: isEntering ? 1.1 : isHiding ? 0.95 : isPeeking ? 1.05 : 1,
            scaleX: isEntering ? 0.9 : isHiding ? 1.05 : isPeeking ? 0.95 : 1,
            opacity: isEntering ? 0 : 1
          }}
          transition={{
            type: "spring",
            stiffness: 220,
            damping: 15,
            mass: 0.8
          }}
        >
          <motion.div 
            className="absolute -top-[10px] left-[35px] w-[26px] h-[60px] bg-slate-400 rounded-[50%_50%_10%_10%] origin-bottom"
            initial={{ rotate: -25, x: 0, y: 0 }}
            animate={{
              rotate: isHiding ? -60 : isPeeking ? -10 : -25,
              x: isHiding ? -8 : 0,
              y: isHiding ? 8 : 0
            }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
          />
          <motion.div 
            className="absolute -top-[10px] right-[35px] w-[26px] h-[60px] bg-slate-400 rounded-[50%_50%_10%_10%] origin-bottom"
            initial={{ rotate: 25, x: 0, y: 0 }}
            animate={{
              rotate: isHiding ? 60 : isPeeking ? 10 : 25,
              x: isHiding ? 8 : 0,
              y: isHiding ? 8 : 0
            }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
          />

          <motion.div 
            className="absolute bottom-0 left-1/2 w-[280px] h-[160px] bg-slate-400 rounded-[140px_140px_40px_40px] z-10 overflow-hidden origin-bottom"
            style={{ 
              boxShadow: 'inset 0 15px 25px rgba(255,255,255,0.1)',
            }}
            initial={{ x: '-50%' }}
            animate={{
              x: '-50%',
              scaleX: isIdle ? [1, 1.02, 1] : 1,
              scaleY: isIdle ? [1, 0.98, 1] : 1
            }}
            transition={{
              x: { duration: 0 },
              scaleX: { repeat: Infinity, duration: 4, ease: "easeInOut" },
              scaleY: { repeat: Infinity, duration: 4, ease: "easeInOut" }
            }}
          >
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[160px] h-[70px] bg-slate-50 rounded-[80px_80px_0_0]">
               <div className="absolute top-[20px] left-1/2 -translate-x-1/2 flex gap-5">
                  <div className="w-[12px] h-[12px] border-t-[3px] border-l-[3px] border-slate-400 rotate-45 rounded-sm" />
                  <div className="w-[12px] h-[12px] border-t-[3px] border-l-[3px] border-slate-400 rotate-45 rounded-sm" />
                  <div className="w-[12px] h-[12px] border-t-[3px] border-l-[3px] border-slate-400 rotate-45 rounded-sm" />
               </div>
            </div>

            <motion.div 
              className="absolute top-0 left-0 w-full h-full"
              initial={{ y: 0 }}
              animate={{ y: isPeeking ? 12 : isHiding ? -4 : 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
            >
              <div className="absolute top-[50px] left-1/2 -translate-x-1/2 w-[140px] h-[44px] flex justify-between px-[15px]">
                <div className="relative w-[44px] h-[44px] bg-white rounded-full flex items-center justify-center shadow-sm overflow-hidden">
                  <motion.div 
                    className="w-full h-full bg-slate-300 absolute top-0 left-0 origin-top"
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: (isHiding || isBlinking) ? 1 : 0 }}
                    transition={{ duration: isBlinking ? 0.05 : 0.25, ease: "easeInOut" }}
                  />
                  {!isHiding && !isBlinking && (
                    <motion.div 
                      className="w-[16px] h-[16px] bg-[#2D2D2D] rounded-full"
                      animate={{
                        x: pupilOffset.x,
                        y: pupilOffset.y,
                        scale: isPeeking ? 1.1 : 1
                      }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    />
                  )}
                  {isHiding && (
                    <div className="absolute top-1/2 -translate-y-1/2 w-[20px] h-[4px] bg-[#2D2D2D] rounded-full z-10" />
                  )}
                </div>
                
                <div className="relative w-[44px] h-[44px] bg-white rounded-full flex items-center justify-center shadow-sm overflow-hidden">
                  <motion.div 
                    className="w-full h-full bg-slate-300 absolute top-0 left-0 origin-top"
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: (isHiding || isBlinking) ? 1 : 0 }}
                    transition={{ duration: isBlinking ? 0.05 : 0.25, ease: "easeInOut" }}
                  />
                  {!isHiding && !isBlinking && (
                    <motion.div 
                      className="w-[16px] h-[16px] bg-[#2D2D2D] rounded-full"
                      animate={{
                        x: pupilOffset.x,
                        y: pupilOffset.y,
                        scale: isPeeking ? 1.1 : 1
                      }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    />
                  )}
                  {isHiding && (
                    <div className="absolute top-1/2 -translate-y-1/2 w-[20px] h-[4px] bg-[#2D2D2D] rounded-full z-10" />
                  )}
                </div>
              </div>

              <div className="absolute top-[80px] left-1/2 -translate-x-1/2 w-[16px] h-[10px] bg-[#2D2D2D] rounded-[50%_50%_40%_40%]" />
            </motion.div>
          </motion.div>
        </motion.div>
      </div>

      <motion.div 
        className="absolute w-full h-full top-0 left-0 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: isEntering ? 0 : 1 }}
        transition={{ duration: 0.3 }}
      >
        <motion.div 
          className="absolute bottom-0 left-0 w-[32px] h-[46px] bg-slate-300 rounded-[16px] shadow-md origin-bottom z-40"
          initial={{ y: 60, x: 50, rotate: -20 }}
          animate={{
            y: isEntering ? 60 : isHiding ? -20 : 5,
            x: isHiding ? 75 : 50,
            rotate: isHiding ? 50 : -20,
            scaleY: isHiding ? 1.2 : 1
          }}
          transition={{ type: "spring", stiffness: 220, damping: 15 }}
        />
        
        <motion.div 
          className="absolute bottom-0 right-0 w-[32px] h-[46px] bg-slate-300 rounded-[16px] shadow-md origin-bottom z-40"
          initial={{ y: 60, x: -50, rotate: 20 }}
          animate={{
            y: isEntering ? 60 : isHiding ? -20 : 5,
            x: isHiding ? -75 : -50,
            rotate: isHiding ? -50 : 20,
            scaleY: isHiding ? 1.2 : 1
          }}
          transition={{ type: "spring", stiffness: 220, damping: 15 }}
        />
      </motion.div>
    </div>
  );
}
