import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';

const VITE_API_URL = import.meta.env.VITE_API_URL || '/api';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const usePushNotifications = () => {
    const { user } = useAuth();
    const [isSupported, setIsSupported] = useState(false);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [notificationPermission, setNotificationPermission] = useState(Notification.permission);

    useEffect(() => {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            setIsSupported(true);
            navigator.serviceWorker.register('/service-worker.js')
                .then(registration => {
                    registration.pushManager.getSubscription().then(subscription => {
                        setIsSubscribed(!!subscription);
                    });
                });
        }
    }, []);

    const subscribeToPush = useCallback(async () => {
        if (!user || !isSupported) return;

        try {
            const permission = await Notification.requestPermission();
            setNotificationPermission(permission);
            if (permission !== 'granted') return;

            const swRegistration = await navigator.serviceWorker.ready;
            
            // 1. Get public key from backend
            const response = await fetch(`${VITE_API_URL}/vapid-public-key`);
            const { publicKey } = await response.json();

            // 2. Subscribe to push service
            const subscription = await swRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey)
            });

            // 3. Send subscription to backend
            await fetch(`${VITE_API_URL}/subscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, subscription })
            });

            setIsSubscribed(true);
            // Optional: Show a success message or toast here
        } catch (error) {
            console.error('Failed to subscribe to push notifications:', error);
        }
    }, [user, isSupported]);

    return {
        isSupported,
        isSubscribed,
        notificationPermission,
        subscribeToPush
    };
};