/**
 * Vendor directory used to speed up subprocessor entry.
 *
 * Deliberately NOT included: processing locations. Where a vendor processes
 * your data depends on the regions/plans you chose, so the administrator must
 * select locations explicitly. Where a vendor publishes a page about data
 * locations or its own subprocessors, we link to it so the administrator can
 * check the facts. All fields are editable after selection.
 */
export type Vendor = {
  slug: string;
  name: string;
  category: VendorCategory;
  websiteUrl: string;
  privacyPolicyUrl: string;
  /** Vendor page listing regions / data residency or its own subprocessors, if published. */
  dataLocationsUrl?: string;
  defaultServices: string;
  aliases?: string[];
};

export type VendorCategory =
  | "Cloud infrastructure"
  | "Hosting & deployment"
  | "Database & storage"
  | "CDN & security"
  | "Payments"
  | "AI & machine learning"
  | "Developer tools"
  | "Communication & email"
  | "Productivity & collaboration"
  | "Analytics"
  | "Customer support & CRM"
  | "Identity & access"
  | "Monitoring & logging"
  | "HR & finance";

export const VENDORS: Vendor[] = [
  // Cloud infrastructure
  { slug: "aws", name: "Amazon Web Services (AWS)", category: "Cloud infrastructure", websiteUrl: "https://aws.amazon.com", privacyPolicyUrl: "https://aws.amazon.com/privacy/", dataLocationsUrl: "https://aws.amazon.com/about-aws/global-infrastructure/regions_az/", defaultServices: "Cloud hosting, compute, storage and backups", aliases: ["Amazon", "EC2", "S3"] },
  { slug: "azure", name: "Microsoft Azure", category: "Cloud infrastructure", websiteUrl: "https://azure.microsoft.com", privacyPolicyUrl: "https://privacy.microsoft.com/privacystatement", dataLocationsUrl: "https://azure.microsoft.com/explore/global-infrastructure/data-residency/", defaultServices: "Cloud hosting, compute and storage", aliases: ["Microsoft"] },
  { slug: "google-cloud", name: "Google Cloud Platform", category: "Cloud infrastructure", websiteUrl: "https://cloud.google.com", privacyPolicyUrl: "https://policies.google.com/privacy", dataLocationsUrl: "https://cloud.google.com/about/locations", defaultServices: "Cloud hosting, compute and storage", aliases: ["GCP", "Google"] },
  { slug: "hetzner", name: "Hetzner", category: "Cloud infrastructure", websiteUrl: "https://www.hetzner.com", privacyPolicyUrl: "https://www.hetzner.com/legal/privacy-policy", defaultServices: "Cloud servers and dedicated hosting" },
  { slug: "digitalocean", name: "DigitalOcean", category: "Cloud infrastructure", websiteUrl: "https://www.digitalocean.com", privacyPolicyUrl: "https://www.digitalocean.com/legal/privacy-policy", defaultServices: "Cloud servers, managed databases and object storage" },
  { slug: "ovhcloud", name: "OVHcloud", category: "Cloud infrastructure", websiteUrl: "https://www.ovhcloud.com", privacyPolicyUrl: "https://www.ovhcloud.com/en/personal-data-protection/", defaultServices: "Cloud and dedicated hosting" },
  { slug: "scaleway", name: "Scaleway", category: "Cloud infrastructure", websiteUrl: "https://www.scaleway.com", privacyPolicyUrl: "https://www.scaleway.com/en/privacy-policy/", defaultServices: "Cloud hosting and object storage" },
  // Hosting & deployment
  { slug: "vercel", name: "Vercel", category: "Hosting & deployment", websiteUrl: "https://vercel.com", privacyPolicyUrl: "https://vercel.com/legal/privacy-policy", dataLocationsUrl: "https://vercel.com/docs/regions", defaultServices: "Web application hosting and edge network" },
  { slug: "netlify", name: "Netlify", category: "Hosting & deployment", websiteUrl: "https://www.netlify.com", privacyPolicyUrl: "https://www.netlify.com/privacy/", defaultServices: "Web application hosting" },
  { slug: "fly-io", name: "Fly.io", category: "Hosting & deployment", websiteUrl: "https://fly.io", privacyPolicyUrl: "https://fly.io/legal/privacy-policy/", defaultServices: "Application hosting" },
  { slug: "render", name: "Render", category: "Hosting & deployment", websiteUrl: "https://render.com", privacyPolicyUrl: "https://render.com/privacy", defaultServices: "Application hosting and managed databases" },
  { slug: "railway", name: "Railway", category: "Hosting & deployment", websiteUrl: "https://railway.com", privacyPolicyUrl: "https://railway.com/legal/privacy", defaultServices: "Application hosting" },
  { slug: "heroku", name: "Heroku (Salesforce)", category: "Hosting & deployment", websiteUrl: "https://www.heroku.com", privacyPolicyUrl: "https://www.salesforce.com/company/privacy/", defaultServices: "Application hosting" },
  // Database & storage
  { slug: "supabase", name: "Supabase", category: "Database & storage", websiteUrl: "https://supabase.com", privacyPolicyUrl: "https://supabase.com/privacy", defaultServices: "Managed PostgreSQL, authentication and file storage" },
  { slug: "neon", name: "Neon", category: "Database & storage", websiteUrl: "https://neon.tech", privacyPolicyUrl: "https://neon.tech/privacy-policy", defaultServices: "Managed PostgreSQL" },
  { slug: "planetscale", name: "PlanetScale", category: "Database & storage", websiteUrl: "https://planetscale.com", privacyPolicyUrl: "https://planetscale.com/legal/privacy", defaultServices: "Managed database" },
  { slug: "mongodb-atlas", name: "MongoDB Atlas", category: "Database & storage", websiteUrl: "https://www.mongodb.com", privacyPolicyUrl: "https://www.mongodb.com/legal/privacy-policy", defaultServices: "Managed database" },
  { slug: "redis", name: "Redis Cloud", category: "Database & storage", websiteUrl: "https://redis.io", privacyPolicyUrl: "https://redis.io/legal/privacy-policy/", defaultServices: "Managed in-memory data store and caching" },
  { slug: "snowflake", name: "Snowflake", category: "Database & storage", websiteUrl: "https://www.snowflake.com", privacyPolicyUrl: "https://www.snowflake.com/privacy-policy/", defaultServices: "Data warehouse" },
  { slug: "backblaze", name: "Backblaze", category: "Database & storage", websiteUrl: "https://www.backblaze.com", privacyPolicyUrl: "https://www.backblaze.com/company/policy/privacy", defaultServices: "Object storage and backups" },
  { slug: "dropbox", name: "Dropbox", category: "Database & storage", websiteUrl: "https://www.dropbox.com", privacyPolicyUrl: "https://www.dropbox.com/privacy", defaultServices: "File storage and sharing" },
  { slug: "box", name: "Box", category: "Database & storage", websiteUrl: "https://www.box.com", privacyPolicyUrl: "https://www.box.com/legal/privacypolicy", defaultServices: "File storage and sharing" },
  // CDN & security
  { slug: "cloudflare", name: "Cloudflare", category: "CDN & security", websiteUrl: "https://www.cloudflare.com", privacyPolicyUrl: "https://www.cloudflare.com/privacypolicy/", dataLocationsUrl: "https://www.cloudflare.com/network/", defaultServices: "CDN, DNS, DDoS protection and web application firewall" },
  { slug: "fastly", name: "Fastly", category: "CDN & security", websiteUrl: "https://www.fastly.com", privacyPolicyUrl: "https://www.fastly.com/privacy/", defaultServices: "CDN and edge security" },
  { slug: "akamai", name: "Akamai", category: "CDN & security", websiteUrl: "https://www.akamai.com", privacyPolicyUrl: "https://www.akamai.com/legal/privacy-statement", defaultServices: "CDN and security services" },
  // Payments
  { slug: "stripe", name: "Stripe", category: "Payments", websiteUrl: "https://stripe.com", privacyPolicyUrl: "https://stripe.com/privacy", defaultServices: "Payment processing and invoicing" },
  { slug: "paddle", name: "Paddle", category: "Payments", websiteUrl: "https://www.paddle.com", privacyPolicyUrl: "https://www.paddle.com/legal/privacy", defaultServices: "Payment processing and merchant of record" },
  { slug: "paypal", name: "PayPal", category: "Payments", websiteUrl: "https://www.paypal.com", privacyPolicyUrl: "https://www.paypal.com/webapps/mpp/ua/privacy-full", defaultServices: "Payment processing" },
  { slug: "adyen", name: "Adyen", category: "Payments", websiteUrl: "https://www.adyen.com", privacyPolicyUrl: "https://www.adyen.com/policies-and-disclaimer/privacy-policy", defaultServices: "Payment processing" },
  { slug: "chargebee", name: "Chargebee", category: "Payments", websiteUrl: "https://www.chargebee.com", privacyPolicyUrl: "https://www.chargebee.com/privacy/", defaultServices: "Subscription billing" },
  // AI
  { slug: "openai", name: "OpenAI", category: "AI & machine learning", websiteUrl: "https://openai.com", privacyPolicyUrl: "https://openai.com/policies/privacy-policy/", defaultServices: "Large language model API" },
  { slug: "anthropic", name: "Anthropic", category: "AI & machine learning", websiteUrl: "https://www.anthropic.com", privacyPolicyUrl: "https://www.anthropic.com/privacy", defaultServices: "Large language model API (Claude)" },
  { slug: "google-ai", name: "Google AI (Gemini API)", category: "AI & machine learning", websiteUrl: "https://ai.google.dev", privacyPolicyUrl: "https://policies.google.com/privacy", defaultServices: "Large language model API" },
  { slug: "mistral", name: "Mistral AI", category: "AI & machine learning", websiteUrl: "https://mistral.ai", privacyPolicyUrl: "https://mistral.ai/terms/#privacy-policy", defaultServices: "Large language model API" },
  { slug: "hugging-face", name: "Hugging Face", category: "AI & machine learning", websiteUrl: "https://huggingface.co", privacyPolicyUrl: "https://huggingface.co/privacy", defaultServices: "Model hosting and inference" },
  { slug: "elevenlabs", name: "ElevenLabs", category: "AI & machine learning", websiteUrl: "https://elevenlabs.io", privacyPolicyUrl: "https://elevenlabs.io/privacy-policy", defaultServices: "Speech synthesis API" },
  // Developer tools
  { slug: "github", name: "GitHub", category: "Developer tools", websiteUrl: "https://github.com", privacyPolicyUrl: "https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement", dataLocationsUrl: "https://docs.github.com/site-policy/privacy-policies/github-subprocessors", defaultServices: "Source code hosting and CI/CD" },
  { slug: "gitlab", name: "GitLab", category: "Developer tools", websiteUrl: "https://gitlab.com", privacyPolicyUrl: "https://about.gitlab.com/privacy/", defaultServices: "Source code hosting and CI/CD" },
  { slug: "bitbucket", name: "Bitbucket (Atlassian)", category: "Developer tools", websiteUrl: "https://bitbucket.org", privacyPolicyUrl: "https://www.atlassian.com/legal/privacy-policy", defaultServices: "Source code hosting" },
  { slug: "docker-hub", name: "Docker Hub", category: "Developer tools", websiteUrl: "https://hub.docker.com", privacyPolicyUrl: "https://www.docker.com/legal/docker-privacy-policy/", defaultServices: "Container image registry" },
  { slug: "npm", name: "npm (GitHub)", category: "Developer tools", websiteUrl: "https://www.npmjs.com", privacyPolicyUrl: "https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement", defaultServices: "Package registry" },
  // Communication & email
  { slug: "google-workspace", name: "Google Workspace", category: "Communication & email", websiteUrl: "https://workspace.google.com", privacyPolicyUrl: "https://policies.google.com/privacy", defaultServices: "Email, calendar, documents and file storage" },
  { slug: "microsoft-365", name: "Microsoft 365", category: "Communication & email", websiteUrl: "https://www.microsoft.com/microsoft-365", privacyPolicyUrl: "https://privacy.microsoft.com/privacystatement", defaultServices: "Email, calendar, documents, Teams and file storage" },
  { slug: "slack", name: "Slack (Salesforce)", category: "Communication & email", websiteUrl: "https://slack.com", privacyPolicyUrl: "https://slack.com/trust/privacy/privacy-policy", defaultServices: "Team messaging" },
  { slug: "zoom", name: "Zoom", category: "Communication & email", websiteUrl: "https://zoom.us", privacyPolicyUrl: "https://explore.zoom.us/en/privacy/", defaultServices: "Video conferencing" },
  { slug: "twilio", name: "Twilio", category: "Communication & email", websiteUrl: "https://www.twilio.com", privacyPolicyUrl: "https://www.twilio.com/en-us/legal/privacy", defaultServices: "SMS, voice and email (SendGrid) delivery" , aliases: ["SendGrid"] },
  { slug: "postmark", name: "Postmark (ActiveCampaign)", category: "Communication & email", websiteUrl: "https://postmarkapp.com", privacyPolicyUrl: "https://postmarkapp.com/privacy-policy", defaultServices: "Transactional email delivery" },
  { slug: "mailgun", name: "Mailgun (Sinch)", category: "Communication & email", websiteUrl: "https://www.mailgun.com", privacyPolicyUrl: "https://www.mailgun.com/legal/privacy-policy/", defaultServices: "Transactional email delivery" },
  { slug: "resend", name: "Resend", category: "Communication & email", websiteUrl: "https://resend.com", privacyPolicyUrl: "https://resend.com/legal/privacy-policy", defaultServices: "Transactional email delivery" },
  { slug: "mailchimp", name: "Mailchimp (Intuit)", category: "Communication & email", websiteUrl: "https://mailchimp.com", privacyPolicyUrl: "https://www.intuit.com/privacy/statement/", defaultServices: "Email marketing" },
  { slug: "brevo", name: "Brevo", category: "Communication & email", websiteUrl: "https://www.brevo.com", privacyPolicyUrl: "https://www.brevo.com/legal/privacypolicy/", defaultServices: "Email and marketing automation" },
  // Productivity & collaboration
  { slug: "notion", name: "Notion", category: "Productivity & collaboration", websiteUrl: "https://www.notion.com", privacyPolicyUrl: "https://www.notion.com/privacy", defaultServices: "Documentation and knowledge management" },
  { slug: "atlassian", name: "Atlassian (Jira, Confluence)", category: "Productivity & collaboration", websiteUrl: "https://www.atlassian.com", privacyPolicyUrl: "https://www.atlassian.com/legal/privacy-policy", defaultServices: "Issue tracking and documentation", aliases: ["Jira", "Confluence"] },
  { slug: "linear", name: "Linear", category: "Productivity & collaboration", websiteUrl: "https://linear.app", privacyPolicyUrl: "https://linear.app/privacy", defaultServices: "Issue tracking" },
  { slug: "asana", name: "Asana", category: "Productivity & collaboration", websiteUrl: "https://asana.com", privacyPolicyUrl: "https://asana.com/terms#privacy-policy", defaultServices: "Project management" },
  { slug: "figma", name: "Figma", category: "Productivity & collaboration", websiteUrl: "https://www.figma.com", privacyPolicyUrl: "https://www.figma.com/legal/privacy/", defaultServices: "Design collaboration" },
  { slug: "miro", name: "Miro", category: "Productivity & collaboration", websiteUrl: "https://miro.com", privacyPolicyUrl: "https://miro.com/legal/privacy-policy/", defaultServices: "Online whiteboarding" },
  { slug: "zapier", name: "Zapier", category: "Productivity & collaboration", websiteUrl: "https://zapier.com", privacyPolicyUrl: "https://zapier.com/legal/privacy", defaultServices: "Workflow automation" },
  { slug: "docusign", name: "DocuSign", category: "Productivity & collaboration", websiteUrl: "https://www.docusign.com", privacyPolicyUrl: "https://www.docusign.com/privacy", defaultServices: "Electronic signatures" },
  { slug: "calendly", name: "Calendly", category: "Productivity & collaboration", websiteUrl: "https://calendly.com", privacyPolicyUrl: "https://calendly.com/privacy", defaultServices: "Appointment scheduling" },
  // Analytics
  { slug: "google-analytics", name: "Google Analytics", category: "Analytics", websiteUrl: "https://analytics.google.com", privacyPolicyUrl: "https://policies.google.com/privacy", defaultServices: "Web analytics" },
  { slug: "plausible", name: "Plausible Analytics", category: "Analytics", websiteUrl: "https://plausible.io", privacyPolicyUrl: "https://plausible.io/privacy", defaultServices: "Privacy-friendly web analytics" },
  { slug: "posthog", name: "PostHog", category: "Analytics", websiteUrl: "https://posthog.com", privacyPolicyUrl: "https://posthog.com/privacy", defaultServices: "Product analytics and session replay" },
  { slug: "mixpanel", name: "Mixpanel", category: "Analytics", websiteUrl: "https://mixpanel.com", privacyPolicyUrl: "https://mixpanel.com/legal/privacy-policy/", defaultServices: "Product analytics" },
  { slug: "amplitude", name: "Amplitude", category: "Analytics", websiteUrl: "https://amplitude.com", privacyPolicyUrl: "https://amplitude.com/privacy", defaultServices: "Product analytics" },
  { slug: "hotjar", name: "Hotjar (Contentsquare)", category: "Analytics", websiteUrl: "https://www.hotjar.com", privacyPolicyUrl: "https://www.hotjar.com/legal/policies/privacy/", defaultServices: "Heatmaps and session recordings" },
  { slug: "segment", name: "Segment (Twilio)", category: "Analytics", websiteUrl: "https://segment.com", privacyPolicyUrl: "https://www.twilio.com/en-us/legal/privacy", defaultServices: "Customer data platform" },
  // Customer support & CRM
  { slug: "hubspot", name: "HubSpot", category: "Customer support & CRM", websiteUrl: "https://www.hubspot.com", privacyPolicyUrl: "https://legal.hubspot.com/privacy-policy", defaultServices: "CRM and marketing automation" },
  { slug: "salesforce", name: "Salesforce", category: "Customer support & CRM", websiteUrl: "https://www.salesforce.com", privacyPolicyUrl: "https://www.salesforce.com/company/privacy/", defaultServices: "CRM" },
  { slug: "intercom", name: "Intercom", category: "Customer support & CRM", websiteUrl: "https://www.intercom.com", privacyPolicyUrl: "https://www.intercom.com/legal/privacy", defaultServices: "Customer messaging and support" },
  { slug: "zendesk", name: "Zendesk", category: "Customer support & CRM", websiteUrl: "https://www.zendesk.com", privacyPolicyUrl: "https://www.zendesk.com/company/agreements-and-terms/privacy-notice/", defaultServices: "Customer support ticketing" },
  { slug: "freshworks", name: "Freshworks", category: "Customer support & CRM", websiteUrl: "https://www.freshworks.com", privacyPolicyUrl: "https://www.freshworks.com/privacy/", defaultServices: "Customer support and CRM" },
  { slug: "pipedrive", name: "Pipedrive", category: "Customer support & CRM", websiteUrl: "https://www.pipedrive.com", privacyPolicyUrl: "https://www.pipedrive.com/en/privacy", defaultServices: "CRM" },
  { slug: "crisp", name: "Crisp", category: "Customer support & CRM", websiteUrl: "https://crisp.chat", privacyPolicyUrl: "https://crisp.chat/en/privacy/", defaultServices: "Customer messaging" },
  // Identity & access
  { slug: "okta", name: "Okta", category: "Identity & access", websiteUrl: "https://www.okta.com", privacyPolicyUrl: "https://www.okta.com/privacy-policy/", defaultServices: "Identity and single sign-on" },
  { slug: "auth0", name: "Auth0 (Okta)", category: "Identity & access", websiteUrl: "https://auth0.com", privacyPolicyUrl: "https://www.okta.com/privacy-policy/", defaultServices: "Authentication as a service" },
  { slug: "clerk", name: "Clerk", category: "Identity & access", websiteUrl: "https://clerk.com", privacyPolicyUrl: "https://clerk.com/legal/privacy", defaultServices: "Authentication and user management" },
  { slug: "1password", name: "1Password", category: "Identity & access", websiteUrl: "https://1password.com", privacyPolicyUrl: "https://1password.com/legal/privacy", defaultServices: "Password and secrets management" },
  // Monitoring & logging
  { slug: "datadog", name: "Datadog", category: "Monitoring & logging", websiteUrl: "https://www.datadoghq.com", privacyPolicyUrl: "https://www.datadoghq.com/legal/privacy/", defaultServices: "Monitoring, logging and APM" },
  { slug: "sentry", name: "Sentry", category: "Monitoring & logging", websiteUrl: "https://sentry.io", privacyPolicyUrl: "https://sentry.io/privacy/", defaultServices: "Error tracking and performance monitoring" },
  { slug: "new-relic", name: "New Relic", category: "Monitoring & logging", websiteUrl: "https://newrelic.com", privacyPolicyUrl: "https://newrelic.com/termsandconditions/privacy", defaultServices: "Observability platform" },
  { slug: "grafana", name: "Grafana Cloud", category: "Monitoring & logging", websiteUrl: "https://grafana.com", privacyPolicyUrl: "https://grafana.com/legal/privacy-policy/", defaultServices: "Metrics, logs and dashboards" },
  { slug: "betterstack", name: "Better Stack", category: "Monitoring & logging", websiteUrl: "https://betterstack.com", privacyPolicyUrl: "https://betterstack.com/privacy", defaultServices: "Uptime monitoring and log management" },
  { slug: "pagerduty", name: "PagerDuty", category: "Monitoring & logging", websiteUrl: "https://www.pagerduty.com", privacyPolicyUrl: "https://www.pagerduty.com/privacy-policy/", defaultServices: "Incident alerting and on-call" },
  // HR & finance
  { slug: "gusto", name: "Gusto", category: "HR & finance", websiteUrl: "https://gusto.com", privacyPolicyUrl: "https://gusto.com/about/privacy", defaultServices: "Payroll and HR" },
  { slug: "deel", name: "Deel", category: "HR & finance", websiteUrl: "https://www.deel.com", privacyPolicyUrl: "https://www.deel.com/privacy-policy/", defaultServices: "Global payroll and contractor management" },
  { slug: "personio", name: "Personio", category: "HR & finance", websiteUrl: "https://www.personio.com", privacyPolicyUrl: "https://www.personio.com/privacy-policy/", defaultServices: "HR management" },
  { slug: "quickbooks", name: "QuickBooks (Intuit)", category: "HR & finance", websiteUrl: "https://quickbooks.intuit.com", privacyPolicyUrl: "https://www.intuit.com/privacy/statement/", defaultServices: "Accounting" },
  { slug: "xero", name: "Xero", category: "HR & finance", websiteUrl: "https://www.xero.com", privacyPolicyUrl: "https://www.xero.com/legal/privacy/", defaultServices: "Accounting" },
];

const bySlug = new Map(VENDORS.map((v) => [v.slug, v]));

export function vendorBySlug(slug: string) {
  return bySlug.get(slug);
}

export function searchVendors(query: string): Vendor[] {
  const q = query.trim().toLowerCase();
  if (!q) return VENDORS;
  return VENDORS.filter(
    (v) =>
      v.name.toLowerCase().includes(q) ||
      v.slug.includes(q) ||
      v.category.toLowerCase().includes(q) ||
      v.aliases?.some((a) => a.toLowerCase().includes(q)),
  );
}

export const VENDOR_CATEGORIES = Array.from(new Set(VENDORS.map((v) => v.category)));
