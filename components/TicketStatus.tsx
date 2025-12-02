import React, { useEffect, useState } from 'react';
import { getTicket } from '../services/api';

interface Ticket {
  id: string;
  email: string;
  issue: string;
  status: 'open' | 'resolved' | 'closed';
  createdAt: string;
  updatedAt: string;
}

interface Note {
  id: string;
  note: string;
  adminName: string;
  createdAt: string;
}

interface TicketStatusProps {
  ticketId: string;
}

const TicketStatus: React.FC<TicketStatusProps> = ({ ticketId }) => {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTicket = async () => {
      try {
        if (!ticketId) return;
        const data = await getTicket(ticketId);
        setTicket(data.ticket);
        setNotes(data.notes);
      } catch (err: any) {
        setError(err.message || 'Failed to load ticket.');
      } finally {
        setLoading(false);
      }
    };

    if (ticketId) fetchTicket();
  }, [ticketId]);

  if (loading) {
    return <div className="text-center text-gray-400 mt-10">Loading ticket details...</div>;
  }

  if (error || !ticket) {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-gray-800 rounded-xl shadow-lg border border-gray-700 text-center">
        <h2 className="text-2xl font-bold text-red-500 mb-4">Error</h2>
        <p className="text-gray-300">{error || 'Ticket not found.'}</p>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'resolved': return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      case 'closed': return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Ticket #{ticket.id}</h2>
            <p className="text-gray-400 text-sm">Created on {new Date(ticket.createdAt).toLocaleDateString()}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(ticket.status)} capitalize`}>
            {ticket.status}
          </span>
        </div>

        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-200 mb-3">Issue Description</h3>
          <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 text-gray-300 whitespace-pre-wrap">
            {ticket.issue}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-200 mb-4">Updates & Notes</h3>
          {notes.length === 0 ? (
            <p className="text-gray-500 italic">No updates yet.</p>
          ) : (
            <div className="space-y-4">
              {notes.map((note) => (
                <div key={note.id} className="bg-gray-700/50 p-4 rounded-lg border border-gray-600">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-yellow-500">{note.adminName}</span>
                    <span className="text-xs text-gray-400">{new Date(note.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-gray-300 whitespace-pre-wrap">{note.note}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TicketStatus;
