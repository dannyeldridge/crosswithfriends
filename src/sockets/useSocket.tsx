import {useEffect, useState} from 'react';
import type {Socket} from 'socket.io-client';
import {getSocket} from './getSocket';

export const useSocket = () => {
  const [socket, setSocket] = useState<Socket>();
  useEffect(() => {
    getSocket().then(setSocket);
  }, []);
  return socket;
};
