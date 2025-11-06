
import React, { useState, useEffect } from 'react';

interface CountdownProps {
  targetDate: string;
}

const Countdown: React.FC<CountdownProps> = ({ targetDate }) => {
  const calculateTimeLeft = () => {
    const difference = +new Date(targetDate) - +new Date();
    let timeLeft = {};

    if (difference > 0) {
      timeLeft = {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    }

    return timeLeft;
  };

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  useEffect(() => {
    const timer = setTimeout(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearTimeout(timer);
  });

  const timerComponents = Object.entries(timeLeft).map(([interval, value]) => (
    <div key={interval} className="text-center">
      <div className="text-4xl md:text-6xl font-bold text-yellow-400">{String(value).padStart(2, '0')}</div>
      <div className="text-sm md:text-lg uppercase text-gray-400">{interval}</div>
    </div>
  ));

  return (
    <div className="bg-gray-800 rounded-lg p-6 md:p-10 text-center">
      <h2 className="text-2xl md:text-3xl font-bold mb-6">Challenge Begins In</h2>
      <div className="flex justify-center space-x-4 md:space-x-8">
        {timerComponents.length ? timerComponents : <span>Challenge has started!</span>}
      </div>
    </div>
  );
};

export default Countdown;
