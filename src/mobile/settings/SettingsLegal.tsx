import { useState } from 'react'
import { BrandMark } from '@/components/ui/BrandMark'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { submitFeedback } from '@/data/feedback'
import { APP_VERSION } from '@/data/release'
import { useT } from '@/i18n'
import { SettingsRow, SettingsSheet, type SheetProps } from './shared'

const PRIVACY_SECTIONS: { title: string; body: string[] }[] = [
  {
    title: '1. Who is responsible for your data',
    body: [
      '$harky is developed and maintained by David Bonilla ("the Developer", "we", "us"). For any question about this Privacy Policy or your data, write to us at contactosharklin@gmail.com.',
    ],
  },
  {
    title: '2. What data we collect',
    body: [
      'Financial data you enter (accounts, transactions, categories, budgets and goals): stored only on your device, locally, unless you voluntarily turn on sync with your Google account as described below.',
      'Google account data (optional): if you choose to sign in with Google, we receive the name, email address, profile photo and account identifier that Google provides, used solely to identify you inside the app and enable sync across your devices.',
      'Cloud-synced data (optional): if you turn on sync, your accounts, transactions, categories, goals and contributions are stored on our database infrastructure (Supabase), linked to your user identifier, so you can access them from different devices.',
      'Comments and suggestions: if you use the "Comments" section in Settings, the text you write is sent directly to us from within the app and may include basic context such as the app version and platform, so we can read and respond to it.',
      'We do not include advertising or third-party commercial trackers, and we do not collect browsing data for marketing purposes.',
    ],
  },
  {
    title: '3. How we use your data',
    body: [
      'To make the app work: calculations, reports, budgets, projections and goals are generated locally from the information you enter.',
      'To sync your data across your own devices when you sign in and turn that feature on.',
      'To read and respond to the comments, questions or support requests you send us.',
      'We never sell, rent or share your financial data for advertising or commercial purposes.',
    ],
  },
  {
    title: '4. Who we share information with',
    body: [
      'Google LLC, as the sign-in provider, only if you choose to use that feature. How Google handles your data is governed by its own privacy policy.',
      'Supabase Inc., as our cloud database infrastructure provider, solely to securely store the data you choose to sync. Supabase acts as a data processor and does not use your information for its own purposes.',
      'We do not share your information with advertisers, data brokers, or third parties for marketing purposes.',
    ],
  },
  {
    title: '5. Data security',
    body: [
      'We apply reasonable technical measures to protect your data: encryption in transit (HTTPS/TLS), secure credential storage, and authentication via the OAuth PKCE flow. No system is perfectly secure, so we cannot guarantee absolute protection.',
    ],
  },
  {
    title: '6. Your rights and control over your data',
    body: [
      'You can use $harky entirely offline and without creating an account; in that case your data never leaves your device.',
      'You can export a copy of your data at any time from Settings → Data → Export backup, and restore it later.',
      'You can permanently delete all your local data, and your synced cloud data, from Settings → Data → Delete all data.',
      'You can sign out of Google and turn off sync at any time from Settings → Account.',
      'If you want us to delete your account entirely, write to us at contactosharklin@gmail.com and we will handle your request within a reasonable time.',
    ],
  },
  {
    title: '7. Data retention',
    body: [
      'Locally stored data stays on your device until you delete it or uninstall the app. Cloud-synced data is kept while your account is active or until you request its deletion.',
    ],
  },
  {
    title: '8. Children',
    body: [
      '$harky is not directed at children under 13, and we do not knowingly collect information from minors. If you believe a minor has provided us with personal data, please contact us so we can remove it.',
    ],
  },
  {
    title: '9. Changes to this policy',
    body: [
      'We may update this Privacy Policy from time to time. If the changes are significant, we will notify you inside the app. The date of the latest update always appears at the top of this document.',
    ],
  },
  {
    title: '10. Contact',
    body: [
      'For questions, data requests, or any privacy concern, write to us at contactosharklin@gmail.com.',
    ],
  },
]

