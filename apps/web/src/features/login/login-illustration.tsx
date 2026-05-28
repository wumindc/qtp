'use client';

/**
 * 登录页左侧交互式插画组件
 * 基于 marker964/animated-characters-login-page 移植，实现眼珠跟随鼠标、打字对视、闭眼等逻辑
 * @author Antigravity / Gemini 3.1 Pro
 */

import { useState, useEffect, useRef } from 'react';
import { Zap } from 'lucide-react';

type EyeBallProps = {
  size?: number;
  pupilSize?: number;
  maxDistance?: number;
  eyeColor?: string;
  pupilColor?: string;
  isBlinking?: boolean;
  forceLookX?: number;
  forceLookY?: number;
  mouseX: number;
  mouseY: number;
};

function EyeBall({
  size = 48,
  pupilSize = 16,
  maxDistance = 10,
  eyeColor = 'white',
  pupilColor = 'black',
  isBlinking = false,
  forceLookX,
  forceLookY,
  mouseX,
  mouseY,
}: EyeBallProps) {
  const eyeRef = useRef<HTMLDivElement>(null);

  const getPupilPosition = () => {
    if (forceLookX !== undefined && forceLookY !== undefined) {
      return { x: forceLookX, y: forceLookY };
    }
    if (!eyeRef.current) return { x: 0, y: 0 };

    const rect = eyeRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = mouseX - centerX;
    const deltaY = mouseY - centerY;
    const distance = Math.min(Math.sqrt(deltaX ** 2 + deltaY ** 2), maxDistance);
    const angle = Math.atan2(deltaY, deltaX);

    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
    };
  };

  const pos = getPupilPosition();

  return (
    <div
      ref={eyeRef}
      className="rounded-full flex items-center justify-center transition-all duration-150"
      style={{
        width: `${size}px`,
        height: isBlinking ? '2px' : `${size}px`,
        backgroundColor: eyeColor,
        overflow: 'hidden',
      }}
    >
      {!isBlinking && (
        <div
          className="rounded-full"
          style={{
            width: `${pupilSize}px`,
            height: `${pupilSize}px`,
            backgroundColor: pupilColor,
            transform: `translate(${pos.x}px, ${pos.y}px)`,
            transition: 'transform 0.1s ease-out',
          }}
        />
      )}
    </div>
  );
}

type PupilProps = {
  size?: number;
  maxDistance?: number;
  pupilColor?: string;
  forceLookX?: number;
  forceLookY?: number;
  mouseX: number;
  mouseY: number;
};

function Pupil({
  size = 12,
  maxDistance = 5,
  pupilColor = 'black',
  forceLookX,
  forceLookY,
  mouseX,
  mouseY,
}: PupilProps) {
  const pupilRef = useRef<HTMLDivElement>(null);

  const getPupilPosition = () => {
    if (forceLookX !== undefined && forceLookY !== undefined) {
      return { x: forceLookX, y: forceLookY };
    }
    if (!pupilRef.current) return { x: 0, y: 0 };

    const rect = pupilRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = mouseX - centerX;
    const deltaY = mouseY - centerY;
    const distance = Math.min(Math.sqrt(deltaX ** 2 + deltaY ** 2), maxDistance);
    const angle = Math.atan2(deltaY, deltaX);

    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
    };
  };

  const pos = getPupilPosition();

  return (
    <div
      ref={pupilRef}
      className="rounded-full"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: pupilColor,
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        transition: 'transform 0.1s ease-out',
      }}
    />
  );
}

