export const runtime = 'nodejs';

export function GET() {
  const checks = {
    db: !!process.env.DATABASE_URL,
    jwt: !!process.env.JWT_SECRET,
    llm: !!(process.env.DEEPSEEK_API_KEY || process.env.GROQ_API_KEY),
    voice: !!(process.env.DEEPGRAM_API_KEY || process.env.ELEVENLABS_API_KEY),
  };

  const degraded = Object.values(checks).some((v) => !v);

  return Response.json(
    {
      status: degraded ? 'degraded' : 'ok',
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: degraded ? 206 : 200 },
  );
}
