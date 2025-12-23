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
      unit: 'px',
      format: 'a4'
    });

    // A4 width in px at 96dpi is roughly 794px, 
    // but jsPDF defaults to 1 user unit = 1 px if specified, or points.
    // Let's rely on the html scaling. 
    // jsPDF 'a4' size is 595.28 x 841.89 points (approx pixels at 72dpi).
    // If we use 'px' unit, it might differ. 
    // Best practice for doc.html is to let it scale.
    // The input div is 595px width to match A4 point width roughly.

    await doc.html(input, {
      callback: function (doc) {
        doc.save(`${state.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
      },
      x: 30, // Margins
      y: 30,
      width: 450, // Target width in the PDF document
      windowWidth: 650 // Window width to render the HTML at
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
            {state.date && <p className="text-sm text-gray-400">{state.date}</p>}
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
      <div
        id="pdf-content"
        style={{
          position: 'absolute',
          top: '-10000px',
          left: '-10000px',
          width: '600px', // Fixed width for A4
          backgroundColor: '#ffffff',
          color: '#000000',
          padding: '40px',
          fontFamily: 'serif' // Better for reading
        }}
        className="prose prose-lg max-w-none text-black"
      >
        <h1 style={{ fontSize: '32px', marginBottom: '10px', color: '#000000' }}>{state.title}</h1>
        {state.date && <p style={{ fontSize: '14px', color: '#666666', marginBottom: '30px' }}>{state.date}</p>}
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
