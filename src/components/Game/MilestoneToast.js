import {useEffect, useState} from 'react';
import './css/milestoneToast.css';

export default function MilestoneToast({message}) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 2000);
    return () => clearTimeout(fadeTimer);
  }, [message]);

  return <div className={`milestone-toast${fading ? ' milestone-toast--fading' : ''}`}>{message}</div>;
}
