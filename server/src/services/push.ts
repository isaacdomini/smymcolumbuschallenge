import webpush from 'web-push';
import pool from '../db/pool.js';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import apn from 'apn';

dotenv.config();

// --- Web Push (VAPID) Setup ---
let vapidKeys = {
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || ''
};

// If keys are missing in dev, generate them temporarily. 
// WARNING: In production, these MUST be persistent in environment variables, 
// otherwise users will need to re-subscribe every time the server restarts.
if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
    console.warn("⚠️ VAPID keys not found in environment. Generating temporary keys. Push subscriptions will be invalidated on server restart.");
    vapidKeys = webpush.generateVAPIDKeys();
    console.log("Temporary VAPID Public Key:", vapidKeys.publicKey);
    console.log("Temporary VAPID Private Key:", vapidKeys.privateKey);
}

webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
);
export const getVapidPublicKey = () => vapidKeys.publicKey;

// --- Firebase (FCM) Setup ---
let firebaseApp: admin.app.App | null = null;
function initializeFirebase() {
    if (admin.apps.length > 0) {
        firebaseApp = admin.apps[0];
        return;
    }
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (serviceAccountPath) {
        try {
            firebaseApp = admin.initializeApp({
                credential: admin.credential.cert(serviceAccountPath),
            });
            console.log('Firebase Admin SDK initialized successfully.');
        } catch (e: any) {
            console.error('Failed to initialize Firebase Admin SDK:', e.message);
        }
    } else {
        console.warn('FIREBASE_SERVICE_ACCOUNT_PATH not set. Android push notifications will not work.');
    }
}
initializeFirebase(); // Initialize on server start

// --- Apple (APNs) Setup ---
let apnProvider: apn.Provider | null = null;
function initializeAPN() {
    const options = {
        token: {
            key: process.env.APNS_KEY_PATH || '',
            keyId: process.env.APNS_KEY_ID || '',
            teamId: process.env.APNS_TEAM_ID || '',
        },
        production: process.env.NODE_ENV === 'production',
    };

    if (options.token.key && options.token.keyId && options.token.teamId) {
        apnProvider = new apn.Provider(options);
        console.log('APN Provider initialized.');
    } else {
        console.warn('APNS environment variables not set. iOS push notifications will not work.');
    }
}
initializeAPN(); // Initialize on server start

// --- Database Subscription Management ---
export const saveSubscription = async (userId: string, subscriptionOrToken: any, platform: string) => {
    if (platform === 'web') {
        // Handle Web Push subscription
        const subscription = subscriptionOrToken;
        await pool.query(
            'INSERT INTO push_subscriptions (user_id, endpoint, keys, platform) VALUES ($1, $2, $3, $4) ON CONFLICT (endpoint) DO UPDATE SET user_id = $1, keys = $3, platform = $4, created_at = CURRENT_TIMESTAMP',
            [userId, subscription.endpoint, JSON.stringify(subscription.keys), platform]
        );
    } else {
        // Handle Native Push token (ios or android)
        const token = subscriptionOrToken;
        await pool.query(
            'INSERT INTO push_subscriptions (user_id, device_token, platform) VALUES ($1, $2, $3) ON CONFLICT (device_token) DO UPDATE SET user_id = $1, platform = $3, created_at = CURRENT_TIMESTAMP',
            [userId, token, platform]
        );
    }
};

// --- Helper Functions for Sending ---

async function sendWebPush(subscriptions: any[], payload: { title: string, body: string, url?: string }) {
    const webPushPromises = subscriptions.map(async (sub) => {
        const pushSubscription = { endpoint: sub.endpoint, keys: sub.keys };
        try {
            await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
        } catch (error: any) {
            if (error.statusCode === 410 || error.statusCode === 404) {
                console.log(`Web subscription expired for ${sub.user_id}, deleting...`);
                await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
            } else {
                console.error(`Error sending web push to user ${sub.user_id}:`, error.body);
            }
        }
    });
    await Promise.all(webPushPromises);
}

