/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // Allow WebSocket connections
    async rewrites() {
        return [
            {
                source: '/ws',
                destination: 'http://localhost:8080'
            }
        ];
    }
};

module.exports = nextConfig;
