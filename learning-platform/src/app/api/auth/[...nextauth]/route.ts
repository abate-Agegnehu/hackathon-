import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

const handler = NextAuth(authOptions);

const GET = handler;
const POST = handler;

export { GET, POST }; 