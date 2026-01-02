import React, { useEffect, useState } from 'react';

const ChristmasFlair: React.FC = () => {
  const [snowflakes, setSnowflakes] = useState<React.ReactNode[]>([]);

  useEffect(() => {
    // Generate static snowflakes once on mount to avoid re-renders
    const flakes = Array.from({ length: 50 }).map((_, i) => {
      const left = Math.random() * 100;
      const animationDuration = 5 + Math.random() * 10;
      const animationDelay = Math.random() * 5;
      const opacity = 0.3 + Math.random() * 0.5;
      const size = 0.5 + Math.random() * 1.0;

      return (
        <div
          key={i}
          className="fixed top-0 text-white pointer-events-none z-50 select-none animate-snowfall"
          style={{
            left: `${left}vw`,
            fontSize: `${size}rem`,
            opacity: opacity,
            animationDuration: `${animationDuration}s`,
            animationDelay: `-${animationDelay}s`, // Negative delay to start mid-animation
          }}
        >
          ❄
        </div>
      );
    });
    setSnowflakes(flakes);
  }, []);

  return (
    <>
      <style>
        {`
          @keyframes snowfall {
            0% {
              transform: translateY(-10vh) translateX(-20px) rotate(0deg);
            }
            100% {
              transform: translateY(110vh) translateX(20px) rotate(360deg);
            }
          }
          .animate-snowfall {
            animation-name: snowfall;
            animation-timing-function: linear;
            animation-iteration-count: infinite;
          }
        `}
      </style>
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {snowflakes}
      </div>
    </>
  );
};

export default ChristmasFlair;
