import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://a731b4e8b586fd275ba1abc99d68f547@o4511036158640128.ingest.us.sentry.io/4511036214673408",
  tunnel: "/api/sentry-tunnel",
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  debug: false,
});
