import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';

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
    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'granted' | 'denied' | 'prompt'>('denied');
    const registerNativePush = useCallback(async (userId: string) => {
        try {
            let permStatus = await PushNotifications.checkPermissions();

            if (permStatus.receive === 'prompt') {
                permStatus = await PushNotifications.requestPermissions();
            }

            if (permStatus.receive !== 'granted') {
                console.warn('Native push permission not granted.');
                setNotificationPermission('denied');
                return;
            }

            setNotificationPermission('granted');

            // Add listeners
            await PushNotifications.addListener('registration', (token: Token) => {
                console.log('Native push registration success, token:', token.value);
                // Send token to backend
                fetch(`${VITE_API_URL}/subscribe`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        userId: userId, 
                        token: token.value,
                        platform: Capacitor.getPlatform() // 'ios' or 'android'
                    })
                })
                .then(res => res.json())
                .then(data => {
                    if (data.message === 'Subscription already exists' || data.message === 'Native subscription saved successfully') {
                        setIsSubscribed(true);
                    }
                })
                .catch(err => console.error('Failed to save native token:', err));
            });

            await PushNotifications.addListener('registrationError', (err: any) => {
                console.error('Native push registration error:', err);
            });

            await PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
                console.log('Native push received:', notification);
                // You could show an in-app toast here
            });

            await PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
                console.log('Native push action performed:', notification);
                // Handle notification tap (e.g., navigate to a specific page)
                const url = notification.notification.data?.url || '/';
                window.location.href = url;
            });

            // Register with APNs/FCM
            await PushNotifications.register();
            
            // On iOS, check for existing token (may not fire 'registration' event if already registered)
            if (Capacitor.getPlatform() === 'ios') {
                const result = await PushNotifications.getDeliveredNotifications();
                console.log('Delivered notifications:', result);
            }
            
        } catch (error) {
            console.error('Error setting up native push:', error);
        }
    }, []);

    // --- Web Push Registration (Existing Logic) ---
    const registerWebPush = useCallback(async (userId: string) => {
        try {
            if ('serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined') {
                setIsSupported(true);
                const swRegistration = await navigator.serviceWorker.register('/service-worker.js');
                console.log('Service Worker registered for web push.');

                const existingSubscription = await swRegistration.pushManager.getSubscription();
                if (existingSubscription) {
                    console.log('User is already subscribed to web push.');
                    setIsSubscribed(true);
                    setNotificationPermission(Notification.permission);
                    return;
                }
                
                // If not subscribed, permission must be 'default' or 'granted' to proceed
                setNotificationPermission(Notification.permission);
                if (Notification.permission === 'denied') {
                    console.warn('Web push permission denied.');
                    return;
                }

            } else {
                 console.warn('Web push notifications are not supported in this browser.');
                 setIsSupported(false);
            }
        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    }, []);
    
    // --- Main Effect to Choose Registration Type ---
    useEffect(() => {
        if (!user) return;

        if (Capacitor.isNativePlatform()) {
            console.log('Native platform detected, registering for native push...');
            setIsSupported(true); // Native push is supported
            registerNativePush(user.id);
        } else {
            console.log('Web platform detected, registering for web push...');
            registerWebPush(user.id);
        }

        // Cleanup listeners when user logs out (component unmounts)
        return () => {
            if (Capacitor.isNativePlatform()) {
                PushNotifications.removeAllListeners().catch(err => console.error("Failed to remove push listeners", err));
            }
        }

    }, [user, registerNativePush, registerWebPush]);


    const subscribeToPush = useCallback(async () => {
        if (!user || !isSupported) {
             console.warn('Cannot subscribe: User not logged in or push not supported.');
             return;
        }

        // Native subscription is handled by the `registerNativePush` flow on load.
        // This function will now only handle the *web* subscription flow.
        if (Capacitor.isNativePlatform()) {
            console.log("Native push registration is initiated on app load.");
            // Optionally, you could re-run permission check if they denied it
            // await registerNativePush(user.id);
            return;
        }

        // --- Web Push Subscription Logic (from button click) ---
        try {
            const permission = await Notification.requestPermission();
            setNotificationPermission(permission);
            if (permission !== 'granted') {
                 console.warn('Notification permission denied.');
                 return;
            }
            console.log('Notification permission granted.');

            const swRegistration = await navigator.serviceWorker.ready;
            
            const response = await fetch(`${VITE_API_URL}/vapid-public-key`);
            if (!response.ok) throw new Error('Failed to fetch VAPID key');
            const { publicKey } = await response.json();

            const subscription = await swRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey)
            });

            const saveResponse = await fetch(`${VITE_API_URL}/subscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, subscription, platform: 'web' })
            });

            if (!saveResponse.ok) throw new Error('Failed to save subscription');
            
            setIsSubscribed(true);
        } catch (error) {
            console.error('Failed to subscribe to web push:', error);
        }
    }, [user, isSupported]);

    return {
        isSupported,
        isSubscribed,
        notificationPermission,
        subscribeToPush
    };
};