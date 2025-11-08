import webpush from 'web-push';
import pool from '../db/pool.js';
import dotenv from 'dotenv';

dotenv.config();

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

export const saveSubscription = async (userId: string, subscription: any) => {
    // We use the endpoint as a unique key to prevent duplicate subscriptions for the same device
    await pool.query(
        'INSERT INTO push_subscriptions (user_id, endpoint, keys) VALUES ($1, $2, $3) ON CONFLICT (endpoint) DO UPDATE SET user_id = $1, keys = $3, created_at = CURRENT_TIMESTAMP',
        [userId, subscription.endpoint, JSON.stringify(subscription.keys)]
    );
};

export const sendPushNotification = async (userId: string, payload: { title: string, body: string, url?: string }) => {
    try {
        const result = await pool.query(
            'SELECT * FROM push_subscriptions WHERE user_id = $1',
            [userId]
        );

        const subscriptions = result.rows;
        if (subscriptions.length === 0) return;

        console.log(`Sending push notification to ${subscriptions.length} devices for user ${userId}`);

        const notifications = subscriptions.map(async (sub) => {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: sub.keys
            };

            try {
                await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
            } catch (error: any) {
                if (error.statusCode === 410 || error.statusCode === 404) {
                    // Subscription has expired or is no longer valid
                    console.log(`Subscription expired for user ${userId}, deleting...`);
                    await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
                } else {
                    console.error(`Error sending push to user ${userId}:`, error);
                }
            }
        });

        await Promise.all(notifications);
    } catch (error) {
        console.error(`Failed to fetch subscriptions for user ${userId}:`, error);
    }
};