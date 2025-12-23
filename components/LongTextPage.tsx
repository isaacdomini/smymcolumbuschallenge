import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import toast from 'react-hot-toast';
import { getDailyMessage } from '../services/api';
import { DailyMessageBlock } from '../types';

interface LongTextPageProps {
  navigate: (path: string, state?: any) => void;
}

interface MessageState {
  title: string;
  text: string;
  date?: string;
  pdfUrl?: string; // Optional download link
}

const LongTextPage: React.FC<LongTextPageProps> = ({ navigate }) => {
  const [state, setState] = useState<MessageState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadContent = async () => {
      // 1. Try reading from history state (fastest, no fetch needed)
      // Note: App.tsx uses vanilla pushState so we access .state directly, not .state.usr
      const currentState = window.history.state;
      if (currentState && currentState.title && currentState.text) {
        setState(currentState as MessageState);
        setLoading(false);
        return;
      }

      // 2. Fallback: specific fix for some browsers/routers where state might be nested
      if (currentState?.usr?.title && currentState?.usr?.text) {
        setState(currentState.usr as MessageState);
        setLoading(false);
        return;
      }

      // 3. Permalinks: Check URL query parameters
      const params = new URLSearchParams(window.location.search);
      const dateParam = params.get('date');
      const titleParam = params.get('title');

      if (dateParam && titleParam) {
        try {
          const dailyMessage = await getDailyMessage(dateParam);
          if (dailyMessage && dailyMessage.content) {
            let blocks: any[] = [];
            try {
              blocks = typeof dailyMessage.content === 'string'
                ? JSON.parse(dailyMessage.content)
                : dailyMessage.content;
            } catch (e) {
              console.error("Failed to parse daily message content", e);
            }

            // Find the block with the matching title
            // Decode title param just in case (though searchParams handles most)
            const targetBlock = blocks.find((b: any) =>
              b.type === 'long_text' && b.title === titleParam
            );

            if (targetBlock) {
              setState({
                title: targetBlock.title,
                text: targetBlock.text,
                date: dailyMessage.date,
                pdfUrl: targetBlock.pdfUrl
              });
              setLoading(false);
              return;
            }
          }
        } catch (err) {
          console.error("Error fetching daily message for permalink", err);
        }
      }

      // 4. Default: Redirect home if nothing worked
      navigate('/');
    };

    loadContent();
  }, [navigate]);

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-6 min-h-screen flex items-center justify-center">
        <div className="text-gray-400 flex flex-col items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-4"></div>
          Loading content...
        </div>
      </div>
    );
  }

  if (!state) return null; // Should have redirected by now

  const handleShare = async () => {
    // Construct permalink
    const url = new URL(window.location.href);
    // Ensure params are set if they aren't already (e.g. if navigated via state)
    if (!url.searchParams.get('date') && state?.date) {
      url.searchParams.set('date', state.date);
    }
    if (!url.searchParams.get('title') && state?.title) {
      url.searchParams.set('title', state.title);
    }

    const shareData = {
      title: state?.title || 'Daily Message',
      text: `Check out this message: ${state?.title}`,
      url: url.toString()
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(url.toString());
        toast.success('Link copied to clipboard!');
      }
    } catch (err) {
      console.error('Error sharing:', err);
      // Fallback for copy if share fails (e.g., user cancellation sometimes throws)
      if (err instanceof Error && err.name !== 'AbortError') {
        toast.error('Failed to share');
      }
    }
  };

  const handleDownloadPDF = () => {
    if (state?.pdfUrl) {
      window.open(state.pdfUrl, '_blank');
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 pb-safe-bottom min-h-screen">
      <header className="mb-6 flex justify-between items-center bg-gray-800 p-4 rounded-lg shadow-lg">
        <button
          onClick={() => navigate('/')}
          className="flex items-center text-gray-300 hover:text-white transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          <span className="ml-1 font-medium">Back</span>
        </button>
        <h1 className="text-xl font-bold text-white truncate max-w-[60%]">{state.title}</h1>
        <div className="w-10"></div> {/* Spacer for centering */}
      </header>

      <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 p-6 md:p-10 max-w-4xl mx-auto">
        <div className="flex justify-between items-start mb-6 border-b border-gray-700 pb-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-yellow-500 mb-2">{state.title}</h2>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleShare}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition-colors shadow-md"
              title="Share"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"></circle>
                <circle cx="6" cy="12" r="3"></circle>
                <circle cx="18" cy="19" r="3"></circle>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
              </svg>
              <span className="hidden sm:inline">Share</span>
            </button>
            {state.pdfUrl && (
              <button
                onClick={handleDownloadPDF}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors shadow-md"
                title="Download PDF"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                <span className="hidden sm:inline">Download PDF</span>
              </button>
            )}
          </div>
        </div>

        {/* Visible Dark Mode Content */}
        <div className="prose prose-invert prose-lg max-w-none text-gray-300">
          <ReactMarkdown>
            {state.text}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
};

export default LongTextPage;
