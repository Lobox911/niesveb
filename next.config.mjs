/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,

  /*
   * The certificate's typefaces are read from disk at request time rather than
   * imported, so Next's file tracing never sees them and leaves them out of
   * the serverless bundle. That failure only appears in production — every
   * certificate throws while development works perfectly. Declaring them here
   * is what puts the files in the deployment.
   */
  outputFileTracingIncludes: {
    "/api/certificate/**": ["./src/assets/fonts/**", "./src/assets/brand/**"],
    "/admin/**": ["./src/assets/fonts/**", "./src/assets/brand/**"],
  },
};
