import React, { useState, useEffect } from 'react';
import { updateChallengeWordBank } from '../../services/api';

interface WordBankEditorProps {
  challengeId: string;
  userId: string;
  initialWords: string[];
}

const WordBankEditor: React.FC<WordBankEditorProps> = ({ challengeId, userId, initialWords }) => {
  const [wordsText, setWordsText] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    setWordsText(initialWords.join('\n'));
  }, [initialWords]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      // Filter empty lines and duplicates
      const words = wordsText
        .split('\n')
        .map(w => w.trim().toUpperCase())
        .filter(w => w.length > 0);

      const uniqueWords = Array.from(new Set(words));

      await updateChallengeWordBank(userId, challengeId, uniqueWords);
      setMessage({ type: 'success', text: `Saved ${uniqueWords.length} words to the bank.` });
      setWordsText(uniqueWords.join('\n'));
    } catch (error) {
      console.error('Save failed', error);
      setMessage({ type: 'error', text: 'Failed to save word bank.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-2">
        <label className="block text-gray-400 text-sm mb-1">Words ({wordsText.split('\n').filter(w => w.trim()).length})</label>
        <textarea
          value={wordsText}
          onChange={(e) => setWordsText(e.target.value)}
          className="w-full h-64 bg-gray-900 border border-gray-700 rounded-lg p-3 text-white font-mono text-sm leading-relaxed"
          placeholder="Enter words, one per line..."
        />
      </div>

      <div className="flex justify-between items-center mt-2">
        <div>
          {message && (
            <span className={`text-sm ${message.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
              {message.text}
            </span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg font-bold disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Word Bank'}
        </button>
      </div>
    </div>
  );
};

export default WordBankEditor;