const TERMS_SECTIONS: { title: string; body: string[] }[] = [
  {
    title: '1. Acceptance of these terms',
    body: [
      'By downloading, installing or using $harky ("the app"), you agree to these Terms of Use. If you do not agree with them, please do not use the app.',
    ],
  },
  {
    title: '2. Description of the service',
    body: [
      '$harky is a personal finance management tool that lets you track income, expenses, budgets and savings goals. It is an informational and organizational tool: it is not a financial institution, a bank, or an investment advisor, and it does not replace professional advice.',
    ],
  },
  {
    title: '3. Not financial advice',
    body: [
      'The information, calculations, projections and reports the app generates are based solely on the data you enter and are for guidance only. They do not constitute financial, legal, accounting or tax advice. We recommend consulting a qualified professional before making important financial decisions.',
    ],
  },
  {
    title: '4. Your responsibility for your data',
    body: [
      'You are solely responsible for the accuracy of the information you enter, and for keeping backups of your data (the app includes a backup export/import feature for this purpose).',
      'If you choose to use Google sign-in and cloud sync, you are responsible for keeping your Google account secure and for any activity that happens through it.',
    ],
  },
  {
    title: '5. Acceptable use',
    body: [
      'You agree to use $harky lawfully, and not to attempt to breach, reverse-engineer, overload, or otherwise compromise the security of the app or the services that support it.',
    ],
  },
  {
    title: '6. Intellectual property',
    body: [
      'The "$harky" name, its logo, visual design, source code and content are the property of David Bonilla, except for third-party libraries used under their respective open-source licenses.',
    ],
  },
  {
    title: '7. Service availability',
    body: [
      'We make a reasonable effort to keep the app running correctly, but we do not guarantee it will be error-free, uninterrupted, or always available — particularly for features that depend on external services (Google, Supabase).',
    ],
  },
  {
    title: '8. Limitation of liability',
    body: [
      'To the maximum extent permitted by applicable law, David Bonilla will not be liable for indirect, incidental or consequential damages arising from the use or inability to use the app — including, among others, data loss or financial decisions made based on its information. The app is provided "as is" and "as available", without warranties of any kind, express or implied.',
    ],
  },
  {
    title: '9. Changes to the service and these terms',
    body: [
      'We may update, modify or discontinue features of the app, as well as these Terms of Use, at any time. We will notify you of relevant changes inside the app. If you keep using $harky after a change, you are considered to have accepted the new terms.',
    ],
  },
  {
    title: '10. Termination',
    body: [
      'You can stop using the app and delete your data whenever you want. We may suspend or limit features that depend on third-party services if those services change their terms or become unavailable.',
    ],
  },
  {
    title: '11. Governing law',
    body: [
      'These Terms are governed by the laws of the Dominican Republic, without prejudice to any consumer-protection rules that may apply to you based on your place of residence.',
    ],
  },
  {
    title: '12. Contact',
    body: [
      'For questions about these Terms of Use, write to us at contactosharklin@gmail.com.',
    ],
  },
]

export function SettingsLegal({ activeSheet, onOpen, onClose }: SheetProps) {
  const t = useT()
  const [commentText, setCommentText] = useState('')
  const [sending, setSending] = useState(false)

  const sendComment = async () => {
    if (!commentText.trim() || sending) return
    setSending(true)
    try {
      const result = await submitFeedback(commentText)
      toast(result === 'sent' ? t('thanksForComment') : t('commentQueued'), { icon: 'check', type: 'ok' })
      setCommentText('')
      onClose()
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <div className="mset-section">
        <span className="mset-section-title">{t('aboutSection')}</span>
        <div className="mset-card">
          <SettingsRow icon="edit"  iconColor="#5bc0ff" label={t('comments')}  onClick={() => onOpen('comments')} />
          <SettingsRow icon="info"  iconColor="#35d0a2" label={t('aboutUs')}   onClick={() => onOpen('about')} />
        </div>
        <div className="mset-card">
          <SettingsRow icon="shield" iconColor="#a78bfa" label={t('privacyPolicy')} onClick={() => onOpen('privacy')} />
          <SettingsRow icon="book"   iconColor="#f59e0b" label={t('termsOfUse')}    onClick={() => onOpen('terms')} />
        </div>
        <div className="mset-card">
          <div className="mset-info-row">
            <span>$harky</span>
            <span>v{APP_VERSION}</span>
          </div>
        </div>
      </div>

      {activeSheet === 'comments' && (
        <SettingsSheet title={t('comments')} onClose={onClose}>
          <div className="mset-sheet-body">
            <p className="mset-legal-intro">
              {t('commentsIntro')}
            </p>
            <textarea
              className="mset-textarea" rows={6}
              value={commentText} placeholder={t('commentPlaceholder')}
              onChange={e => setCommentText(e.target.value)}
            />
            <button className="mset-sheet-confirm" disabled={!commentText.trim() || sending} onClick={() => void sendComment()}>
              <Icon name="edit" size={16} style={{ marginRight: 8 }} /> {sending ? t('sendingComment') : t('sendComment')}
            </button>
          </div>
        </SettingsSheet>
      )}

      {activeSheet === 'about' && (
        <SettingsSheet title={t('aboutUs')} onClose={onClose}>
          <div className="mset-sheet-body mset-about">
            <BrandMark size={64} />
            <strong className="mset-about-name">$harky</strong>
            <span className="mset-about-version">{t('versionLabel').replace('{v}', APP_VERSION)}</span>
            <p className="mset-about-dev">{t('developedByLabel')} <strong>David Bonilla</strong></p>
            <p className="mset-about-desc">
              {t('aboutDesc')}
            </p>
          </div>
        </SettingsSheet>
      )}

      {activeSheet === 'privacy' && (
        <SettingsSheet title={t('privacyPolicy')} onClose={onClose}>
          <div className="mset-sheet-body mset-legal">
            <p className="mset-legal-updated">Last updated: June 7, 2026</p>
            {PRIVACY_SECTIONS.map(section => (
              <div key={section.title}>
                <h3>{section.title}</h3>
                {section.body.map((p, i) => <p key={i}>{p}</p>)}
              </div>
            ))}
          </div>
        </SettingsSheet>
      )}

      {activeSheet === 'terms' && (
        <SettingsSheet title={t('termsOfUse')} onClose={onClose}>
          <div className="mset-sheet-body mset-legal">
            <p className="mset-legal-updated">Last updated: June 7, 2026</p>
            {TERMS_SECTIONS.map(section => (
              <div key={section.title}>
                <h3>{section.title}</h3>
                {section.body.map((p, i) => <p key={i}>{p}</p>)}
              </div>
            ))}
          </div>
        </SettingsSheet>
      )}
    </>
  )
}
