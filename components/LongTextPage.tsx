import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';

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

  useEffect(() => {
    // Read state from history because we passed it via pushState/navigate
    // Note: App.tsx uses vanilla pushState so we access .state directly, not .state.usr
    const currentState = window.history.state;
    if (currentState && currentState.title && currentState.text) {
      setState(currentState as MessageState);
    } else {
      // Fallback or redirect if no state
      navigate('/');
    }
  }, [navigate]);

  if (!state) {
    return <div className="p-8 text-center text-gray-400">Loading...</div>;
  }

  const handleDownloadPDF = () => {
    if (state.pdfUrl) {
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
