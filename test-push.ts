import dotenv from 'dotenv';
dotenv.config(); // Ensure all env variables are loaded

import { sendPushNotification } from './services/push.js';
import pool from './db/pool.js';

async function testPush() {
    console.log('Starting push notification test...');
    
    // Allows you to pass a user ID as an argument
    // e.g., npm run test:push -- user-123
    let userId = process.argv[2]; 

    try {
        if (!userId) {
            console.log('No user ID provided. Fetching admin user from DB...');
            // Fetch the admin user to test with
            const result = await pool.query("SELECT id FROM users WHERE email = 'admin@smym.org' LIMIT 1");
            if (result.rows.length > 0) {
                userId = result.rows[0].id;
                console.log(`Found admin user: ${userId}`);
            } else {
                 console.error('Could not find admin@smym.org to test with. Please provide a user ID.');
                 return;
            }
        } else {
            console.log(`Targeting user: ${userId}`);
        }

        // --- Define your test payload ---
        const payload = {
            title: 'SMYM Bible Games - Test',
            body: `This is a test notification sent at ${new Date().toLocaleTimeString()}`,
            url: '/' // URL to open when notification is clicked
        };

        console.log('Sending notification...');
        await sendPushNotification(userId, payload);
        console.log('Push notification function executed.');
        console.log('Check your device(s) and server logs (APN/FCM) for details.');

    } catch (error) {
        console.error('Error during push notification test:', error);
    } finally {
        // End the pool connection so the script can exit
        await pool.end();
    }
}

testPush();