export function LoginIllustration({
  typingPulse,
  showPassword,
  passwordLength,
}: {
  typingPulse: number;
  showPassword: boolean;
  passwordLength: number;
}) {
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const [isPurpleBlinking, setIsPurpleBlinking] = useState(false);
  const [isBlackBlinking, setIsBlackBlinking] = useState(false);
  const [isLookingAtEachOther, setIsLookingAtEachOther] = useState(false);
  const [isPurplePeeking, setIsPurplePeeking] = useState(false);

  const purpleRef = useRef<HTMLDivElement>(null);
  const blackRef = useRef<HTMLDivElement>(null);
  const yellowRef = useRef<HTMLDivElement>(null);
  const orangeRef = useRef<HTMLDivElement>(null);

  const activeTimers = useRef(new Set<number>());

  useEffect(() => {
    // 初始状态让小怪物们往下看，适配移动端“趴在卡片上往下看”的效果
    setMouseX(window.innerWidth / 2);
    setMouseY(window.innerHeight * 2);

    const handleMouseMove = (e: MouseEvent) => {
      setMouseX(e.clientX);
      setMouseY(e.clientY);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const trackTimeout = (callback: () => void, delay: number) => {
    const id = window.setTimeout(() => {
      activeTimers.current.delete(id);
      callback();
    }, delay);
    activeTimers.current.add(id);
    return id;
  };

  const clearTrackedTimeout = (id: number) => {
    clearTimeout(id);
    activeTimers.current.delete(id);
  };

  useEffect(() => {
    const randomBlink = () => Math.random() * 4000 + 3000;

    let purpleTimer: number;
    const startPurpleBlink = () => {
      purpleTimer = trackTimeout(() => {
        setIsPurpleBlinking(true);
        trackTimeout(() => {
          setIsPurpleBlinking(false);
          startPurpleBlink();
        }, 150);
      }, randomBlink());
    };
    startPurpleBlink();

    let blackTimer: number;
    const startBlackBlink = () => {
      blackTimer = trackTimeout(() => {
        setIsBlackBlinking(true);
        trackTimeout(() => {
          setIsBlackBlinking(false);
          startBlackBlink();
        }, 150);
      }, randomBlink());
    };
    startBlackBlink();

    return () => {
      activeTimers.current.forEach(clearTimeout);
      activeTimers.current.clear();
    };
  }, []);

  const typingTimer = useRef(0);
  useEffect(() => {
    if (typingPulse > 0) {
      clearTrackedTimeout(typingTimer.current);
      setIsLookingAtEachOther(true);
      typingTimer.current = trackTimeout(() => {
        setIsLookingAtEachOther(false);
      }, 800);
    }
  }, [typingPulse]);

  const peekTimer = useRef(0);
  useEffect(() => {
    clearTrackedTimeout(peekTimer.current);
    if (passwordLength > 0 && showPassword) {
      const schedulePeek = () => {
        peekTimer.current = trackTimeout(() => {
          setIsPurplePeeking(true);
          trackTimeout(() => {
            setIsPurplePeeking(false);
            schedulePeek();
          }, 800);
        }, Math.random() * 3000 + 2000);
      };
      schedulePeek();
    } else {
      setIsPurplePeeking(false);
    }
  }, [passwordLength, showPassword]);

  const calculatePosition = (elRef: React.RefObject<HTMLDivElement | null>) => {
    if (!elRef.current) return { faceX: 0, faceY: 0, bodySkew: 0 };
    const rect = elRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 3;
    const deltaX = mouseX - centerX;
    const deltaY = mouseY - centerY;

    return {
      faceX: Math.max(-15, Math.min(15, deltaX / 20)),
      faceY: Math.max(-10, Math.min(10, deltaY / 30)),
      bodySkew: Math.max(-6, Math.min(6, -deltaX / 120)),
    };
  };

  const purplePos = calculatePosition(purpleRef);
  const blackPos = calculatePosition(blackRef);
  const yellowPos = calculatePosition(yellowRef);
  const orangePos = calculatePosition(orangeRef);

  const isHidingPassword = passwordLength > 0 && !showPassword;
  const isTyping = typingPulse > 0 && isLookingAtEachOther;

  return (
    <div className="relative pointer-events-none" style={{ width: '550px', height: '400px' }}>
      {/* Purple */}
      <div
        ref={purpleRef}
        className="absolute bottom-0 transition-all duration-700 ease-in-out"
        style={{
          left: '70px',
          width: '180px',
          height: isTyping || isHidingPassword ? '440px' : '400px',
          backgroundColor: '#6C3FF5',
          borderRadius: '10px 10px 0 0',
          zIndex: 1,
          transform: passwordLength > 0 && showPassword
            ? 'skewX(0deg)'
            : isTyping || isHidingPassword
              ? `skewX(${purplePos.bodySkew - 12}deg) translateX(40px)`
              : `skewX(${purplePos.bodySkew}deg)`,
          transformOrigin: 'bottom center',
        }}
      >
        <div
          className="absolute flex gap-8 transition-all duration-700 ease-in-out"
          style={{
            left: passwordLength > 0 && showPassword ? '20px' : isLookingAtEachOther ? '55px' : `${45 + purplePos.faceX}px`,
            top: passwordLength > 0 && showPassword ? '35px' : isLookingAtEachOther ? '65px' : `${40 + purplePos.faceY}px`,
          }}
        >
          <EyeBall size={18} pupilSize={7} maxDistance={5} pupilColor="#2D2D2D" mouseX={mouseX} mouseY={mouseY} isBlinking={isPurpleBlinking} forceLookX={passwordLength > 0 && showPassword ? (isPurplePeeking ? 4 : -4) : isLookingAtEachOther ? 3 : undefined} forceLookY={passwordLength > 0 && showPassword ? (isPurplePeeking ? 5 : -4) : isLookingAtEachOther ? 4 : undefined} />
          <EyeBall size={18} pupilSize={7} maxDistance={5} pupilColor="#2D2D2D" mouseX={mouseX} mouseY={mouseY} isBlinking={isPurpleBlinking} forceLookX={passwordLength > 0 && showPassword ? (isPurplePeeking ? 4 : -4) : isLookingAtEachOther ? 3 : undefined} forceLookY={passwordLength > 0 && showPassword ? (isPurplePeeking ? 5 : -4) : isLookingAtEachOther ? 4 : undefined} />
        </div>
      </div>

      {/* Black */}
      <div
        ref={blackRef}
        className="absolute bottom-0 transition-all duration-700 ease-in-out"
        style={{
          left: '240px',
          width: '120px',
          height: '310px',
          backgroundColor: '#2D2D2D',
          borderRadius: '8px 8px 0 0',
          zIndex: 2,
          transform: passwordLength > 0 && showPassword
            ? 'skewX(0deg)'
            : isLookingAtEachOther
              ? `skewX(${blackPos.bodySkew * 1.5 + 10}deg) translateX(20px)`
              : isTyping || isHidingPassword
                ? `skewX(${blackPos.bodySkew * 1.5}deg)`
                : `skewX(${blackPos.bodySkew}deg)`,
          transformOrigin: 'bottom center',
        }}
      >
        <div
          className="absolute flex gap-6 transition-all duration-700 ease-in-out"
          style={{
            left: passwordLength > 0 && showPassword ? '10px' : isLookingAtEachOther ? '32px' : `${26 + blackPos.faceX}px`,
            top: passwordLength > 0 && showPassword ? '28px' : isLookingAtEachOther ? '12px' : `${32 + blackPos.faceY}px`,
          }}
        >
          <EyeBall size={16} pupilSize={6} maxDistance={4} pupilColor="#2D2D2D" mouseX={mouseX} mouseY={mouseY} isBlinking={isBlackBlinking} forceLookX={passwordLength > 0 && showPassword ? -4 : isLookingAtEachOther ? 0 : undefined} forceLookY={passwordLength > 0 && showPassword ? -4 : isLookingAtEachOther ? -4 : undefined} />
          <EyeBall size={16} pupilSize={6} maxDistance={4} pupilColor="#2D2D2D" mouseX={mouseX} mouseY={mouseY} isBlinking={isBlackBlinking} forceLookX={passwordLength > 0 && showPassword ? -4 : isLookingAtEachOther ? 0 : undefined} forceLookY={passwordLength > 0 && showPassword ? -4 : isLookingAtEachOther ? -4 : undefined} />
        </div>
      </div>

      {/* Orange */}
      <div
        ref={orangeRef}
        className="absolute bottom-0 transition-all duration-700 ease-in-out"
        style={{
          left: '0px',
          width: '240px',
          height: '200px',
          zIndex: 3,
          backgroundColor: '#FF9B6B',
          borderRadius: '120px 120px 0 0',
          transform: passwordLength > 0 && showPassword ? 'skewX(0deg)' : `skewX(${orangePos.bodySkew}deg)`,
          transformOrigin: 'bottom center',
        }}
      >
        <div
          className="absolute flex gap-8 transition-all duration-200 ease-out"
          style={{
            left: passwordLength > 0 && showPassword ? '50px' : `${82 + orangePos.faceX}px`,
            top: passwordLength > 0 && showPassword ? '85px' : `${90 + orangePos.faceY}px`,
          }}
        >
          <Pupil size={12} maxDistance={5} pupilColor="#2D2D2D" mouseX={mouseX} mouseY={mouseY} forceLookX={passwordLength > 0 && showPassword ? -5 : undefined} forceLookY={passwordLength > 0 && showPassword ? -4 : undefined} />
          <Pupil size={12} maxDistance={5} pupilColor="#2D2D2D" mouseX={mouseX} mouseY={mouseY} forceLookX={passwordLength > 0 && showPassword ? -5 : undefined} forceLookY={passwordLength > 0 && showPassword ? -4 : undefined} />
        </div>
      </div>

      {/* Yellow */}
      <div
        ref={yellowRef}
        className="absolute bottom-0 transition-all duration-700 ease-in-out"
        style={{
          left: '310px',
          width: '140px',
          height: '230px',
          backgroundColor: '#E8D754',
          borderRadius: '70px 70px 0 0',
          zIndex: 4,
          transform: passwordLength > 0 && showPassword ? 'skewX(0deg)' : `skewX(${yellowPos.bodySkew}deg)`,
          transformOrigin: 'bottom center',
        }}
      >
        <div
          className="absolute flex gap-6 transition-all duration-200 ease-out"
          style={{
            left: passwordLength > 0 && showPassword ? '20px' : `${52 + yellowPos.faceX}px`,
            top: passwordLength > 0 && showPassword ? '35px' : `${40 + yellowPos.faceY}px`,
          }}
        >
          <Pupil size={12} maxDistance={5} pupilColor="#2D2D2D" mouseX={mouseX} mouseY={mouseY} forceLookX={passwordLength > 0 && showPassword ? -5 : undefined} forceLookY={passwordLength > 0 && showPassword ? -4 : undefined} />
          <Pupil size={12} maxDistance={5} pupilColor="#2D2D2D" mouseX={mouseX} mouseY={mouseY} forceLookX={passwordLength > 0 && showPassword ? -5 : undefined} forceLookY={passwordLength > 0 && showPassword ? -4 : undefined} />
        </div>
        <div
          className="absolute w-20 h-[4px] bg-[#2D2D2D] rounded-full transition-all duration-200 ease-out"
          style={{
            left: passwordLength > 0 && showPassword ? '10px' : `${40 + yellowPos.faceX}px`,
            top: passwordLength > 0 && showPassword ? '88px' : `${88 + yellowPos.faceY}px`,
          }}
        />
      </div>
    </div>
  );
}
