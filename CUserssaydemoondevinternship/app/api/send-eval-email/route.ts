import { NextResponse, NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-eval-email`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Server-to-server: include anon key so Supabase gateway authorizes the call
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    try {
      // If the function returned JSON
      return NextResponse.json(JSON.parse(text), { status: res.status });
    } catch {
      // If it returned plain text
      return new NextResponse(text, {
        status: res.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Proxy route error', details: String(e) },
      { status: 500 }
    );
  }
}
