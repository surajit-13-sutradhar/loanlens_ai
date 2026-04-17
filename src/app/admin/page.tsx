"use client";

import { useState, useEffect, useCallback } from "react";
import { UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Session {
  id: string;
  name: string;
  phone: string;
  email: string;
  status: "pending" | "opened" | "submitted";
  created_at?: string; // Supabase format
  createdAt?: string;  // Old memory store format
  kyc_data?: Record<string, any>;
  loan_decision?: any;
}

const statusStyles: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  opened: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  submitted: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

export default function AdminPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch");
      setSessions(data);
    } catch (err) {
      console.error(err);
      showToast("Failed to load sessions");
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const createSession = async () => {
    if (!name || !phone || !email) {
      showToast("Please fill all fields");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/sessions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email }),
      });

      const data = await res.json();

      if (data.error) {
        showToast(`Error: ${data.error}`);
        return;
      }

      setGeneratedLink(data.link);
      showToast("Email sent successfully");
      setName("");
      setPhone("");
      setEmail("");
      await loadSessions();
    } catch {
      showToast("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  // --- PDF Generation Logic ---
  const downloadPDF = (session: Session) => {
    const doc = new jsPDF();
    
    const dateString = session.created_at || session.createdAt || new Date().toISOString();
    
    // Header Info
    doc.setFontSize(18);
    doc.text(`Loan Application: ${session.name}`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Session ID: ${session.id}`, 14, 26);
    doc.text(`Date Submitted: ${new Date(dateString).toLocaleString("en-IN")}`, 14, 32);

    // Prepare dynamic array for KYC Data Table
    const kycRows = session.kyc_data 
      ? Object.entries(session.kyc_data)
          .filter(([_, v]) => v !== null && v !== undefined) 
          .map(([k, v]) => [
            k.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()), 
            String(v)
          ]) 
      : [];

    // Table 1: Base Info + Extracted KYC Data
    autoTable(doc, {
      startY: 40,
      head: [['Field', 'Value']],
      body: [
        ['Phone Number', session.phone],
        ['Email Address', session.email],
        ...kycRows
      ],
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
      styles: { fontSize: 9 },
    });

    // Table 2: Loan Decision Details (if available)
    if (session.loan_decision?.selectedOffer) {
      const finalY = (doc as any).lastAutoTable.finalY || 40;
      
      doc.setFontSize(14);
      doc.text("Selected Loan Details", 14, finalY + 15);
      
      const offer = session.loan_decision.selectedOffer;
      
      autoTable(doc, {
      startY: finalY + 20,
      head: [['Attribute', 'Value']],
      body: [
        ['Plan Type', offer.plan],
        ['Principal Amount', `INR ${offer.principalAmount.toLocaleString("en-IN")}`],
        ['Tenure', `${offer.tenureMonths} Months`],
        ['Annual Interest Rate', `${offer.annualInterestRate}%`],
        ['Monthly EMI', `INR ${offer.monthlyEmi.toLocaleString("en-IN")}`]
      ],
      theme: 'grid',
      headStyles: { fillColor: [39, 174, 96] }, 
      styles: { fontSize: 9 },
    });
    }

    doc.save(`KYC_${session.name.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <main className="min-h-screen bg-black text-white">

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl text-sm shadow-lg transition-all">
          {toast}
        </div>
      )}

      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold tracking-tight">LoanLens AI</span>
          <span className="text-xs px-2 py-0.5 rounded-full border border-white/20 text-white/40">
            Admin
          </span>
        </div>
        <UserButton />
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">

        {/* Create Session */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-5">
          <div>
            <h2 className="text-lg font-semibold">Create Loan Session</h2>
            <p className="text-white/40 text-sm mt-1">
              Generate a unique onboarding link and send it to the customer.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Customer name"
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 transition-colors"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number"
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 transition-colors"
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              type="email"
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 transition-colors"
            />
          </div>

          <div className="flex items-center gap-4">
            <Button
              onClick={createSession}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-6 transition-colors"
            >
              {loading ? "Sending..." : "Generate & Send Link"}
            </Button>

            {generatedLink && (
              <div className="flex items-center gap-2 text-xs text-white/40 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 flex-1 overflow-hidden">
                <span className="truncate font-mono">{generatedLink}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generatedLink);
                    showToast("Link copied");
                  }}
                  className="text-white/60 hover:text-white shrink-0 text-xs transition-colors"
                >
                  Copy
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sessions Table */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">All Sessions</h2>
            <button
              onClick={loadSessions}
              className="text-xs text-white/40 hover:text-white/70 border border-white/10 rounded-lg px-3 py-1.5 transition-colors"
            >
              Refresh
            </button>
          </div>

          {sessions.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-8">
              No sessions yet. Create one above.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/30 text-xs uppercase tracking-widest border-b border-white/10">
                    <th className="text-left py-3 pr-4">Name</th>
                    <th className="text-left py-3 pr-4">Phone</th>
                    <th className="text-left py-3 pr-4">Email</th>
                    <th className="text-left py-3 pr-4">Status</th>
                    <th className="text-left py-3">Created</th>
                    <th className="text-right py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => {
                    // Fallback to grab either the old format or new format
                    const dateString = s.created_at || s.createdAt;
                    const isValidDate = dateString && !isNaN(new Date(dateString).getTime());

                    return (
                      <tr key={s.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="py-3 pr-4 font-medium">{s.name}</td>
                        <td className="py-3 pr-4 text-white/50">{s.phone}</td>
                        <td className="py-3 pr-4 text-white/50">{s.email}</td>
                        <td className="py-3 pr-4">
                          <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${statusStyles[s.status]}`}>
                            {s.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 text-white/30 text-xs font-mono">
                          {isValidDate 
                            ? new Date(dateString!).toLocaleString("en-IN", {
                                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                              })
                            : "Just now"
                          }
                        </td>
                        <td className="py-3 text-right">
                          {s.status === "submitted" && (
                            <button
                              onClick={() => downloadPDF(s)}
                              className="text-[11px] font-semibold tracking-wide text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 px-3 py-1.5 rounded-lg transition-all"
                            >
                              DOWNLOAD PDF
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}