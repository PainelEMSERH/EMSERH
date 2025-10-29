export default function handler(req, res) {
  const key =
    process.env.VITE_CLERK_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    process.env.CLERK_PUBLISHABLE_KEY ||
    '';

  if (!key) {
    return res.status(500).json({ error: 'Missing Clerk publishable key in environment.' });
  }
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  return res.status(200).json({ publishableKey: key });
}
