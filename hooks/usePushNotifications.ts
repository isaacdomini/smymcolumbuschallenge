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
    // SAFARI FIX: Check if Notification exists before accessing .permission
    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
        if (typeof Notification !== 'undefined') {
            return Notification.permission;
        }
        return 'denied'; // Default to 'denied' if API is missing
    });

    useEffect(() => {
        // SAFARI FIX: Added explicit check for 'Notification' in window
        if ('serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined') {
            setIsSupported(true);
            navigator.serviceWorker.register('/service-worker.js')
                .then(registration => {
                    console.log('Service Worker registered for push notifications');
                    registration.pushManager.getSubscription().then(subscription => {
                        if (subscription) {
                             console.log('User is already subscribed to push notifications');
                        }
                        setIsSubscribed(!!subscription);
                    });
                })
                .catch(error => console.error('Service Worker registration failed:', error));
        } else {
             console.warn('Push notifications are not supported in this browser.');
             setIsSupported(false);
        }
    }, []);

    const subscribeToPush = useCallback(async () => {
        // SAFARI FIX: Added check for Notification existence here too
        if (!user || !isSupported || typeof Notification === 'undefined') {
             console.warn('Cannot subscribe: User not logged in or push not supported.');
             return;
        }

        try {
            console.log('Requesting notification permission...');
            const permission = await Notification.requestPermission();
            setNotificationPermission(permission);
            if (permission !== 'granted') {
                 console.warn('Notification permission denied.');
                 return;
            }
            console.log('Notification permission granted.');

            const swRegistration = await navigator.serviceWorker.ready;
            console.log('Service Worker ready for subscription.');
            
            // 1. Get public key from backend
            console.log('Fetching VAPID public key...');
            const response = await fetch(`${VITE_API_URL}/vapid-public-key`);
            if (!response.ok) {
                 throw new Error(`Failed to fetch VAPID key: ${response.statusText}`);
            }
            const { publicKey } = await response.json();
            console.log('VAPID public key received.');

            // 2. Subscribe to push service
            console.log('Subscribing to Push Manager...');
            const subscription = await swRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey)
            });
            console.log('Push subscription successful:', subscription);

            // 3. Send subscription to backend
            console.log('Sending subscription to backend...');
            const saveResponse = await fetch(`${VITE_API_URL}/subscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, subscription })
            });

            if (!saveResponse.ok) {
                 throw new Error(`Failed to save subscription on backend: ${saveResponse.statusText}`);
            }
            console.log('Subscription saved on backend.');

            setIsSubscribed(true);
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