async function sendFirebasePush(tokens: string[], payload: { title: string, body: string, url?: string }) {
    if (!firebaseApp) {
        console.warn('Firebase Admin SDK not initialized. Skipping Android push.');
        return;
    }

    const message = {
        notification: {
            title: payload.title,
            body: payload.body,
        },
        data: {
            url: payload.url || '/',
        },
        tokens: tokens,
    };

    try {
        const response = await admin.messaging().sendEachForMulticast(message);
        if (response.failureCount > 0) {
            const tokensToDelete: string[] = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const errorCode = resp.error?.code;
                    // Check for errors indicating an invalid or unregistered token
                    if (errorCode === 'messaging/registration-token-not-registered' ||
                        errorCode === 'messaging/invalid-registration-token') {
                        console.log(`Invalid FCM token ${tokens[idx]}, scheduling for deletion.`);
                        tokensToDelete.push(tokens[idx]);
                    } else {
                        console.error(`Failed to send FCM to token ${tokens[idx]}:`, resp.error);
                    }
                }
            });

            if (tokensToDelete.length > 0) {
                await pool.query('DELETE FROM push_subscriptions WHERE device_token = ANY($1::text[]) AND platform = $2', [tokensToDelete, 'android']);
            }
        }
    } catch (error) {
        console.error('Error sending FCM notifications:', error);
    }
}

async function sendApplePush(tokens: string[], payload: { title: string, body: string, url?: string }) {
    if (!apnProvider) {
        console.warn('APN Provider not initialized. Skipping iOS push.');
        return;
    }
    const bundleId = process.env.APNS_BUNDLE_ID;
    if (!bundleId) {
        console.warn('APNS_BUNDLE_ID not set. Skipping iOS push.');
        return;
    }

    const notification = new apn.Notification();
    notification.expiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour
    notification.badge = 1;
    notification.sound = 'ping.aiff';
    notification.alert = {
        title: payload.title,
        body: payload.body,
    };
    notification.payload = { data: { url: payload.url || '/' } };
    notification.topic = bundleId; // Your app's bundle ID

    try {
        const response = await apnProvider.send(notification, tokens);

        if (response.failed.length > 0) {
            const tokensToDelete: string[] = [];
            response.failed.forEach((failure) => {
                // FIX: Access 'failure.error.message' instead of 'failure.error.reason'
                const reason = failure.response?.reason || failure.error?.message || 'Unknown Reason';
                console.error(`APN Error: ${failure.status} ${reason} for token ${failure.device}`);
                
                // 'Unregistered' (410) means the user uninstalled the app
                if (failure.status === '410' || reason === 'Unregistered') {
                    tokensToDelete.push(failure.device);
                }
            });

            if (tokensToDelete.length > 0) {
                await pool.query('DELETE FROM push_subscriptions WHERE device_token = ANY($1::text[]) AND platform = $2', [tokensToDelete, 'ios']);
            }
        }
    } catch (error) {
         console.error('Error sending APN notifications:', error);
    }
}


// --- Main Orchestration Function ---
export const sendPushNotification = async (userId: string, payload: { title: string, body: string, url?: string }) => {
    try {
        const result = await pool.query(
            'SELECT * FROM push_subscriptions WHERE user_id = $1',
            [userId]
        );

        const subscriptions = result.rows;
        if (subscriptions.length === 0) return;

        console.log(`Sending push notification to ${subscriptions.length} devices for user ${userId}`);
        
        // Filter subscriptions by platform
        const webSubscriptions = subscriptions.filter(s => s.platform === 'web' && s.endpoint);
        const androidTokens = subscriptions.filter(s => s.platform === 'android' && s.device_token).map(s => s.device_token);
        const iosTokens = subscriptions.filter(s => s.platform === 'ios' && s.device_token).map(s => s.device_token);

        const pushPromises = [];

        if (webSubscriptions.length > 0) {
            pushPromises.push(sendWebPush(webSubscriptions, payload));
        }
        if (androidTokens.length > 0) {
            pushPromises.push(sendFirebasePush(androidTokens, payload));
        }
        if (iosTokens.length > 0) {
            pushPromises.push(sendApplePush(iosTokens, payload));
        }

        await Promise.all(pushPromises);

    } catch (error) {
        console.error(`Failed to fetch subscriptions for user ${userId}:`, error);
    }
};