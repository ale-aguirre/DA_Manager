const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.civitai.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
