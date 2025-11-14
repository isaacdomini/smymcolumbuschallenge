import React from 'react';

interface PrivacyPolicyProps {
  onBack: () => void;
  onNavigateToDeleteAccount: () => void;
}

const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onBack, onNavigateToDeleteAccount }) => {
  return (
    <div className="w-full max-w-2xl mx-auto mt-6 mb-12 p-6 bg-gray-800 rounded-xl shadow-2xl border border-gray-700">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-yellow-400">Privacy Policy</h2>
        <button 
          onClick={onBack} 
          className="text-gray-400 hover:text-white text-sm"
        >
          &larr; Back to Home
        </button>
      </div>

      <div className="prose prose-invert text-gray-300 space-y-4">
        <p>Last updated: November 13, 2025</p>
        
        <p>
          This privacy policy ("Policy") describes how SMYM Bible Games ("we," "us," or "our") 
          collects, uses, and shares information about you when you use our mobile application 
          (the "App").
        </p>

        <h3 className="text-xl font-semibold text-yellow-400 pt-4">1. Information We Collect</h3>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Account Information:</strong> When you create an account, we collect your 
            name and email address. We also store a securely hashed (encrypted) version of your password.
          </li>
          <li>
            <strong>Game Data:</strong> We collect and store your game submissions, including 
            scores, time taken, and any in-game progress to display on your personal 
            history and on the public leaderboard.
          </li>
          <li>
            <strong>Push Notification Tokens:</strong> If you opt-in, we store a unique token 
            for your device to send you daily game reminders.
          </li>
          <li>
            <strong>Usage Logs:</strong> We may log non-identifiable information such as 
            device type and app interactions for the purpose of debugging and improving 
            the app.
          </li>
        </ul>

        <h3 className="text-xl font-semibold text-yellow-400 pt-4">2. How We Use Your Information</h3>
        <ul className="list-disc pl-5 space-y-2">
          <li>To provide and maintain the App's services, such as saving your game progress.</li>
          <li>To authenticate your account.</li>
          <li>To display your name and total score on the public leaderboard.</li>
          <li>To send you verification emails, password reset links, and (if you opt-in) daily push notifications.</li>
          <li>To analyze and improve the App's performance and features.</li>
        </ul>

        <h3 className="text-xl font-semibold text-yellow-400 pt-4">3. Information Sharing</h3>
        <p>
          We do not sell, trade, or otherwise transfer your personally identifiable 
          information to outside parties. Your name (as you provide it) and total score 
          are visible to other users of the App on the leaderboard.
        </p>
        
        <h3 className="text-xl font-semibold text-yellow-400 pt-4">4. Account Deletion</h3>
        <p>
          As a user of **SMYM Bible Games**, you may request the deletion of your account and 
          all associated data at any time.
        </p>
        <p>
          <strong>Steps to Request Deletion:</strong>
        </p>
        <ol className="list-decimal pl-5 space-y-2">
          <li>
            Navigate to our{' '}
            <button 
              onClick={onNavigateToDeleteAccount} 
              className="text-blue-400 hover:text-blue-300 underline"
            >
              Account Deletion Request Page
            </button>.
          </li>
          <li>
            Authenticate your account by providing your registered email address and password.
          </li>
          <li>
            Submit the request. This will send a notification to the app administrator.
          </li>
        </ol>

        <p>
          <strong>Data Deletion Process:</strong>
        </p>
        <p>
          Upon verification of your request, the following data will be permanently 
          deleted from our servers within a **48-hour retention period**:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Your user profile (name, email, and hashed password).</li>
          <li>All your game submissions, scores, and saved game progress.</li>
          <li>All push notification subscription tokens associated with your account.</li>
        </ul>
        <p>
          Non-personally identifiable, anonymized data (such as game logs that are no 
          longer linked to any user) may be retained for analytical purposes.
        </p>

        <h3 className="text-xl font-semibold text-yellow-400 pt-4">5. Data Security</h3>
        <p>
          We implement a variety of security measures to maintain the safety of your 
          personal information. Your password is stored in a hashed format, meaning 
          we cannot see or retrieve it.
        </p>

        <h3 className="text-xl font-semibold text-yellow-400 pt-4">6. Changes to This Policy</h3>
        <p>
          We may update this privacy policy from time to time. We will notify you of 
          any changes by posting the new policy within the App.
        </p>

        <h3 className="text-xl font-semibold text-yellow-400 pt-4">7. Contact Us</h3>
        <p>
          If you have any questions about this privacy policy, please contact us at:
          <br />
          <strong>smym@columbuschurch.org</strong>
          <br />
          Developer: <strong>Isaac Domini</strong>
        </p>
      </div>
    </div>
  );
};

export default PrivacyPolicy;