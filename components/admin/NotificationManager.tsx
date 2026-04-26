import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { sendAdminNotification, triggerDailyReminders } from '../../services/api';
import { getGroups } from '../../services/groups';
import { Group } from '../../types';

type StatusMsg = { text: string; type: 'success' | 'error' | 'info' } | null;

const NotificationManager: React.FC = () => {
    const { user } = useAuth();

    // --- Custom Notification State ---
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [url, setUrl] = useState('/');
    const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [isSending, setIsSending] = useState(false);
    const [sendStatus, setSendStatus] = useState<StatusMsg>(null);

    // --- Scheduler State ---
    const [isTriggering, setIsTriggering] = useState(false);
    const [schedulerStatus, setSchedulerStatus] = useState<StatusMsg>(null);

    useEffect(() => {
        getGroups()
            .then(setGroups)
            .catch(() => setGroups([]));
    }, []);

    const toggleGroup = (id: string) => {
        setSelectedGroupIds(prev =>
            prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
        );
    };

    const handleSendNotification = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.id || !title.trim() || !body.trim()) return;

        setIsSending(true);
        setSendStatus(null);
        try {
            const result = await sendAdminNotification(user.id, {
                title: title.trim(),
                body: body.trim(),
                url: url.trim() || '/',
                groupIds: selectedGroupIds.length > 0 ? selectedGroupIds : undefined,
            });
            const recipientLabel =
                result.recipients === 'all'
                    ? 'all subscribed users'
                    : `${result.recipients} user${result.recipients !== 1 ? 's' : ''}`;
            setSendStatus({ text: `✓ Sent to ${recipientLabel}.`, type: 'success' });
            setTitle('');
            setBody('');
            setUrl('/');
            setSelectedGroupIds([]);
        } catch (err: any) {
            setSendStatus({ text: err.message || 'Failed to send notification.', type: 'error' });
        } finally {
            setIsSending(false);
        }
    };

    const handleTriggerReminders = async () => {
        if (!user?.id) return;
        setIsTriggering(true);
        setSchedulerStatus(null);
        try {
            const result = await triggerDailyReminders(user.id);
            if (result.result?.skipped) {
                setSchedulerStatus({
                    text: `Skipped: ${result.result.reason}`,
                    type: 'info',
                });
            } else {
                setSchedulerStatus({
                    text: `✓ Reminders sent to ${result.result?.usersNotified ?? '?'} users for ${result.result?.date}.`,
                    type: 'success',
                });
            }
        } catch (err: any) {
            setSchedulerStatus({ text: err.message || 'Failed to trigger reminders.', type: 'error' });
        } finally {
            setIsTriggering(false);
        }
    };

    const charCountColor = body.length > 150 ? 'text-red-400' : body.length > 100 ? 'text-yellow-400' : 'text-gray-400';

    return (
        <div className="space-y-8">

            {/* ── Custom Push Notification ─────────────────────────────── */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-700 flex items-center gap-3">
                    <span className="text-2xl">🔔</span>
                    <div>
                        <h2 className="text-lg font-bold text-white">Send Push Notification</h2>
                        <p className="text-sm text-gray-400">Send a custom notification to subscribed users in selected groups</p>
                    </div>
                </div>

                <form onSubmit={handleSendNotification} className="p-6 space-y-5">
                    {/* Audience selector */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Audience
                            <span className="ml-2 text-xs text-gray-500 font-normal">
                                {selectedGroupIds.length === 0
                                    ? '(All users with push enabled)'
                                    : `(${selectedGroupIds.length} group${selectedGroupIds.length > 1 ? 's' : ''} selected)`}
                            </span>
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {groups.map(g => {
                                const selected = selectedGroupIds.includes(g.id);
                                return (
                                    <button
                                        key={g.id}
                                        type="button"
                                        onClick={() => toggleGroup(g.id)}
                                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                                            selected
                                                ? 'bg-yellow-500 border-yellow-500 text-gray-900 shadow-lg shadow-yellow-500/20'
                                                : 'border-gray-600 text-gray-400 hover:border-yellow-500/50 hover:text-gray-200'
                                        }`}
                                    >
                                        {selected && <span className="mr-1">✓</span>}
                                        {g.name}
                                    </button>
                                );
                            })}
                            {groups.length === 0 && (
                                <span className="text-sm text-gray-500 italic">Loading groups...</span>
                            )}
                        </div>
                        {selectedGroupIds.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setSelectedGroupIds([])}
                                className="mt-2 text-xs text-gray-500 hover:text-gray-300 underline"
                            >
                                Clear selection (send to all)
                            </button>
                        )}
                    </div>

                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            required
                            maxLength={100}
                            placeholder="e.g. Daily Challenge Reminder"
                            className="w-full bg-gray-700 text-white rounded-lg px-4 py-3 text-sm border border-gray-600 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors"
                        />
                    </div>

                    {/* Body */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Body
                            <span className={`ml-2 text-xs font-normal ${charCountColor}`}>{body.length}/160</span>
                        </label>
                        <textarea
                            value={body}
                            onChange={e => setBody(e.target.value)}
                            required
                            maxLength={160}
                            rows={3}
                            placeholder="e.g. Today's game is live — tap to play!"
                            className="w-full bg-gray-700 text-white rounded-lg px-4 py-3 text-sm border border-gray-600 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors resize-none"
                        />
                    </div>

                    {/* URL */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Deep Link URL <span className="text-gray-500 font-normal">(optional)</span>
                        </label>
                        <input
                            type="text"
                            value={url}
                            onChange={e => setUrl(e.target.value)}
                            placeholder="/"
                            className="w-full bg-gray-700 text-white rounded-lg px-4 py-3 text-sm border border-gray-600 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors"
                        />
                    </div>

                    {/* Preview */}
                    {(title || body) && (
                        <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3 font-medium">Preview</p>
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-xl bg-yellow-500 flex items-center justify-center flex-shrink-0 text-lg">✝</div>
                                <div className="min-w-0">
                                    <p className="text-white text-sm font-semibold leading-tight truncate">
                                        {title || 'Notification Title'}
                                    </p>
                                    <p className="text-gray-400 text-xs mt-0.5 line-clamp-2">
                                        {body || 'Notification body text...'}
                                    </p>
                                    <p className="text-gray-600 text-xs mt-1">SMYM Bible Games · now</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {sendStatus && (
                        <div className={`px-4 py-3 rounded-lg text-sm font-medium ${
                            sendStatus.type === 'success' ? 'bg-green-900/50 border border-green-700 text-green-300' :
                            sendStatus.type === 'error'   ? 'bg-red-900/50 border border-red-700 text-red-300' :
                                                            'bg-blue-900/50 border border-blue-700 text-blue-300'
                        }`}>
                            {sendStatus.text}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isSending || !title.trim() || !body.trim()}
                        className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        {isSending ? (
                            <>
                                <span className="animate-spin">⏳</span> Sending...
                            </>
                        ) : (
                            <>
                                🔔 Send Notification
                                {selectedGroupIds.length > 0 && (
                                    <span className="ml-1 font-normal text-gray-800 text-sm">
                                        → {selectedGroupIds.length} group{selectedGroupIds.length > 1 ? 's' : ''}
                                    </span>
                                )}
                            </>
                        )}
                    </button>
                </form>
            </div>

            {/* ── Scheduled Reminders ──────────────────────────────────── */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-700 flex items-center gap-3">
                    <span className="text-2xl">⏰</span>
                    <div>
                        <h2 className="text-lg font-bold text-white">Daily Reminder Job</h2>
                        <p className="text-sm text-gray-400">
                            Normally runs automatically at <strong className="text-gray-300">7:00 AM</strong> and <strong className="text-gray-300">6:00 PM</strong> ET.
                            Sends reminders only to users who haven't completed today's game.
                        </p>
                    </div>
                </div>

                <div className="px-6 py-5 space-y-4">
                    {schedulerStatus && (
                        <div className={`px-4 py-3 rounded-lg text-sm font-medium ${
                            schedulerStatus.type === 'success' ? 'bg-green-900/50 border border-green-700 text-green-300' :
                            schedulerStatus.type === 'error'   ? 'bg-red-900/50 border border-red-700 text-red-300' :
                                                                  'bg-blue-900/50 border border-blue-700 text-blue-300'
                        }`}>
                            {schedulerStatus.text}
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={handleTriggerReminders}
                        disabled={isTriggering}
                        className="w-full bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg border border-gray-600 transition-colors flex items-center justify-center gap-2"
                    >
                        {isTriggering ? (
                            <>
                                <span className="animate-spin">⏳</span> Running job...
                            </>
                        ) : (
                            '▶ Trigger Now'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NotificationManager;
