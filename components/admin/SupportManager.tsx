import React, { useEffect, useState } from 'react';
import { getAdminTickets, getTicket, addTicketNote, updateTicketStatus } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

interface Ticket {
  id: string;
  email: string;
  issue: string;
  status: 'open' | 'resolved' | 'closed';
  created_at: string;
}

const SupportManager: React.FC = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [note, setNote] = useState('');
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState<any[]>([]);

  const fetchTickets = async () => {
    if (!user) return;
    try {
      const data = await getAdminTickets(user.id);
      setTickets(data);
    } catch (error) {
      console.error('Failed to fetch tickets', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [user]);

  const handleSelectTicket = async (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setStatus(ticket.status);
    setNote('');
    // Fetch details (notes)
    try {
      const data = await getTicket(ticket.id);
      setNotes(data.notes);
    } catch (error) {
      console.error('Failed to fetch ticket details', error);
    }
  };

  const handleAddNote = async () => {
    if (!selectedTicket || !note.trim() || !user) return;
    try {
      await addTicketNote(user.id, selectedTicket.id, note);

      // Refresh notes
      const data = await getTicket(selectedTicket.id);
      setNotes(data.notes);
      setNote('');
    } catch (error) {
      console.error('Failed to add note', error);
      alert('Failed to add note');
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedTicket || !user) return;
    try {
      await updateTicketStatus(user.id, selectedTicket.id, newStatus);
      setStatus(newStatus);
      // Update list locally
      setTickets(tickets.map(t => t.id === selectedTicket.id ? { ...t, status: newStatus as any } : t));
      setSelectedTicket({ ...selectedTicket, status: newStatus as any });
    } catch (error) {
      console.error('Failed to update status', error);
      alert('Failed to update status');
    }
  };

  if (loading) return <div className="text-white">Loading tickets...</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
      {/* Ticket List */}
      <div className="lg:col-span-1 bg-gray-800 rounded-xl border border-gray-700 overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-700 bg-gray-900/50">
          <h3 className="font-bold text-white">Tickets</h3>
        </div>
        <div className="overflow-y-auto flex-1 p-2 space-y-2">
          {tickets.map(ticket => (
            <div
              key={ticket.id}
              onClick={() => handleSelectTicket(ticket)}
              className={`p-3 rounded-lg cursor-pointer transition-colors ${selectedTicket?.id === ticket.id ? 'bg-yellow-500/20 border border-yellow-500/50' : 'bg-gray-700/50 hover:bg-gray-700 border border-transparent'}`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className={`text-xs px-2 py-0.5 rounded-full ${ticket.status === 'open' ? 'bg-green-900 text-green-300' : ticket.status === 'resolved' ? 'bg-blue-900 text-blue-300' : 'bg-gray-600 text-gray-300'}`}>
                  {ticket.status}
                </span>
                <span className="text-xs text-gray-400">{new Date(ticket.created_at).toLocaleDateString()}</span>
              </div>
              <div className="font-medium text-gray-200 truncate">{ticket.email}</div>
              <div className="text-sm text-gray-400 truncate">{ticket.issue}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Ticket Detail */}
      <div className="lg:col-span-2 bg-gray-800 rounded-xl border border-gray-700 overflow-hidden flex flex-col">
        {selectedTicket ? (
          <>
            <div className="p-4 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-white">Ticket #{selectedTicket.id}</h3>
                <p className="text-sm text-gray-400">{selectedTicket.email}</p>
              </div>
              <div className="flex gap-2">
                {['open', 'resolved', 'closed'].map(s => (
                  <button
                    key={s}
                    onClick={() => handleUpdateStatus(s)}
                    className={`px-3 py-1 rounded-lg text-sm capitalize transition-colors ${status === s ? 'bg-yellow-500 text-gray-900 font-bold' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                <h4 className="text-sm font-bold text-gray-400 mb-2">Issue</h4>
                <p className="text-gray-200 whitespace-pre-wrap">{selectedTicket.issue}</p>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-bold text-gray-400">Notes & Updates</h4>
                {notes.map(note => (
                  <div key={note.id} className="bg-gray-700/30 p-3 rounded-lg border border-gray-600">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-yellow-500">{note.adminName}</span>
                      <span className="text-xs text-gray-500">{new Date(note.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-gray-300 whitespace-pre-wrap">{note.note}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-gray-700 bg-gray-900/30">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note or reply..."
                className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500 mb-2"
                rows={3}
              />
              <div className="flex justify-end">
                <button
                  onClick={handleAddNote}
                  disabled={!note.trim()}
                  className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Note
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a ticket to view details
          </div>
        )}
      </div>
    </div>
  );
};

export default SupportManager;
