import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Lock } from 'lucide-react'

const sections = [
  {
    title: '1. Information We Collect',
    subsections: [
      {
        subtitle: 'Personal Information',
        content: 'As part of the registration and onboarding process, the Company may collect the following personally identifiable information:',
        list: [
          'Name (including name of the entity and/or its authorized representative)',
          'Email address (work and personal)',
          'Mobile phone number and contact details',
          'Organization name, size, industry, and business details',
          'Job title and role within the organization',
          'Billing address and payment information (processed securely via third-party payment processors)',
          'Demographic profile (age, gender, occupation, address, etc.) where voluntarily provided',
        ],
      },
      {
        subtitle: 'CRM & Business Data',
        content: 'When you use the Platform, you may input, upload, or import business data including:',
        list: [
          'Contact and lead information (names, emails, phone numbers, company details)',
          'Sales pipeline data (deals, stages, values, probabilities)',
          'Customer communication records (emails, call logs, chat transcripts)',
          'Task and follow-up schedules',
          'Invoice and billing records',
          'Team member information and role assignments',
          'Custom fields, tags, and notes you create within the Platform',
        ],
        extra: 'This data is collectively referred to as "Customer Data" and remains your property. We process it solely to provide the Services.',
      },
      {
        subtitle: 'Non-Personal & Automatic Information',
        content: 'When you visit or use the Platform, we may automatically collect:',
        list: [
          'Internet protocol (IP) address and geolocation data',
          'Browser type, version, language, and operating system',
          'Device information (model, manufacturer, unique device identifiers)',
          'Pages visited, features used, links clicked, and session duration',
          'Referring/exit URLs and search terms',
          'Log-in timestamps, API call logs, and usage patterns',
          'Performance metrics and error reports',
        ],
      },
      {
        subtitle: 'Cookies & Tracking Technologies',
        content: 'We use cookies, web beacons, and similar technologies to:',
        list: [
          'Authenticate users and maintain session security',
          'Remember user preferences and settings',
          'Analyze Platform usage patterns and performance',
          'Provide personalized features and recommendations',
        ],
        extra: 'You can control cookies through your browser settings. Disabling certain cookies may limit Platform functionality. We do not use cookies for third-party advertising purposes.',
      },
    ],
  },
  {
    title: '2. How We Use Your Information',
    content: 'The Company processes your Information for the following purposes:',
    list: [
      'To provide, maintain, and improve the Platform and Services',
      'To create and manage your Account and workspace',
      'To process transactions and send related billing information',
      'To provide personalized features, AI-powered insights, lead scoring, and smart recommendations',
      'To send transactional communications (account notifications, security alerts, service updates)',
      'To send marketing communications (product updates, tips, newsletters) — with your consent and opt-out option',
      'To provide customer support and respond to your inquiries',
      'To analyze usage trends, monitor Platform performance, and improve user experience',
      'To train and improve AI models using anonymized and aggregated data only',
      'To enforce our Terms & Conditions and protect against misuse',
      'To detect, prevent, and investigate fraud, security breaches, or illegal activities',
      'To comply with legal obligations and respond to lawful requests from authorities',
      'To conduct surveys, collect feedback, and run promotional activities',
    ],
  },
  {
    title: '3. Information Sharing & Disclosure',
    content: 'We do not rent, sell, or trade your personal information. We will not disclose personally identifiable information to third parties except in the following circumstances:',
    list: [
      'With your explicit consent to provide products or services you have requested',
      'With trusted service providers who assist in operating the Platform (hosting, payment processing, email delivery, analytics) — bound by strict confidentiality agreements',
      'On an aggregated, anonymized basis for analytics, benchmarking, or research where individual users cannot be identified',
      'To investigate, prevent, or take action regarding unlawful activities, suspected fraud, or Platform abuse',
      'For compliance with subpoenas, court orders, regulatory requirements, or law enforcement requests',
      'To protect the rights, property, or safety of the Company, its users, or the public',
      'In the event of a merger, acquisition, reorganization, or sale of business assets — you will be notified of any change in ownership or use of your Information',
      'With your organization\'s administrator if you are using the Platform under an enterprise workspace',
    ],
  },
  {
    title: '4. Data Security',
    content: 'We implement industry-standard security measures to protect your Information:',
    list: [
      'Data encryption in transit (TLS 1.2+) and at rest (AES-256)',
      'Role-based access controls and multi-factor authentication support',
      'Regular security audits and vulnerability assessments',
      'Secure cloud infrastructure with redundancy and disaster recovery',
      'Employee access controls with least-privilege principles',
      'Automated threat detection and incident response procedures',
    ],
    extra: 'While we strive to protect your data, no method of electronic transmission or storage is 100% secure. By using the Platform, you acknowledge that the Company cannot guarantee absolute security and shall not be liable for disclosure of Information due to errors in transmission or unauthorized acts of third parties beyond our reasonable control.',
  },
  {
    title: '5. Data Retention & Deletion',
    content: 'We retain your Information for as long as your Account is active or as needed to provide the Services, comply with legal obligations, resolve disputes, and enforce agreements. Specifically:',
    list: [
      'Account data is retained for the duration of your active subscription',
      'Customer Data may be exported by you at any time through the Platform\'s export features',
      'Upon Account termination, Customer Data is retained for 30 days to allow recovery, after which it is permanently deleted',
      'Billing and transaction records may be retained for up to 7 years as required by tax and accounting regulations',
      'Anonymized and aggregated data may be retained indefinitely for analytics and service improvement',
      'Backup copies are purged within 90 days of Account deletion',
    ],
    extra: 'To request data review, export, correction, or deletion, contact our Grievance Officer at the details provided below.',
  },
  {
    title: '6. Your Rights & Choices',
    content: 'You have the following rights regarding your Information:',
    list: [
      'Access — Request a copy of the personal data we hold about you',
      'Correction — Request correction of inaccurate or incomplete personal data',
      'Deletion — Request deletion of your personal data, subject to legal retention requirements',
      'Portability — Export your Customer Data in standard formats (CSV, JSON)',
      'Withdrawal of Consent — Withdraw consent for data collection at any time, though this may limit Platform access',
      'Opt-out — Unsubscribe from marketing communications via the link in any email or through Account settings',
      'Restrict Processing — Request restriction of processing in certain circumstances',
    ],
    extra: 'Your decision to withdraw consent will not affect the lawfulness of processing based on consent given before its withdrawal. To exercise any of these rights, please write to our Grievance Officer.',
  },
  {
    title: '7. AI Data Processing',
    content: 'The Platform uses artificial intelligence and machine learning to provide features such as lead scoring, deal predictions, smart recommendations, and automated summaries. Regarding AI data processing:',
    list: [
      'AI models process your Customer Data to generate insights specific to your workspace',
      'We do not use identifiable Customer Data to train general-purpose AI models shared across customers',
      'Anonymized and aggregated usage patterns may be used to improve AI model accuracy for all users',
      'AI-generated outputs are recommendations only and should be validated by human judgment',
      'You can disable specific AI features through your workspace settings',
      'AI processing logs are retained for debugging and improvement purposes and are access-controlled',
    ],
  },
  {
    title: '8. Children\'s Privacy',
    content: 'The Platform and its contents are not directed to individuals under the age of 18. We do not knowingly collect personal information from minors. If you have reason to believe that a child under 18 has provided personal information to us, please contact our Grievance Officer immediately and we will take steps to delete that information.',
  },
  {
    title: '9. Third-Party Links & Integrations',
    content: 'The Platform may include links to third-party websites and offer integrations with third-party services (email providers, calendar applications, communication tools, payment gateways). These third-party services are governed by their respective privacy policies, which are beyond our control. We recommend reviewing their privacy policies before sharing any information. We do not share your personal information with third-party services without your explicit consent or configuration within the Platform.',
  },
  {
    title: '10. International Data Transfers',
    content: 'The Platform is hosted on cloud infrastructure that may process data in locations outside India. Where data is transferred internationally, we ensure appropriate safeguards are in place, including contractual protections with our service providers that meet the requirements of applicable data protection laws.',
  },
  {
    title: '11. Push Notifications & Communications',
    content: 'We may send push notifications regarding your account, tasks, deals, or Platform updates. You can manage notification preferences through your Account settings or your device\'s notification settings. Transactional notifications related to security, billing, and critical service updates cannot be opted out of while your Account is active.',
  },
  {
    title: '12. Policy Updates',
    content: 'The Company reserves the right to change, amend, modify or update this Privacy Policy at any time. Material changes will be communicated via email to your registered address or through a prominent notice on the Platform at least 15 days before they take effect. Continued use of the Platform after changes become effective constitutes your acceptance of the updated Privacy Policy. We encourage you to review this Privacy Policy periodically.',
  },
  {
    title: '13. Grievance Redressal',
    content: 'If you have any questions, concerns, or complaints regarding this Privacy Policy or our data practices, please contact our Grievance Officer. The Grievance Officer shall acknowledge the complaint within 72 hours and redress the complaints within 15 days from the date of receipt.',
    contact: true,
  },
  {
    title: '14. Jurisdiction & Governing Law',
    content: 'This Privacy Policy shall be governed by and construed in accordance with the laws of India, including the Information Technology Act, 2000, the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011, and the Digital Personal Data Protection Act, 2023 as applicable. Any disputes arising out of or in connection with this Privacy Policy shall be subject to the exclusive jurisdiction of the courts in New Delhi, India.',
  },
]

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white font-sans antialiased">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full border border-white/5" aria-hidden="true" />
        <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full border border-white/5" aria-hidden="true" />

        <div className="relative mx-auto max-w-4xl px-6 py-16 sm:px-10 sm:py-20">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-white/60 transition hover:text-white mb-8">
              <ArrowLeft size={16} />
              Back to Internite CRM
            </Link>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
            className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur">
              <Lock size={20} className="text-white" />
            </div>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">Privacy</span>
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
            className="text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
            Privacy Policy
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-3 text-sm text-white/60">
            Last Updated: July 15, 2026
          </motion.p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-6 py-12 sm:px-10 sm:py-16">
        {/* Preamble */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}
          className="mb-10 rounded-2xl border border-slate-100 bg-slate-50 p-6 text-sm leading-7 text-slate-600">
          <p className="mb-4">
            <strong className="text-slate-800">Internite Corporation Limited</strong>, a company based in Indore, Madhya Pradesh, India ("<strong>Company</strong>", "<strong>we</strong>", "<strong>us</strong>" or "<strong>our</strong>"), manages and operates the <strong>Internite CRM</strong> platform, including the website (<a href="https://nexacrmai.com" className="text-brand-500 hover:text-brand-600 font-semibold">nexacrmai.com</a>), domain name, and any other linked pages, features, content, mobile applications, APIs, or any other services we offer from time to time (collectively the "<strong>Platform</strong>") which is a cloud-based SaaS platform that enables users to manage leads, customers, sales pipelines, communications, AI-powered analytics, automation workflows, invoicing, and team collaboration for organizations.
          </p>
          <p className="mb-4">
            All users of the Platform are advised to read and understand our Privacy Policy and <Link to="/terms" className="text-brand-500 hover:text-brand-600 font-semibold">Terms &amp; Conditions</Link> carefully before registering, accessing or using the Platform. By giving your consent for accessing the Platform, you expressly consent to our collection, storage, use and disclosure of the Information in accordance with the terms of this Privacy Policy, as amended from time to time.
          </p>
          <p>
            This Privacy Policy does not apply to the websites or services of our business partners, corporate affiliates, or any third party, even if their websites are linked to our Platform. We encourage you to read the privacy policies of every website and service you interact with.
          </p>
        </motion.div>

        {/* Sections */}
        <div className="space-y-10">
          {sections.map((s, i) => (
            <motion.section key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.5, delay: 0.05 }}>
              <h2 className="text-lg font-bold text-slate-900 mb-3">{s.title}</h2>

              {/* Subsections (for section 1) */}
              {s.subsections ? (
                <div className="space-y-6">
                  {s.subsections.map((sub, j) => (
                    <div key={j}>
                      <h3 className="text-sm font-bold text-slate-800 mb-2">{sub.subtitle}</h3>
                      <p className="text-sm leading-7 text-slate-600">{sub.content}</p>
                      {sub.list && (
                        <ul className="mt-2 space-y-1.5 pl-1">
                          {sub.list.map((item, k) => (
                            <li key={k} className="flex items-start gap-3 text-sm leading-6 text-slate-600">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      )}
                      {sub.extra && <p className="mt-3 text-sm leading-7 text-slate-500 italic">{sub.extra}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <p className="text-sm leading-7 text-slate-600">{s.content}</p>

                  {s.list && (
                    <ul className="mt-3 space-y-1.5 pl-1">
                      {s.list.map((item, j) => (
                        <li key={j} className="flex items-start gap-3 text-sm leading-6 text-slate-600">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}

                  {s.extra && <p className="mt-3 text-sm leading-7 text-slate-600">{s.extra}</p>}

                  {s.contact && (
                    <div className="mt-5 rounded-xl border border-brand-100 bg-brand-50/50 p-5">
                      <p className="text-sm font-bold text-slate-800 mb-2">Grievance Officer</p>
                      <p className="text-sm text-slate-600">Internite Corporation Limited</p>
                      <p className="text-sm text-slate-600">
                        Email: <a href="mailto:team.internite@gmail.com" className="text-brand-500 font-semibold hover:text-brand-600">team.internite@gmail.com</a>
                      </p>
                      <p className="text-sm text-slate-600">
                        Address: Indore, Madhya Pradesh, India
                      </p>
                    </div>
                  )}
                </>
              )}
            </motion.section>
          ))}
        </div>

        {/* Copyright */}
        <div className="mt-16 border-t border-slate-100 pt-8 text-center">
          <p className="text-sm text-slate-600 mb-4">Thank you for trusting <strong>Internite CRM</strong> with your data.</p>
          <p className="text-xs text-slate-400">
            COPYRIGHT © 2026 – Internite Corporation Limited, India. All rights reserved.
          </p>
          <div className="mt-3 flex justify-center gap-4">
            <Link to="/" className="text-xs font-semibold text-brand-500 hover:text-brand-600">Home</Link>
            <Link to="/terms" className="text-xs font-semibold text-brand-500 hover:text-brand-600">Terms of Service</Link>
            <Link to="/login" className="text-xs font-semibold text-brand-500 hover:text-brand-600">Sign In</Link>
          </div>
        </div>
      </div>
    </main>
  )
}
