import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { id, kycData, loanDecision, status } = await req.json();

    const { error } = await supabase
      .from('loan_sessions')
      .update({
        kyc_data: kycData,
        loan_decision: loanDecision,
        status: status
      })
      .eq('id', id);

    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}