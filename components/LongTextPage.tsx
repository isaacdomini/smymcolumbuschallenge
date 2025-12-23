import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { jsPDF } from 'jspdf';

interface LocationState {
  title: string;
  text: string;
  date?: string;
}

interface LongTextPageProps {
  navigate: (path: string) => void;
}

const LongTextPage: React.FC<LongTextPageProps> = ({ navigate }) => {
  const [state, setState] = useState<LocationState | null>(null);

  useEffect(() => {
    // Read state from window.history
    const historyState = window.history.state;
    if (historyState && historyState.title && historyState.text) {
      setState(historyState as LocationState);
    } else {
      // Redirect back if no state (direct access)
      navigate('/');
    }
  }, [navigate]);

  if (!state) return null;

  const handleDownloadPDF = async () => {
    // We need to wait a moment for the hidden div to render if it wasn't there, 
    // but it is always there just hidden.
    const input = document.getElementById('pdf-content');
    if (!input) {
      console.error("PDF content element not found");
      return;
    }

    const doc = new jsPDF({
      orientation: 'p',
      unit: 'pt', // Use points for better font-size mapping
      format: 'letter' // Letter size (8.5x11 in)
    });

    // Letter width is 612 pt.
    // Margin 40pt left/right -> Printable width 532pt.

    await doc.html(input, {
      callback: function (doc) {
        doc.save(`${state.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
      },
      x: 40,
      y: 40,
      width: 532,
      windowWidth: 550, // Slightly larger window to render cleanly
      autoPaging: 'text',
      html2canvas: {
        scale: 1, // Reset scale to 1 to prevent huge blowing up usually
        logging: false,
        letterRendering: true,
        useCORS: true
      }
    });
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
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors shadow-md"
            title="Download as PDF"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span className="hidden sm:inline">Download PDF</span>
          </button>
        </div>

        {/* Visible Dark Mode Content */}
        <div className="prose prose-invert prose-lg max-w-none text-gray-300">
          <ReactMarkdown>
            {state.text}
          </ReactMarkdown>
        </div>
      </div>

      {/* Hidden Light Mode Content for PDF Generation */}
      {/* We use z-index -1000 and fixed position to ensure it renders but is hidden behind main content */}
      <div
        id="pdf-content"
        style={{
          position: 'fixed',
          zIndex: -1000,
          top: '0',
          left: '0', // Must be in viewport for html2canvas capture
          width: '532px', // Matches the target width in PDF (approx 532pt printable)
          backgroundColor: '#ffffff',
          color: '#000000',
          padding: '0px', // Handle padding in PDF margins instead
          fontFamily: 'serif',
          fontSize: '12pt',
          lineHeight: '1.4'
        }}
        className="prose max-w-none text-black"
      >
        <h1 style={{ fontSize: '24pt', marginBottom: '10pt', color: '#000000', lineHeight: '1.2' }}>{state.title}</h1>
        <div style={{ color: '#000000' }}>
          <ReactMarkdown components={{
            h1: ({ node, ...props }) => <h1 style={{ color: 'black', borderBottom: '1px solid #ddd', paddingBottom: '10px' }} {...props} />,
            h2: ({ node, ...props }) => <h2 style={{ color: 'black', marginTop: '20px' }} {...props} />,
            p: ({ node, ...props }) => <p style={{ color: 'black', lineHeight: '1.6' }} {...props} />,
            li: ({ node, ...props }) => <li style={{ color: 'black' }} {...props} />,
            strong: ({ node, ...props }) => <strong style={{ color: 'black', fontWeight: 'bold' }} {...props} />,
            em: ({ node, ...props }) => <em style={{ color: 'black' }} {...props} />,
            blockquote: ({ node, ...props }) => <blockquote style={{ color: '#444', borderLeft: '4px solid #ccc', paddingLeft: '10px', fontStyle: 'italic' }} {...props} />
          }}>
            {state.text}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
};

export default LongTextPage;
