import React from 'react';

interface PrivacyPolicyProps {
  onBack: () => void;
}

const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onBack }) => {
  return (
    <div className="w-full max-w-3xl mx-auto p-4 md:p-6 bg-gray-800 rounded-lg shadow-xl border border-gray-700">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-yellow-400">Privacy Policy</h1>
        <button 
          onClick={onBack} 
          className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
        >
          &larr; Back
        </button>
      </div>

      <div className="prose prose-invert prose-lg max-w-none text-gray-300 space-y-4">
        <p className="text-sm text-gray-500">Last updated: November 14, 2025</p>

        <p>
          Welcome to SMYM Columbus Bible Games ("we," "our," or "us"). We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our application.
        </p>

        <h2 className="text-xl font-semibold text-yellow-400 pt-4 border-t border-gray-700/50">1. Information We Collect</h2>
        <p>We may collect information about you in a variety of ways. The information we may collect on the Service includes:</p>
        <ul>
          <li>
            <strong>Personal Data:</strong> Personally identifiable information, such as your name and email address, that you voluntarily give to us when you register for an account.
          </li>
          <li>
            <strong>Account Credentials:</strong> We collect your password in a hashed, unreadable format. We never store your password in plain text.
          </li>
          <li>
            <strong>Device and Log Information:</strong> We automatically collect information when you access the Service, such as your IP address, browser type, user agent, pages viewed, and the dates/times of your visits. This is used for analytics and security logging.
          </li>
          <li>
            <strong>Push Notification Tokens:</strong> If you grant permission, we collect a unique token for your device (whether it's a web browser, iOS, or Android device) to send you push notifications, such as daily game reminders.
          </li>
        </ul>

        <h2 className="text-xl font-semibold text-yellow-400 pt-4 border-t border-gray-700/50">2. How We Use Your Information</h2>
        <p>We use the information we collect to:</p>
        <ul>
          <li>Create and manage your account.</li>
          <li>Provide the game services and display your scores on the leaderboard.</li>
          <li>Send you daily reminders via email or push notifications (if you opt in).</li>
          <li>Send you account verification or password reset emails.</li>
          <li>Monitor and analyze usage and trends to improve the application.</li>
          <li>Maintain the security and stability of our systems.</li>
        </ul>

        <h2 className="text-xl font-semibold text-yellow-400 pt-4 border-t border-gray-700/50">3. Sharing Your Information</h2>
        <p>We do not sell, trade, or rent your personal information to third parties. Your name and total score are visible to other participants on the leaderboard.</p>
        <p>
          We may share information with third-party service providers that perform services for us, such as email delivery (Nodemailer, using your configured SMTP provider) and push notifications (Apple APNs, Google FCM). These providers are only given the information necessary to perform their services.
        </p>

        <h2 className="text-xl font-semibold text-yellow-400 pt-4 border-t border-gray-700/50">4. Data Security</h2>
        <p>
          We use administrative, technical, and physical security measures to help protect your personal information. While we have taken reasonable steps to secure the personal information you provide to us, please be aware that despite our efforts, no security measures are perfect or impenetrable.
        </p>

        <h2 className="text-xl font-semibold text-yellow-400 pt-4 border-t border-gray-700/50">5. Your Choices</h2>
        <ul>
          <li>
            <strong>Account Information:</strong> You may review or change your information at any time by contacting us.
          </li>
          <li>
            <strong>Email Notifications:</strong> You can opt-out of daily reminder emails by (We need to build this feature, but for now:) contacting us. Transactional emails (like password resets) will still be sent.
          </li>
          <li>
            <strong>Push Notifications:</strong> You can turn off push notifications at any time in your device or browser settings.
          </li>
        </ul>

        <h2 className="text-xl font-semibold text-yellow-400 pt-4 border-t border-gray-700/50">6. Contact Us</h2>
        <p>
          If you have questions or comments about this Privacy Policy, please contact us at:
        </p>
        <p>
          SMYM Columbus<br />
          [Your Contact Email or Address Here]
        </p>
      </div>

      <style>{`
        .prose-invert ul > li::marker {
          color: #f59e0b;
        }
      `}</style>
    </div>
  );
};

export default PrivacyPolicy;