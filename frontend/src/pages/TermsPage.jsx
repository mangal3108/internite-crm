import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Shield } from 'lucide-react'

const sections = [
  {
    title: '1. Application',
    content: `The Platform is a cloud-based SaaS application that offers the Services subject to these Terms as well as the Privacy Policy and any other rules and policies of the Platform that the Company may publish from time to time. You must read the Company's Privacy Policy which governs the collection, use, and disclosure of personal information about users. You accept the terms of the Privacy Policy and agree to the use of the personal information about you in accordance with the Privacy Policy. The Services include, but are not limited to, contact and lead management, sales pipeline tracking, AI-powered analytics, automation workflows, communication tools, invoicing, and team collaboration features.`,
  },
  {
    title: '2. Subscription & Registration',
    content: `It is mandatory to register or subscribe to access and use the Platform. You need to register, subscribe and create one or more user accounts (each an "Account") to avail such Services on the Platform by providing your name, email address, password, company details, and other details as required. By registering and creating your Account on the Platform, you agree to:`,
    list: [
      'Provide accurate, current and complete information and maintain and update the same;',
      'Maintain the security of your password and any API keys or access tokens issued to your Account;',
      'Accept all risks of unauthorized access to the Registration Data;',
      'Notify us immediately of any breach of security or any unauthorized use of your Account;',
      'Be responsible for all activity on your Account, including activity by team members added under your workspace, and to use and operate the same in accordance with applicable law;',
      'Ensure all users added to your workspace comply with these Terms.',
    ],
    extra: 'We reserve the right to disallow, cancel, remove or reassign certain usernames in appropriate circumstances, and may suspend or terminate your Account if activities occur on that Account which would or might constitute a violation of these Terms.',
  },
  {
    title: '3. Eligibility',
    content: 'The Platform is available for use and access to users who can form legally binding contracts under the Indian Contract Act, 1872. Users must be at least 18 years of age to access and use the Platform. If you are using the Platform on behalf of an organization, you represent and warrant that you have the authority to bind that organization to these Terms.',
  },
  {
    title: '4. User Obligations',
    content: 'You agree that:',
    list: [
      'You will not copy, reproduce, download, sell, distribute or resell any Services, Platform content, or data accessed through the Platform;',
      'You will not use the Platform content, APIs, or exported data for the purposes of operating a competing business;',
      'You will not undertake any action which may undermine the integrity, performance, or security of the Platform;',
      'You will not attempt to reverse-engineer, decompile, or disassemble any part of the Platform;',
      'You will not upload or transmit any malicious code, viruses, or harmful data to the Platform;',
      'You will not exceed any rate limits, usage quotas, or storage limits applicable to your subscription plan;',
      'You are fully able and competent to understand and agree to these Terms;',
      'You will use the Platform and Services only for lawfully permitted purposes;',
      'You shall comply with all applicable laws, including data protection and privacy regulations, while using the Platform.',
    ],
  },
  {
    title: '5. Data Ownership & Privacy',
    content: `You retain all rights, title, and interest in and to any data you upload, import, or create on the Platform ("Customer Data"). The Company does not claim ownership of Customer Data. You grant the Company a limited, non-exclusive license to use, process, and store Customer Data solely for the purpose of providing the Services. The Company shall implement reasonable security measures to protect Customer Data in accordance with industry standards. Upon termination of your Account, you may request export of your Customer Data within 30 days, after which it may be permanently deleted. For details on how we collect, use, and protect your personal information, please refer to our Privacy Policy.`,
  },
  {
    title: '6. AI Features & Automated Processing',
    content: `The Platform includes AI-powered features such as lead scoring, smart recommendations, auto-summaries, and predictive analytics. These features process Customer Data using machine learning models. You acknowledge that: (a) AI-generated outputs are provided as suggestions and should not be solely relied upon for critical business decisions; (b) the Company does not guarantee the accuracy or completeness of AI-generated insights; (c) you are responsible for reviewing and validating AI outputs before acting upon them; (d) the Company may use anonymized and aggregated data to improve AI models, but will never share identifiable Customer Data with third parties for this purpose.`,
  },
  {
    title: '7. Intellectual Property Rights',
    content: `The Company is the sole owner or lawful licensee of all the rights and interests in the Platform and the Platform Content. All title, ownership and intellectual property rights in the Platform and Platform Content shall remain with the Company. The "Internite CRM" brand, logo, icons, user interface designs, and all related trademarks are the exclusive property of the Company. The unauthorized copying, modification, use or publication of the "Internite CRM" brand and any related icons, logos, or proprietary materials is strictly prohibited.`,
  },
  {
    title: '8. Service Availability & SLA',
    content: `The Company shall use commercially reasonable efforts to maintain Platform availability of 99.9% uptime, measured on a monthly basis, excluding scheduled maintenance windows. Scheduled maintenance will be communicated at least 24 hours in advance via email or in-app notification. The Company reserves the right to perform emergency maintenance without prior notice when necessary to protect the security or integrity of the Platform. Service credits may be issued at the Company's discretion for downtime exceeding the committed SLA.`,
  },
  {
    title: '9. Subscription Plans & Payment of Fees',
    content: `The Company offers multiple subscription tiers including free and paid plans. Paid subscriptions are billed on a monthly or annual basis as selected by the user. All fees are exclusive of applicable taxes unless stated otherwise. The Company reserves the right to modify pricing with 30 days' prior written notice. Failure to pay fees when due may result in suspension or termination of access to paid features. Refunds are governed by the Company's refund policy, available on the Platform. The Company will not be responsible for any fraudulent use of payment methods.`,
  },
  {
    title: '10. Breaches & Suspension',
    content: `If any user breaches any Terms, or if the Company has reasonable grounds to believe a user is in breach, the Company shall have the right to take disciplinary actions including but not limited to: suspending or terminating the user's account and associated workspace; blocking or restricting access to Services; removing user content that violates these Terms; and reporting violations to relevant authorities where required by law.`,
  },
  {
    title: '11. Indemnification',
    content: `By accepting these Terms and using the Platform, you agree that you shall defend, indemnify and hold the Company, its directors, employees, shareholders, officers and other representatives harmless from and against any and all claims, costs, damages, losses, liabilities and expenses (including reasonable attorney's fees) arising out of or in connection with: misuse of the Platform; your violation or breach of these Terms or any applicable law; your violation of any rights of any third party, including intellectual property or privacy rights; data breaches resulting from your negligence; or any third-party claims based upon your usage of the Platform or Services.`,
  },
  {
    title: '12. Limitation of Liability',
    content: `To the maximum extent permitted by law, the Services provided by the Company are provided "as is", "as available" and "with all faults". Under no circumstances will the Company be liable for any consequential, incidental, special, exemplary or punitive damages, including but not limited to any lost profits, loss of data, loss of business opportunity, or business interruption that result from your use of this Platform. The Company's total aggregate liability under these Terms shall not exceed the total fees paid by you to the Company in the twelve (12) months preceding the event giving rise to such liability.`,
  },
  {
    title: '13. Force Majeure',
    content: `Under no circumstances shall the Company be held liable for any losses, delay or failure or disruption of the content or services resulting directly or indirectly from acts of nature, forces or causes beyond our reasonable control, including without limitation, internet failures, cloud infrastructure outages, equipment failures, cybersecurity incidents, strikes, fires, floods, storms, earthquakes, acts of God, war, terrorism, governmental actions, sanctions, epidemics, pandemics, or non-performance of third-party service providers.`,
  },
  {
    title: '14. Termination',
    content: `Either party may terminate these Terms at any time by providing written notice. Upon termination: (a) your right to access and use the Platform will immediately cease; (b) you may request export of your Customer Data within 30 days of termination; (c) any outstanding fees shall become immediately due and payable; (d) provisions that by their nature should survive termination (including Indemnification, Limitation of Liability, and Intellectual Property Rights) shall continue in effect.`,
  },
  {
    title: '15. Grievance Redressal',
    content: `If there are any questions regarding these Terms, please write to the Grievance Officer. Any complaints or concerns shall be immediately informed to the designated Grievance Officer. The Grievance Officer shall acknowledge the complaint within 72 hours and redress the complaints within 15 days from the date of receipt.`,
    extra: null,
    contact: true,
  },
  {
    title: '16. Jurisdiction & Governing Law',
    content: `These Terms shall be governed by and construed in accordance with the laws of India. Any disputes arising out of or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts in New Delhi, India. If for any reason, any part or provision of these Terms is deemed invalid or unenforceable, the remaining provisions which are valid shall continue in full force and effect.`,
  },
]

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white font-sans antialiased">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-brand-900">
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
              <Shield size={20} className="text-brand-400" />
            </div>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-400">Legal</span>
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
            className="text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
            Terms &amp; Conditions
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
            This document is an electronic record in terms of the Information Technology Act, 2000 and rules thereunder as applicable and the amended provisions pertaining to electronic records in various statutes as amended by the Information Technology Act, 2000. This electronic record is generated by a computer system and does not require any physical or digital signatures.
          </p>
          <p className="mb-4">
            <strong className="text-slate-800">Internite Corporation Limited</strong>, a company based in Indore, Madhya Pradesh, India ("<strong>Company</strong>", "<strong>we</strong>", "<strong>us</strong>" or "<strong>our</strong>"), manages and operates the <strong>Internite CRM</strong> platform, including the website (<a href="https://nexacrmai.com" className="text-brand-500 hover:text-brand-600 font-semibold">nexacrmai.com</a>), domain name, and any other linked pages, features, content, mobile application, APIs, or any other services we offer from time to time in connection therewith (collectively the "<strong>Platform</strong>") which is a cloud-based SaaS platform that enables users to manage leads, customers, sales pipelines, communications, automation workflows, AI-powered analytics, invoicing, and team collaboration for organizations (collectively, the "<strong>Services</strong>").
          </p>
          <p className="mb-4">
            All users of the Platform are advised to read and understand our Privacy Policy and Terms &amp; Conditions carefully before registering, accessing or using the Platform or any services offered by the Company. By giving your consent for accessing the Platform (either as a visitor, a customer, or an organization administrator), you (hereinafter referred to as "<strong>you</strong>", "<strong>your</strong>", "<strong>user</strong>", as applicable) expressly consent to our collection, storage, use and disclosure of information shared by you with the Company in accordance with the terms of these Terms and Conditions and the Privacy Policy, as amended from time to time.
          </p>
          <p>
            We reserve the right, at our sole discretion, to change, modify, add or remove portions of these terms, at any time without any prior written notice to you. By accessing, browsing, or otherwise using the Platform, including following the posting of changes, the user agrees to accept and be bound by the terms (as may be amended from time to time). It is your responsibility to review these terms periodically for any updates/changes.
          </p>
        </motion.div>

        {/* Sections */}
        <div className="space-y-10">
          {sections.map((s, i) => (
            <motion.section key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.5, delay: 0.05 }}>
              <h2 className="text-lg font-bold text-slate-900 mb-3">{s.title}</h2>
              <p className="text-sm leading-7 text-slate-600">{s.content}</p>

              {s.list && (
                <ul className="mt-3 space-y-2 pl-1">
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
            </motion.section>
          ))}
        </div>

        {/* Copyright */}
        <div className="mt-16 border-t border-slate-100 pt-8 text-center">
          <p className="text-xs text-slate-400">
            COPYRIGHT © 2026 – Internite Corporation Limited, India. All rights reserved.
          </p>
          <div className="mt-3 flex justify-center gap-4">
            <Link to="/" className="text-xs font-semibold text-brand-500 hover:text-brand-600">Home</Link>
            <Link to="/privacy" className="text-xs font-semibold text-brand-500 hover:text-brand-600">Privacy Policy</Link>
            <Link to="/login" className="text-xs font-semibold text-brand-500 hover:text-brand-600">Sign In</Link>
          </div>
        </div>
      </div>
    </main>
  )
}
