import { io } from 'socket.io-client';
import { API_URL } from './api';

let socket;

export function getSocket() {
  if (!socket) {
    socket = io(API_URL, { auth: { token: localStorage.getItem('token') }, autoConnect: true });
  }
  return socket;
}

// Disconnect and clear the cached socket so the next getSocket() reconnects
// with the current token (call on logout / user switch).
export function resetSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
