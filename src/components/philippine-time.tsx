'use client';

import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { Skeleton } from './ui/skeleton';

export function PhilippineTime() {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    // Set the initial time once on the client
    setTime(new Date());

    const timerId = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => {
      clearInterval(timerId);
    };
  }, []);

  if (!time) {
    return (
        <div className="p-2 rounded-lg text-sm text-center bg-muted/50">
            <div className="flex items-center justify-center gap-2 font-semibold text-foreground">
                <Skeleton className="h-5 w-24" />
            </div>
            <Skeleton className="h-4 w-28 mx-auto mt-1" />
            <Skeleton className="h-4 w-8 mx-auto mt-1" />
        </div>
    )
  }

  const formattedTime = time.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const formattedDate = time.toLocaleDateString('en-US', {
      timeZone: 'Asia/Manila',
      weekday: 'long',
      month: 'long',
      day: 'numeric',
  });

  return (
    <div className="p-2 rounded-lg text-sm text-center bg-muted/50">
        <div className="flex items-center justify-center gap-2 font-semibold text-foreground">
            <Clock className="h-4 w-4"/>
            <span>{formattedTime}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{formattedDate}</p>
        <p className="text-xs text-muted-foreground/80 font-medium tracking-wide">PHT</p>
    </div>
  );
}
